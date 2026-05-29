import { NextRequest } from "next/server";
import { GET_task, PATCH_task, DELETE_task } from "@/lib/handlers/tasks";
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return GET_task(req, { params: await params });
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return PATCH_task(req, { params: await params });
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return DELETE_task(req, { params: await params });
}
