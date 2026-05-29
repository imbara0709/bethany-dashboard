// app/api/tasks/route.ts  (GET list, POST create)
// app/api/tasks/[id]/route.ts  (GET detail, PATCH update, DELETE)

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

const taskSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  deadline: true,
  assignedTo: { select: { id: true, name: true } },
  assignedBy: { select: { id: true, name: true } },
  schedule: { select: { id: true, title: true, date: true } },
  createdAt: true,
  updatedAt: true,
} as const;

// ── GET /api/tasks ────────────────────────────────────────────────────────────
export async function GET_tasks(req: NextRequest) {
  try {
    const user = await requireSession();
    if (!user) return fail("인증이 필요합니다", 401);

    const { searchParams } = req.nextUrl;
    const status = searchParams.get("status") ?? undefined;
    const scheduleId = searchParams.get("scheduleId") ?? undefined;

    // MEMBER can only see their own tasks
    const isDeaconPlus = hasRole(user.role, "DEACON");
    const assignedToFilter = isDeaconPlus
      ? searchParams.get("mine") === "true"
        ? { assignedToId: user.id }
        : {}
      : { assignedToId: user.id };

    const tasks = await prisma.task.findMany({
      where: {
        ...assignedToFilter,
        ...(status ? { status: status as any } : {}),
        ...(scheduleId ? { scheduleId } : {}),
      },
      select: taskSelect,
      orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
    });

    return ok(
      tasks.map((t) => ({
        ...t,
        deadline: t.deadline?.toISOString() ?? null,
        schedule: t.schedule
          ? {
              ...t.schedule,
              date: (t.schedule.date as Date).toISOString().split("T")[0],
            }
          : null,
      }))
    );
  } catch (err) {
    return handleError(err);
  }
}

// ── POST /api/tasks ───────────────────────────────────────────────────────────
const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  assignedToId: z.string().min(1),
  scheduleId: z.string().nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
});

export async function POST_tasks(req: NextRequest) {
  try {
    const user = await requireSession();
    if (!user) return fail("인증이 필요합니다", 401);
    if (!hasRole(user.role, "DEACON")) return fail("권한이 없습니다", 403);

    const body = createTaskSchema.parse(await req.json());

    const assignee = await prisma.user.findUnique({
      where: { id: body.assignedToId },
    });
    if (!assignee) return fail("사역자를 찾을 수 없습니다", 404);

    const task = await prisma.task.create({
      data: {
        title: body.title,
        description: body.description ?? null,
        assignedToId: body.assignedToId,
        assignedById: user.id,
        scheduleId: body.scheduleId ?? null,
        deadline: body.deadline ? new Date(body.deadline) : null,
      },
      select: taskSelect,
    });

    await createNotification(
      body.assignedToId,
      `새 업무 "${body.title}"이 배정되었습니다.`
    );

    return ok(
      {
        ...task,
        deadline: task.deadline?.toISOString() ?? null,
        schedule: task.schedule
          ? {
              ...task.schedule,
              date: (task.schedule.date as Date).toISOString().split("T")[0],
            }
          : null,
      },
      201
    );
  } catch (err) {
    return handleError(err);
  }
}

// ── GET /api/tasks/[id] ───────────────────────────────────────────────────────
export async function GET_task(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireSession();
    if (!user) return fail("인증이 필요합니다", 401);

    const task = await prisma.task.findUnique({
      where: { id: params.id },
      select: taskSelect,
    });
    if (!task) return fail("업무를 찾을 수 없습니다", 404);

    // MEMBER can only see own tasks
    if (!hasRole(user.role, "DEACON") && task.assignedTo.id !== user.id) {
      return fail("권한이 없습니다", 403);
    }

    return ok({
      ...task,
      deadline: task.deadline?.toISOString() ?? null,
      schedule: task.schedule
        ? {
            ...task.schedule,
            date: (task.schedule.date as Date).toISOString().split("T")[0],
          }
        : null,
    });
  } catch (err) {
    return handleError(err);
  }
}

// ── PATCH /api/tasks/[id] ─────────────────────────────────────────────────────
const patchTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  assignedToId: z.string().min(1).optional(),
  scheduleId: z.string().nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
});

export async function PATCH_task(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireSession();
    if (!user) return fail("인증이 필요합니다", 401);

    const task = await prisma.task.findUnique({
      where: { id: params.id },
      select: { id: true, title: true, assignedToId: true, assignedById: true },
    });
    if (!task) return fail("업무를 찾을 수 없습니다", 404);

    const isAssignee = task.assignedToId === user.id;
    const isDeaconPlus = hasRole(user.role, "DEACON");
    if (!isAssignee && !isDeaconPlus) return fail("권한이 없습니다", 403);

    const body = patchTaskSchema.parse(await req.json());

    // Assignee (MEMBER) can only change status
    const updateData: Record<string, unknown> = {};
    if (body.status !== undefined) updateData.status = body.status;

    if (isDeaconPlus) {
      if (body.title !== undefined) updateData.title = body.title;
      if (body.description !== undefined)
        updateData.description = body.description;
      if (body.assignedToId !== undefined)
        updateData.assignedToId = body.assignedToId;
      if (body.scheduleId !== undefined) updateData.scheduleId = body.scheduleId;
      if (body.deadline !== undefined)
        updateData.deadline = body.deadline ? new Date(body.deadline) : null;
    }

    const updated = await prisma.task.update({
      where: { id: params.id },
      data: updateData,
      select: taskSelect,
    });

    // Notify new assignee if reassigned
    if (isDeaconPlus && body.assignedToId && body.assignedToId !== task.assignedToId) {
      await createNotification(
        body.assignedToId,
        `업무 "${updated.title}"이 배정되었습니다.`
      );
    }

    return ok({
      ...updated,
      deadline: updated.deadline?.toISOString() ?? null,
      schedule: updated.schedule
        ? {
            ...updated.schedule,
            date: (updated.schedule.date as Date).toISOString().split("T")[0],
          }
        : null,
    });
  } catch (err) {
    return handleError(err);
  }
}

// ── DELETE /api/tasks/[id] ────────────────────────────────────────────────────
export async function DELETE_task(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireSession();
    if (!user) return fail("인증이 필요합니다", 401);
    if (!hasRole(user.role, "DEACON")) return fail("권한이 없습니다", 403);

    const task = await prisma.task.findUnique({
      where: { id: params.id },
      select: { id: true, assignedById: true },
    });
    if (!task) return fail("업무를 찾을 수 없습니다", 404);

    const isCreator = task.assignedById === user.id;
    const isAdmin = hasRole(user.role, "ADMIN");
    if (!isCreator && !isAdmin) return fail("권한이 없습니다", 403);

    await prisma.task.delete({ where: { id: params.id } });

    return ok({ id: params.id });
  } catch (err) {
    return handleError(err);
  }
}
