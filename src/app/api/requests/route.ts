import { NextRequest } from "next/server";
import { GET_requests, POST_requests } from "@/lib/handlers/requests";

export async function GET(req: NextRequest) {
  return GET_requests(req);
}
export async function POST(req: NextRequest) {
  return POST_requests(req);
}
