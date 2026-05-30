// app/api/requests/route.ts                  (GET list, POST create)
// app/api/requests/[id]/route.ts              (GET detail, PATCH update, DELETE)
// app/api/requests/[id]/accept/route.ts       (POST accept)
// app/api/requests/[id]/hold/route.ts         (POST hold)
// app/api/requests/[id]/reject/route.ts       (POST reject)

import { NextRequest } from "next/server";
import { z } from "zod";
import {
  prisma,
  ok,
  fail,
  handleError,
  requireSession,
  hasRole,
  createNotification,
} from "@/lib/api-helpers";

// ── 공통 select ──────────────────────────────────────────────────────────────
const requestSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  department: true,
  deadline: true,
  createdAt: true,
  updatedAt: true,
  requester: { select: { id: true, name: true, role: true } },
  assignee: { select: { id: true, name: true, role: true } },
  schedule: { select: { id: true, title: true, date: true } },
} as const;

const requestDetailSelect = {
  ...requestSelect,
  tasks: { select: { id: true, title: true, status: true } },
  activities: {
    select: {
      id: true,
      action: true,
      detail: true,
      createdAt: true,
      actor: { select: { id: true, name: true, role: true } },
    },
    orderBy: { createdAt: "asc" },
  },
} as const;

const SCHEDULE_TYPES = [
  "INFANT",
  "KINDER",
  "ELEM1",
  "ELEM2",
  "ELEM3",
  "YOUTH",
  "EDU",
  "BABY",
  "WORSHIP_EDU",
  "MAIN",
] as const;

const REQUEST_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "IN_PROGRESS",
  "REVIEW",
  "DONE",
  "HOLD",
  "REJECTED",
] as const;

const REQUEST_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

type RequestRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  department: string | null;
  deadline: Date | null;
  createdAt: Date;
  updatedAt: Date;
  requester: { id: string; name: string; role: string };
  assignee: { id: string; name: string; role: string };
  schedule: { id: string; title: string; date: Date } | null;
};

function serializeRequest(r: RequestRow) {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    status: r.status,
    priority: r.priority,
    department: r.department,
    deadline: r.deadline ? r.deadline.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    requester: r.requester,
    assignee: r.assignee,
    schedule: r.schedule
      ? {
          id: r.schedule.id,
          title: r.schedule.title,
          date: r.schedule.date.toISOString().split("T")[0],
        }
      : null,
  };
}

// ── GET /api/requests ────────────────────────────────────────────────────────
export async function GET_requests(req: NextRequest) {
  try {
    const user = await requireSession();
    if (!user) return fail("인증이 필요합니다", 401);

    const { searchParams } = req.nextUrl;
    const tab = (searchParams.get("tab") ?? "received") as
      | "received"
      | "sent"
      | "done";
    const statusFilter = searchParams.get("status") ?? undefined;
    const departmentFilter = searchParams.get("department") ?? undefined;
    const search = searchParams.get("search") ?? undefined;

    const whereBase: Record<string, unknown> = {};

    if (tab === "received") {
      whereBase.assigneeId = user.id;
      whereBase.status = { not: "DONE" };
    } else if (tab === "sent") {
      whereBase.requesterId = user.id;
      whereBase.status = { not: "DONE" };
    } else {
      whereBase.OR = [{ assigneeId: user.id }, { requesterId: user.id }];
      whereBase.status = "DONE";
    }

    if (statusFilter && tab !== "done") {
      whereBase.status = statusFilter;
    }
    if (departmentFilter) {
      whereBase.department = departmentFilter;
    }
    if (search) {
      whereBase.AND = [
        {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        },
      ];
    }

    const rows = await prisma.request.findMany({
      where: whereBase,
      select: requestSelect,
      orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
      take: 50,
    });

    return ok(rows.map((row) => serializeRequest(row as RequestRow)));
  } catch (err) {
    return handleError(err);
  }
}

// ── POST /api/requests ───────────────────────────────────────────────────────
const createRequestSchema = z
  .object({
    title: z.string().min(1).max(120),
    description: z.string().max(2000).optional(),
    assigneeId: z.string().min(1).optional(),
    deadline: z.string().datetime().optional(),
    department: z.enum(SCHEDULE_TYPES).optional(),
    scheduleId: z.string().optional(),
    priority: z.enum(REQUEST_PRIORITIES).default("MEDIUM"),
    bulkDepartment: z.enum(SCHEDULE_TYPES).optional(),
  })
  .refine((d) => !!d.assigneeId || !!d.bulkDepartment, {
    message: "assigneeId 또는 bulkDepartment 중 하나는 필수입니다",
  });

