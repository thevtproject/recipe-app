import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from 'bcryptjs';
import { SALT_ROUNDS } from '@/lib/password';
import { z } from "zod";
import { checkPasswordStrength } from "@/lib/password";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export async function POST(req: NextRequest) {
  // Rate limit: 5 registrations per IP per 15 minutes.
  // Blocks spam, allows a user to retry after typos.
  const ip = getClientIp(req);
  const rl = rateLimit("authRegister", ip);
  if (!rl.ok) {
    return NextResponse.json(
      { data: null, error: `Too many registration attempts. Try again in ${rl.retryAfterSec}s.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

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

    // Password strength gate — top-100 common list, complexity check, length.
    const pw = checkPasswordStrength(password);
    if (!pw.ok) {
      return NextResponse.json({ data: null, error: pw.reason }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Run a dummy bcrypt.hash so the response time matches the success path
      // (avoids a timing oracle that reveals whether an email is registered).
      await bcrypt.hash(password, SALT_ROUNDS);
      return NextResponse.json(
        { data: null, error: "Email already registered" },
        { status: 409 }
      );
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

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
