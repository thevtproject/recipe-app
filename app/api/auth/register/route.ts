import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { data: null, error: "Email already registered" },
        { status: 409 }
      );
    }

    const hashed = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { name, email, password: hashed, isApproved: false },
      select: { id: true, email: true, name: true, isApproved: true, createdAt: true },
    });

    return NextResponse.json({ data: user, error: null }, { status: 201 });
  } catch (error) {
    console.error("[register] error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error" },
      { status: 500 }
    );
  }
}
