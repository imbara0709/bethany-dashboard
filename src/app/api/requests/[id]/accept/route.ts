import { NextRequest } from "next/server";
import { POST_accept } from "@/lib/handlers/requests";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return POST_accept(req, { params: await params });
}
