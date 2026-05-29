import { NextRequest } from "next/server";
import { GET_members, POST_members } from "@/lib/handlers/members";
export async function GET(req: NextRequest) { return GET_members(req); }
export async function POST(req: NextRequest) { return POST_members(req); }
