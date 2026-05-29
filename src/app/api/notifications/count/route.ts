import { GET_notifications_count } from "@/lib/handlers/notifications";
export async function GET(req: Request) { return GET_notifications_count(req); }
