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
  // Prisma known request errors (P2002: unique, P2003: FK)
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code?: string }).code;
    if (code === "P2003") {
      console.error("[Prisma P2003 FK constraint]", err);
      return fail("참조하는 데이터가 존재하지 않습니다", 400);
    }
    if (code === "P2002") {
      console.error("[Prisma P2002 unique constraint]", err);
      return fail("이미 존재하는 데이터입니다", 409);
    }
  }
  console.error("[API Error]", err);
  return fail("서버 내부 오류", 500);
}

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user as {
    id: string;
    name: string;
    email: string;
    role: string;
    team: string | null;
  };
}

const ROLE_RANK: Record<string, number> = {
  MEMBER:   0,
  PARTTIME: 0,
  FULLTIME: 1,
  TRAINEE:  2,
  DEACON:   2,
  PASTOR:   3,
  ADMIN:    4,
};

export function hasRole(userRole: string, required: string): boolean {
  return (ROLE_RANK[userRole] ?? -1) >= (ROLE_RANK[required] ?? 0);
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
  avatar: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;
