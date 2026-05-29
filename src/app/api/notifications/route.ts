import { GET_notifications } from "@/lib/handlers/notifications";
export async function GET(req: Request) { return GET_notifications(req); }
