// QA-only seed: 3 dummy users for security audit (unapproved, user, admin).
// Idempotent — safe to re-run. Cleans up at the end via separate script.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SALT_ROUNDS } from "../lib/password";

const prisma = new PrismaClient();

const TEST_USERS = [
  {
    email: "qa-unapproved@family.local",
    name: "QA Unapproved",
    role: "USER" as const,
    isApproved: false,
  },
  {
    email: "qa-user@family.local",
    name: "QA User",
    role: "USER" as const,
    isApproved: true,
  },
  {
    email: "qa-admin@family.local",
    name: "QA Admin",
    role: "ADMIN" as const,
    isApproved: true,
  },
];

const TEST_PASSWORD = "QaAudit!2026-test"; // Meets strength: 8+, mixed, not in top-100

async function main() {
  const hashed = await bcrypt.hash(TEST_PASSWORD, SALT_ROUNDS);
  for (const u of TEST_USERS) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) {
      // Update to desired state (idempotent for re-runs)
      await prisma.user.update({
        where: { email: u.email },
        data: {
          name: u.name,
          role: u.role,
          isApproved: u.isApproved,
          password: hashed,
        },
      });
      console.log(`Updated: ${u.email} (${u.role}, approved=${u.isApproved})`);
    } else {
      await prisma.user.create({
        data: {
          email: u.email,
          name: u.name,
          password: hashed,
          role: u.role,
          isApproved: u.isApproved,
        },
      });
      console.log(`Created: ${u.email} (${u.role}, approved=${u.isApproved})`);
    }
  }
  console.log(`\nTest password (do not commit): ${TEST_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
