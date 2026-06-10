// QA seed — runs on host with project's node_modules. Uses DATABASE_URL from .env.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env") });
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Low rounds for speed during seed; rehashIfNeeded on first login bumps to 14.
const HASH_ROUNDS = 4;
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || "QaAudit-7hX2p9!Qz";

const prisma = new PrismaClient();
const TEST_USERS = [
  { email: "qa-unapproved@family.local", name: "QA Unapproved", role: "USER" as const, isApproved: false },
  { email: "qa-user@family.local",        name: "QA User",        role: "USER" as const, isApproved: true  },
  { email: "qa-admin@family.local",       name: "QA Admin",       role: "ADMIN" as const, isApproved: true },
];

async function main() {
  const hashed = await bcrypt.hash(TEST_PASSWORD, HASH_ROUNDS);
  for (const u of TEST_USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      create: { ...u, password: hashed },
      update: { name: u.name, role: u.role, isApproved: u.isApproved, password: hashed },
    });
    console.log(`OK ${u.email} (${u.role}, approved=${u.isApproved})`);
  }
  console.log("---");
  console.log(`Password: ${TEST_PASSWORD}`);
  console.log(`Hash rounds used for seed: ${HASH_ROUNDS} (rehashIfNeeded will bump to 14 on first login)`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
