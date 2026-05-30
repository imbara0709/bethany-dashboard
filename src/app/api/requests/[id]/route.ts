import { NextRequest } from "next/server";
import {
  GET_request,
  PATCH_request,
  DELETE_request,
} from "@/lib/handlers/requests";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return GET_request(req, { params: await params });
}
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return PATCH_request(req, { params: await params });
}
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return DELETE_request(req, { params: await params });
}
