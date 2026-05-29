import { NextRequest } from "next/server";
import { GET_schedules, POST_schedules } from "@/lib/handlers/schedules";
export async function GET(req: NextRequest) { return GET_schedules(req); }
export async function POST(req: NextRequest) { return POST_schedules(req); }
