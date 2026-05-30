import { NextRequest } from "next/server";
import { POST_reject } from "@/lib/handlers/requests";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return POST_reject(req, { params: await params });
}
