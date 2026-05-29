import { PATCH_notifications_read_all } from "@/lib/handlers/notifications";
export async function PATCH(req: Request) { return PATCH_notifications_read_all(req); }
