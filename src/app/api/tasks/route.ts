import { NextRequest } from "next/server";
import { GET_tasks, POST_tasks } from "@/lib/handlers/tasks";
export async function GET(req: NextRequest) { return GET_tasks(req); }
export async function POST(req: NextRequest) { return POST_tasks(req); }
