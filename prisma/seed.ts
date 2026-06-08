import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SALT_ROUNDS } from "../lib/password";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@family.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";
  const adminName = process.env.SEED_ADMIN_NAME ?? "Admin";

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log("Admin already exists:", adminEmail);
    return;
  }

  const hashed = await bcrypt.hash(adminPassword, SALT_ROUNDS);
  await prisma.user.create({
    data: {
      email: adminEmail,
      password: hashed,
      name: adminName,
      role: "ADMIN",
      isApproved: true,
    },
  });

  console.log("Admin user seeded:", adminEmail);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
