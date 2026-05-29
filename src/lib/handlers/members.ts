// app/api/members/route.ts  (GET list, POST create)
// app/api/members/[id]/route.ts  (GET detail, PATCH update)

import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import {
  prisma,
  ok,
  fail,
  handleError,
  requireSession,
  hasRole,
  userSelect,
} from "@/lib/api-helpers";

// ── GET /api/members ──────────────────────────────────────────────────────────
export async function GET_members(req: NextRequest) {
  try {
    const user = await requireSession();
    if (!user) return fail("인증이 필요합니다", 401);

    const { searchParams } = req.nextUrl;
    const role = searchParams.get("role") ?? undefined;
    const team = searchParams.get("team") ?? undefined;

    const members = await prisma.user.findMany({
      where: {
        ...(role ? { role: role as any } : {}),
        ...(team ? { team } : {}),
      },
      select: userSelect,
      orderBy: { name: "asc" },
    });

    return ok(members);
  } catch (err) {
    return handleError(err);
  }
}

// ── POST /api/members ─────────────────────────────────────────────────────────
const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().nullable().optional(),
  role: z.enum(["PASTOR", "TRAINEE", "FULLTIME", "PARTTIME", "ADMIN"]).default("PARTTIME"),
  team: z.string().nullable().optional(),
});

export async function POST_members(req: NextRequest) {
  try {
    const user = await requireSession();
    if (!user) return fail("인증이 필요합니다", 401);
    if (!hasRole(user.role, "ADMIN")) return fail("권한이 없습니다", 403);

    const body = createSchema.parse(await req.json());
    const hashed = await bcrypt.hash(body.password, 12);

    const member = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        password: hashed,
        phone: body.phone ?? null,
        role: body.role,
        team: body.team ?? null,
      },
      select: userSelect,
    });

    return ok(member, 201);
  } catch (err) {
    return handleError(err);
  }
}

// ── GET /api/members/[id] ─────────────────────────────────────────────────────
export async function GET_member(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireSession();
    if (!user) return fail("인증이 필요합니다", 401);

    const member = await prisma.user.findUnique({
      where: { id: params.id },
      select: userSelect,
    });
    if (!member) return fail("사역자를 찾을 수 없습니다", 404);

    return ok(member);
  } catch (err) {
    return handleError(err);
  }
}

// ── PATCH /api/members/[id] ───────────────────────────────────────────────────
const patchSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  role: z.enum(["PASTOR", "TRAINEE", "FULLTIME", "PARTTIME", "ADMIN"]).optional(),
  team: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH_member(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireSession();
    if (!user) return fail("인증이 필요합니다", 401);

    const isSelf = user.id === params.id;
    const isAdmin = hasRole(user.role, "ADMIN");
    if (!isSelf && !isAdmin) return fail("권한이 없습니다", 403);

    const body = patchSchema.parse(await req.json());

    // Non-admin can only update name and phone
    const allowedData: Record<string, unknown> = {};
    if (body.name !== undefined) allowedData.name = body.name;
    if (body.phone !== undefined) allowedData.phone = body.phone;
    if (isAdmin) {
      if (body.role !== undefined) allowedData.role = body.role;
      if (body.team !== undefined) allowedData.team = body.team;
      if (body.isActive !== undefined) allowedData.isActive = body.isActive;
    }

    const existing = await prisma.user.findUnique({ where: { id: params.id } });
    if (!existing) return fail("사역자를 찾을 수 없습니다", 404);

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: allowedData,
      select: userSelect,
    });

    return ok(updated);
  } catch (err) {
    return handleError(err);
  }
}
