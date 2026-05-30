import { NextRequest } from "next/server";
import { POST_hold } from "@/lib/handlers/requests";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return POST_hold(req, { params: await params });
}
