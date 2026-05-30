// app/api/schedules/route.ts  (GET list, POST create)
// app/api/schedules/[id]/route.ts  (GET detail, PUT update, DELETE)

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

const scheduleSelect = {
  id: true,
  title: true,
  type: true,
  date: true,
  endDate: true,
  startTime: true,
  endTime: true,
  location: true,
  description: true,
  createdById: true,
  createdBy: { select: { id: true, name: true } },
} as const;

// ── GET /api/schedules ────────────────────────────────────────────────────────
export async function GET_schedules(req: NextRequest) {
  try {
    const user = await requireSession();
    if (!user) return fail("인증이 필요합니다", 401);

    const { searchParams } = req.nextUrl;
    const year = searchParams.get("year");
    const month = searchParams.get("month");
    const type = searchParams.get("type") ?? undefined;

    let dateFilter = {};
    if (year && month) {
      const start = new Date(Number(year), Number(month) - 1, 1);
      const end = new Date(Number(year), Number(month), 0);
      dateFilter = { date: { gte: start, lte: end } };
    }

    const schedules = await prisma.schedule.findMany({
      where: {
        ...dateFilter,
        ...(type ? { type: type as any } : {}),
      },
      select: scheduleSelect,
      orderBy: { date: "asc" },
    });

    return ok(
      schedules.map((s) => ({
        ...s,
        date: s.date.toISOString().split("T")[0],
        endDate: s.endDate ? (s.endDate as Date).toISOString().split("T")[0] : null,
      }))
    );
  } catch (err) {
    return handleError(err);
  }
}

// ── POST /api/schedules ───────────────────────────────────────────────────────
const CATEGORIES = ["INFANT", "KINDER", "ELEM1", "ELEM2", "ELEM3", "YOUTH", "EDU", "BABY", "WORSHIP_EDU", "MAIN"] as const;

const scheduleSchema = z.object({
  title: z.string().min(1),
  type: z.enum(CATEGORIES),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  location: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

const updateScheduleSchema = scheduleSchema.partial();

export async function POST_schedules(req: NextRequest) {
  try {
    const user = await requireSession();
    if (!user) return fail("인증이 필요합니다", 401);

    const body = scheduleSchema.parse(await req.json());

    const schedule = await prisma.schedule.create({
      data: {
        title: body.title,
        type: body.type,
        date: new Date(body.date),
        endDate: body.endDate ? new Date(body.endDate) : null,
        startTime: body.startTime ?? null,
        endTime: body.endTime ?? null,
        location: body.location ?? null,
        description: body.description ?? null,
        createdById: user.id,
      },
      select: scheduleSelect,
    });

    return ok({
      ...schedule,
      date: (schedule.date as Date).toISOString().split("T")[0],
      endDate: schedule.endDate ? (schedule.endDate as Date).toISOString().split("T")[0] : null,
    }, 201);
  } catch (err) {
    return handleError(err);
  }
}

// ── GET /api/schedules/[id] ───────────────────────────────────────────────────
export async function GET_schedule(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireSession();
    if (!user) return fail("인증이 필요합니다", 401);

    const schedule = await prisma.schedule.findUnique({
      where: { id: params.id },
      select: {
        ...scheduleSelect,
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,
            assignedTo: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!schedule) return fail("일정을 찾을 수 없습니다", 404);

    return ok({
      ...schedule,
      date: (schedule.date as Date).toISOString().split("T")[0],
      endDate: schedule.endDate ? (schedule.endDate as Date).toISOString().split("T")[0] : null,
    });
  } catch (err) {
    return handleError(err);
  }
}

// ── PUT /api/schedules/[id] ───────────────────────────────────────────────────
export async function PUT_schedule(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireSession();
    if (!user) return fail("인증이 필요합니다", 401);

    const existing = await prisma.schedule.findUnique({
      where: { id: params.id },
      include: {
        tasks: { select: { assignedToId: true } },
      },
    });
    if (!existing) return fail("일정을 찾을 수 없습니다", 404);

    const isCreator = existing.createdById === user.id;
    const isPastorPlus = hasRole(user.role, "PASTOR");
    if (!isCreator && !isPastorPlus) return fail("권한이 없습니다", 403);

    const body = updateScheduleSchema.parse(await req.json());

    const updated = await prisma.schedule.update({
      where: { id: params.id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.type !== undefined && { type: body.type }),
        ...(body.date !== undefined && { date: new Date(body.date) }),
        ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate) : null }),
        ...(body.startTime !== undefined && { startTime: body.startTime }),
        ...(body.endTime !== undefined && { endTime: body.endTime }),
        ...(body.location !== undefined && { location: body.location ?? null }),
        ...(body.description !== undefined && { description: body.description ?? null }),
      },
      select: scheduleSelect,
    });

    // Notify task assignees about schedule change
    const assigneeIds = [...new Set(existing.tasks.map((t: { assignedToId: string }) => t.assignedToId))];
    await Promise.all(
      assigneeIds.map((id) =>
        createNotification(
          id,
          `일정 "${existing.title}"이 수정되었습니다.`
        )
      )
    );

    return ok({
      ...updated,
      date: (updated.date as Date).toISOString().split("T")[0],
      endDate: updated.endDate ? (updated.endDate as Date).toISOString().split("T")[0] : null,
    });
  } catch (err) {
    return handleError(err);
  }
}

// ── DELETE /api/schedules/[id] ────────────────────────────────────────────────
export async function DELETE_schedule(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireSession();
    if (!user) return fail("인증이 필요합니다", 401);

    const existing = await prisma.schedule.findUnique({
      where: { id: params.id },
      include: {
        tasks: { select: { assignedToId: true } },
      },
    });
    if (!existing) return fail("일정을 찾을 수 없습니다", 404);

    const isCreator = existing.createdById === user.id;
    const isPastorPlus = hasRole(user.role, "PASTOR");
    if (!isCreator && !isPastorPlus) return fail("권한이 없습니다", 403);

    // Notify task assignees before deletion
    const assigneeIds = [...new Set(existing.tasks.map((t: { assignedToId: string }) => t.assignedToId))];
    await Promise.all(
      assigneeIds.map((id) =>
        createNotification(
          id,
          `일정 "${existing.title}"이 삭제되었습니다.`
        )
      )
    );

    await prisma.schedule.delete({ where: { id: params.id } });

    return ok({ id: params.id });
  } catch (err) {
    return handleError(err);
  }
}
