import { NextRequest } from "next/server";
import { GET_member, PATCH_member } from "@/lib/handlers/members";
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return GET_member(req, { params: await params });
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return PATCH_member(req, { params: await params });
}
