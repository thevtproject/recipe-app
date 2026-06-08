import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { rehashIfNeeded } from "@/lib/password";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        // Rate limit on login. Two keys:
        //   - per-IP: 10/5min — blocks broad credential-stuffing from one
        //     attacker machine
        //   - per-email: 10/5min — blocks spraying against a single account
        // A request that exceeds either bucket is rejected.
        const ip = (request as Request | undefined)
          ? getClientIp(request as Request)
          : "unknown";
        const ipCheck = rateLimit("authLogin", `ip:${ip}`);
        if (!ipCheck.ok) {
          throw new Error(
            `RATE_LIMITED:Too many login attempts from this network. Try again in ${ipCheck.retryAfterSec}s.`
          );
        }
        const emailCheck = rateLimit("authLogin", `email:${email.toLowerCase()}`);
        if (!emailCheck.ok) {
          throw new Error(
            `RATE_LIMITED:Too many attempts for this account. Try again in ${emailCheck.retryAfterSec}s.`
          );
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        // Generic null on missing user — same as bad password, to avoid
        // account enumeration via timing/response.
        if (!user) return null;

        const passwordValid = await bcrypt.compare(password, user.password);
        if (!passwordValid) return null;

        // Transparent rehash: if SALT_ROUNDS has been bumped since this user's
        // hash was created, re-hash at the new cost on successful login.
        // Best-effort — if the write fails, login still succeeds and we retry
        // on the next sign-in.
        rehashIfNeeded(user.password, password)
          .then((newHash) => {
            if (newHash) {
              return prisma.user.update({
                where: { id: user.id },
                data: { password: newHash },
              });
            }
          })
          .catch((err) => console.error("Password rehash failed:", err));

        if (!user.isApproved) {
          throw new Error("ACCOUNT_PENDING_APPROVAL");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isApproved: user.isApproved,
          householdId: user.householdId,
          hasBabyPlanner: user.hasBabyPlanner,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    /**
     * Override the edge-safe `jwt` callback to refresh from DB when the
     * client calls `update()` (e.g. after creating/joining a household,
     * or after the admin flips a flag). Without this, the JWT carries
     * stale householdId / role / isApproved for the whole 30-day window.
     */
    async jwt({ token, user, trigger }) {
      // First sign-in — populate from authorize() return
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.isApproved = (user as any).isApproved;
        token.householdId = (user as any).householdId ?? null;
        token.hasBabyPlanner = (user as any).hasBabyPlanner ?? false;
        return token;
      }

      // Client-triggered refresh (useSession().update() or signIn event)
      if (trigger === "update" && token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { householdId: true, role: true, isApproved: true, hasBabyPlanner: true },
        });
        if (fresh) {
          token.householdId = fresh.householdId;
          token.role = fresh.role;
          token.isApproved = fresh.isApproved;
          token.hasBabyPlanner = fresh.hasBabyPlanner;
        }
      }
      return token;
    },
  },
});
