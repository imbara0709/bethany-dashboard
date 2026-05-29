import { NextRequest } from "next/server";
import { GET_schedule, PUT_schedule, DELETE_schedule } from "@/lib/handlers/schedules";
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return GET_schedule(req, { params: await params });
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return PUT_schedule(req, { params: await params });
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return DELETE_schedule(req, { params: await params });
}
