// lib/api-helpers.ts — shared utilities for all API routes

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export { prisma } from "@/lib/db";

export type ApiResponse<T> = {
  success: boolean;
  data: T | null;
  error: string | null;
};

export function ok<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data, error: null }, { status });
}

export function fail(
  message: string,
  status: number
): NextResponse<ApiResponse<null>> {
  return NextResponse.json(
    { success: false, data: null, error: message },
    { status }
  );
}

export function handleError(err: unknown): NextResponse<ApiResponse<null>> {
  if (err instanceof ZodError) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return fail((err as any).errors?.[0]?.message ?? "입력값 오류", 400);
  }
  console.error(err);
  return fail("서버 내부 오류", 500);
}

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user as {
    id: string;
    name: string;
    email: string;
    role: "MEMBER" | "DEACON" | "PASTOR" | "ADMIN";
    team: string | null;
  };
}

const ROLE_RANK = { MEMBER: 0, DEACON: 1, PASTOR: 2, ADMIN: 3 } as const;

export function hasRole(
  userRole: "MEMBER" | "DEACON" | "PASTOR" | "ADMIN",
  required: "MEMBER" | "DEACON" | "PASTOR" | "ADMIN"
): boolean {
  return ROLE_RANK[userRole] >= ROLE_RANK[required];
}

export async function createNotification(userId: string, message: string) {
  await prisma!.notification.create({ data: { userId, message } });
}

export const userSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  team: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;
