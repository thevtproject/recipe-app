import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { SALT_ROUNDS } from "@/lib/password";
import { z } from "zod";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import crypto from "crypto";

// Auth guard helper
async function requireAdmin() {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return null;
  }
  return session;
}

const schema = z.object({
  userId: z.string(),
});

/**
 * Generate a random temporary password: 4 words from a small list,
 * separated by hyphens, with a digit appended. Easy to read aloud,
 * hard to guess. ~40 bits of entropy.
 */
function generateTempPassword(): string {
  const words = [
    "apple", "baker", "cedar", "dance", "eagle", "flame", "grape", "house",
    "ivory", "jolly", "knife", "lemon", "maple", "north", "ocean", "piano",
    "queen", "river", "stone", "tiger", "ultra", "vivid", "water", "xerox",
    "young", "zebra", "amber", "brick", "cloud", "dream", "ember", "frost",
    "ghost", "honey", "ivory", "jewel", "kayak", "lunar", "mango", "noble",
    "olive", "pearl", "quiet", "robin", "solar", "tulip", "unity", "vapor",
  ];
  const pick = () => words[crypto.randomInt(words.length)]!;
  const digit = crypto.randomInt(10);
  return `${pick()}-${pick()}-${pick()}-${digit}`;
}

// POST /api/admin/reset-password — generate a temporary password for a user
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 });
  }

  // Rate limit: 10 resets per admin per hour
  const ip = getClientIp(req);
  const rl = rateLimit("passwordChange", `admin-reset:${ip}`);
  if (!rl.ok) {
    return NextResponse.json(
      { data: null, error: `Too many resets. Try again in ${rl.retryAfterSec}s.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { userId } = parsed.data;
  const actingAdminId = (session.user as any).id as string;

  // Cannot reset own password via this endpoint
  if (userId === actingAdminId) {
    return NextResponse.json(
      { data: null, error: "Cannot reset your own password. Use the profile page." },
      { status: 400 }
    );
  }

  // Verify target user exists
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!target) {
    return NextResponse.json({ data: null, error: "User not found" }, { status: 404 });
  }

  // Generate and hash the temp password
  const tempPassword = generateTempPassword();
  const hashed = await bcrypt.hash(tempPassword, SALT_ROUNDS);

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashed },
  });

  // Return the plaintext temp password — shown once to admin, never stored
  return NextResponse.json({
    data: {
      userId: target.id,
      name: target.name,
      email: target.email,
      tempPassword,
    },
    error: null,
  });
}
