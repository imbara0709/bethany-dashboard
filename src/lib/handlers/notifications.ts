import { prisma, ok, fail, handleError, requireSession } from "@/lib/api-helpers";

// GET /api/notifications?unread=true
export async function GET_notifications(req: Request) {
  try {
    const user = await requireSession();
    if (!user) return fail("인증이 필요합니다.", 401);
    const url = new URL(req.url);
    const unreadOnly = url.searchParams.get("unread") === "true";

    const notifications = await prisma.notification.findMany({
      where: {
        userId: user.id,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return ok(notifications);
  } catch (e) {
    return handleError(e);
  }
}

// GET /api/notifications/count
export async function GET_notifications_count(req: Request) {
  try {
    const user = await requireSession();
    if (!user) return fail("인증이 필요합니다.", 401);

    const count = await prisma.notification.count({
      where: { userId: user.id, isRead: false },
    });

    return ok({ unreadCount: count });
  } catch (e) {
    return handleError(e);
  }
}

// PATCH /api/notifications/[id] — mark single as read
export async function PATCH_notification(req: Request, id: string) {
  try {
    const user = await requireSession();
    if (!user) return fail("인증이 필요합니다.", 401);

    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) return fail("알림을 찾을 수 없습니다.", 404);
    if (notification.userId !== user.id) return fail("접근 권한이 없습니다.", 403);

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}

// PATCH /api/notifications/read-all — mark all as read
export async function PATCH_notifications_read_all(req: Request) {
  try {
    const user = await requireSession();
    if (!user) return fail("인증이 필요합니다.", 401);

    const result = await prisma.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true },
    });

    return ok({ count: result.count });
  } catch (e) {
    return handleError(e);
  }
}