export async function POST_requests(req: NextRequest) {
  try {
    const user = await requireSession();
    if (!user) return fail("인증이 필요합니다", 401);

    const body = createRequestSchema.parse(await req.json());

    // ── 일괄 모드 ───────────────────────────────────────────────────────────
    if (body.bulkDepartment) {
      if (!hasRole(user.role, "PASTOR")) {
        return fail("부서 일괄 요청은 PASTOR 이상만 가능합니다", 403);
      }
      const targets = await prisma.user.findMany({
        where: { team: body.bulkDepartment, isActive: true },
        select: { id: true, name: true },
      });
      if (targets.length === 0) {
        return fail("해당 부서에 활성 사용자가 없습니다", 404);
      }

      const deadlineDate = body.deadline ? new Date(body.deadline) : null;

      const created = await prisma.$transaction(
        targets.map((t) =>
          prisma.request.create({
            data: {
              title: body.title,
              description: body.description ?? null,
              requesterId: user.id,
              assigneeId: t.id,
              department: body.department ?? body.bulkDepartment ?? null,
              scheduleId: body.scheduleId ?? null,
              deadline: deadlineDate,
              priority: body.priority,
              activities: {
                create: {
                  actorId: user.id,
                  action: "CREATED",
                },
              },
            },
            select: { id: true, assigneeId: true },
          })
        )
      );

      await Promise.all(
        created.map((r) =>
          createNotification(
            r.assigneeId,
            `${user.name}님이 새 요청을 보냈습니다: ${body.title}`
          )
        )
      );

      return ok(
        {
          count: created.length,
          ids: created.map((r) => r.id),
        },
        201
      );
    }

    // ── 단건 모드 ───────────────────────────────────────────────────────────
    if (!body.assigneeId) {
      return fail("assigneeId가 필요합니다", 400);
    }
    const assignee = await prisma.user.findUnique({
      where: { id: body.assigneeId },
      select: { id: true, name: true, isActive: true },
    });
    if (!assignee || !assignee.isActive) {
      return fail("담당자를 찾을 수 없습니다", 404);
    }

    const created = await prisma.request.create({
      data: {
        title: body.title,
        description: body.description ?? null,
        requesterId: user.id,
        assigneeId: body.assigneeId,
        department: body.department ?? null,
        scheduleId: body.scheduleId ?? null,
        deadline: body.deadline ? new Date(body.deadline) : null,
        priority: body.priority,
        activities: {
          create: {
            actorId: user.id,
            action: "CREATED",
          },
        },
      },
      select: requestSelect,
    });

    await createNotification(
      body.assigneeId,
      `${user.name}님이 새 요청을 보냈습니다: ${body.title}`
    );

    return ok(serializeRequest(created as RequestRow), 201);
  } catch (err) {
    return handleError(err);
  }
}

