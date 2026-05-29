import { PATCH_notification } from "@/lib/handlers/notifications";
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return PATCH_notification(req, id);
}
