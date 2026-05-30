import { NextRequest } from "next/server";
import {
  prisma,
  ok,
  fail,
  handleError,
  requireSession,
} from "@/lib/api-helpers";

// 이번 주 (월요일 00:00 ~ 일요일 23:59) 범위 계산
function getWeekRange(now: Date): { start: Date; end: Date } {
  const day = now.getDay(); // 0 (Sun) ~ 6 (Sat)
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function GET(_req: NextRequest) {
  try {
    const user = await requireSession();
    if (!user) return fail("인증이 필요합니다", 401);

    const { start, end } = getWeekRange(new Date());

    const [pendingCount, acceptedTaskCount, dueSoonCount] = await Promise.all([
      prisma.request.count({
        where: { assigneeId: user.id, status: "PENDING" },
      }),
      prisma.task.count({
        where: {
          assignedToId: user.id,
          status: { in: ["TODO", "IN_PROGRESS", "REVIEW"] },
        },
      }),
      prisma.task.count({
        where: {
          assignedToId: user.id,
          status: { in: ["TODO", "IN_PROGRESS", "REVIEW"] },
          deadline: { gte: start, lte: end },
        },
      }),
    ]);

    return ok({
      pendingCount,
      acceptedTaskCount,
      dueSoonCount,
      pendingRequestCount: pendingCount,
      activeTaskCount: acceptedTaskCount,
      weeklyDeadlineCount: dueSoonCount,
    });
  } catch (err) {
    return handleError(err);
  }
}