// ── GET /api/requests/[id] ───────────────────────────────────────────────────
export async function GET_request(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireSession();
    if (!user) return fail("인증이 필요합니다", 401);

    const row = await prisma.request.findUnique({
      where: { id: params.id },
      select: requestDetailSelect,
    });
    if (!row) return fail("요청을 찾을 수 없습니다", 404);

    const isRequester = row.requester.id === user.id;
    const isAssignee = row.assignee.id === user.id;
    const isPastorPlus = hasRole(user.role, "PASTOR");
    if (!isRequester && !isAssignee && !isPastorPlus) {
      return fail("권한이 없습니다", 403);
    }

    const base = serializeRequest(row as RequestRow);
    return ok({
      ...base,
      tasks: row.tasks,
      activities: row.activities.map((a) => ({
        id: a.id,
        action: a.action,
        detail: a.detail,
        actor: a.actor,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}

// ── PATCH /api/requests/[id] ─────────────────────────────────────────────────
const patchRequestSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
  department: z.enum(SCHEDULE_TYPES).nullable().optional(),
  scheduleId: z.string().nullable().optional(),
  priority: z.enum(REQUEST_PRIORITIES).optional(),
  assigneeId: z.string().min(1).optional(),
});

export async function PATCH_request(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireSession();
    if (!user) return fail("인증이 필요합니다", 401);

    const existing = await prisma.request.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        title: true,
        requesterId: true,
        assigneeId: true,
        status: true,
        deadline: true,
        priority: true,
        department: true,
      },
    });
    if (!existing) return fail("요청을 찾을 수 없습니다", 404);

    const isRequester = existing.requesterId === user.id;
    const isAdmin = hasRole(user.role, "ADMIN");
    if (!isRequester && !isAdmin) {
      return fail("권한이 없습니다", 403);
    }
    if (
      isRequester &&
      !isAdmin &&
      existing.status !== "PENDING" &&
      existing.status !== "HOLD"
    ) {
      return fail("PENDING/HOLD 상태에서만 수정할 수 있습니다", 409);
    }

    const body = patchRequestSchema.parse(await req.json());

    const data: Record<string, unknown> = {};
    const activityWrites: Array<{
      actorId: string;
      action: string;
      detail: string | null;
    }> = [];
    const notifyTargets: Array<{ userId: string; message: string }> = [];

    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.scheduleId !== undefined) data.scheduleId = body.scheduleId;
    if (body.department !== undefined) data.department = body.department;

    if (body.deadline !== undefined) {
      const newDeadline = body.deadline ? new Date(body.deadline) : null;
      data.deadline = newDeadline;
      activityWrites.push({
        actorId: user.id,
        action: "DEADLINE_CHANGED",
        detail: JSON.stringify({
          from: existing.deadline ? existing.deadline.toISOString() : null,
          to: newDeadline ? newDeadline.toISOString() : null,
        }),
      });
    }
    if (body.priority !== undefined && body.priority !== existing.priority) {
      data.priority = body.priority;
      activityWrites.push({
        actorId: user.id,
        action: "PRIORITY_CHANGED",
        detail: JSON.stringify({ from: existing.priority, to: body.priority }),
      });
    }
    if (body.assigneeId !== undefined && body.assigneeId !== existing.assigneeId) {
      const newAssignee = await prisma.user.findUnique({
        where: { id: body.assigneeId },
        select: { id: true, name: true, isActive: true },
      });
      if (!newAssignee || !newAssignee.isActive) {
        return fail("새 담당자를 찾을 수 없습니다", 404);
      }
      data.assigneeId = body.assigneeId;
      activityWrites.push({
        actorId: user.id,
        action: "ASSIGNEE_CHANGED",
        detail: JSON.stringify({
          fromId: existing.assigneeId,
          toId: body.assigneeId,
        }),
      });
      notifyTargets.push({
        userId: body.assigneeId,
        message: `${user.name}님이 요청 담당자로 지정했습니다: ${existing.title}`,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.request.update({
        where: { id: params.id },
        data,
        select: requestSelect,
      });
      if (activityWrites.length > 0) {
        await tx.requestActivity.createMany({
          data: activityWrites.map((a) => ({
            requestId: params.id,
            actorId: a.actorId,
            action: a.action,
            detail: a.detail,
          })),
        });
      }
      return row;
    });

    await Promise.all(
      notifyTargets.map((n) => createNotification(n.userId, n.message))
    );

    return ok(serializeRequest(updated as RequestRow));
  } catch (err) {
    return handleError(err);
  }
}

// ── DELETE /api/requests/[id] ────────────────────────────────────────────────
export async function DELETE_request(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireSession();
    if (!user) return fail("인증이 필요합니다", 401);

    const existing = await prisma.request.findUnique({
      where: { id: params.id },
      select: { id: true, requesterId: true, status: true },
    });
    if (!existing) return fail("요청을 찾을 수 없습니다", 404);

    const isRequester = existing.requesterId === user.id;
    const isAdmin = hasRole(user.role, "ADMIN");
    if (!isAdmin) {
      if (!isRequester) return fail("권한이 없습니다", 403);
      if (existing.status !== "PENDING") {
        return fail("PENDING 상태의 요청만 삭제할 수 있습니다", 409);
      }
    }

    await prisma.request.delete({ where: { id: params.id } });
    return ok({ id: params.id });
  } catch (err) {
    return handleError(err);
  }
}

// ── POST /api/requests/[id]/accept ───────────────────────────────────────────
export async function POST_accept(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireSession();
    if (!user) return fail("인증이 필요합니다", 401);

    const existing = await prisma.request.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        deadline: true,
        department: true,
        scheduleId: true,
        requesterId: true,
        assigneeId: true,
        requester: { select: { id: true, name: true } },
      },
    });
    if (!existing) return fail("요청을 찾을 수 없습니다", 404);
    if (existing.assigneeId !== user.id) return fail("권한이 없습니다", 403);
    if (existing.status !== "PENDING" && existing.status !== "HOLD") {
      return fail("PENDING 또는 HOLD 상태에서만 수락할 수 있습니다", 409);
    }

    const result = await prisma.$transaction(async (tx) => {
      let scheduleId: string | null = existing.scheduleId;
      let createdSchedule: {
        id: string;
        title: string;
        date: Date;
      } | null = null;

      // Schedule 자동 생성 (deadline 있고 scheduleId 없을 때)
      if (existing.deadline && !existing.scheduleId) {
        const sched = await tx.schedule.create({
          data: {
            title: existing.title,
            type: existing.department ?? "MAIN",
            date: existing.deadline,
            description: existing.description,
            createdById: user.id,
          },
          select: { id: true, title: true, date: true },
        });
        scheduleId = sched.id;
        createdSchedule = sched;
      }

      // Task 생성
      const task = await tx.task.create({
        data: {
          title: existing.title,
          description: existing.description,
          status: "TODO",
          deadline: existing.deadline,
          assignedToId: existing.assigneeId,
          assignedById: existing.requesterId,
          scheduleId: scheduleId,
          requestId: existing.id,
        },
        select: { id: true, title: true, status: true },
      });

      // Request 업데이트
      const updated = await tx.request.update({
        where: { id: existing.id },
        data: {
          status: "ACCEPTED",
          scheduleId: scheduleId,
        },
        select: requestSelect,
      });

      // Activity 기록
      const activities: Array<{
        action: string;
        detail: string | null;
      }> = [
        {
          action: "ACCEPTED",
          detail: JSON.stringify({ taskId: task.id, scheduleId }),
        },
        {
          action: "TASK_CREATED",
          detail: JSON.stringify({ taskId: task.id }),
        },
      ];
      if (createdSchedule) {
        activities.push({
          action: "SCHEDULE_CREATED",
          detail: JSON.stringify({ scheduleId }),
        });
      }
      await tx.requestActivity.createMany({
        data: activities.map((a) => ({
          requestId: existing.id,
          actorId: user.id,
          action: a.action,
          detail: a.detail,
        })),
      });

      return { updated, task, createdSchedule };
    });

    await createNotification(
      existing.requesterId,
      `${user.name}님이 요청을 수락했습니다: ${existing.title}`
    );

    return ok({
      request: serializeRequest(result.updated as RequestRow),
      task: result.task,
      schedule: result.createdSchedule
        ? {
            id: result.createdSchedule.id,
            title: result.createdSchedule.title,
            date: result.createdSchedule.date.toISOString().split("T")[0],
          }
        : null,
    });
  } catch (err) {
    return handleError(err);
  }
}

// ── POST /api/requests/[id]/hold ─────────────────────────────────────────────
const holdSchema = z.object({ reason: z.string().max(1000).optional() });

export async function POST_hold(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireSession();
    if (!user) return fail("인증이 필요합니다", 401);

    const existing = await prisma.request.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        title: true,
        status: true,
        assigneeId: true,
        requesterId: true,
      },
    });
    if (!existing) return fail("요청을 찾을 수 없습니다", 404);
    if (existing.assigneeId !== user.id) return fail("권한이 없습니다", 403);
    if (existing.status !== "PENDING" && existing.status !== "ACCEPTED") {
      return fail("PENDING 또는 ACCEPTED 상태에서만 보류할 수 있습니다", 409);
    }

    const body = holdSchema.parse(await req.json().catch(() => ({})));

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.request.update({
        where: { id: params.id },
        data: { status: "HOLD" },
        select: requestSelect,
      });
      await tx.requestActivity.create({
        data: {
          requestId: params.id,
          actorId: user.id,
          action: "HELD",
          detail: JSON.stringify({ reason: body.reason ?? null }),
        },
      });
      return row;
    });

    await createNotification(
      existing.requesterId,
      `${user.name}님이 요청을 보류했습니다: ${existing.title}`
    );

    return ok(serializeRequest(updated as RequestRow));
  } catch (err) {
    return handleError(err);
  }
}

// ── POST /api/requests/[id]/reject ───────────────────────────────────────────
const rejectSchema = z.object({ reason: z.string().min(1).max(1000) });

export async function POST_reject(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireSession();
    if (!user) return fail("인증이 필요합니다", 401);

    const existing = await prisma.request.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        title: true,
        status: true,
        assigneeId: true,
        requesterId: true,
      },
    });
    if (!existing) return fail("요청을 찾을 수 없습니다", 404);
    if (existing.assigneeId !== user.id) return fail("권한이 없습니다", 403);
    if (existing.status !== "PENDING" && existing.status !== "HOLD") {
      return fail("PENDING 또는 HOLD 상태에서만 거절할 수 있습니다", 409);
    }

    const body = rejectSchema.parse(await req.json());

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.request.update({
        where: { id: params.id },
        data: { status: "REJECTED" },
        select: requestSelect,
      });
      await tx.requestActivity.create({
        data: {
          requestId: params.id,
          actorId: user.id,
          action: "REJECTED",
          detail: JSON.stringify({ reason: body.reason }),
        },
      });
      return row;
    });

    await createNotification(
      existing.requesterId,
      `${user.name}님이 요청을 거절했습니다: ${existing.title}`
    );

    return ok(serializeRequest(updated as RequestRow));
  } catch (err) {
    return handleError(err);
  }
}

// 상태 enum 외부 노출 (다른 파일에서 사용 시)
export const REQUEST_STATUSES_EXPORT = REQUEST_STATUSES;
