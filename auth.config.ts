import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config — no Node.js-only deps (Prisma, bcrypt).
 * Used by middleware (edge runtime). The full DB-aware config lives
 * in `lib/auth.ts`.
 */
export const authConfig: NextAuthConfig = {
  trustHost: true, // Behind Cloudflare Tunnel — host header comes from edge
  providers: [], // Filled in lib/auth.ts (Node.js)
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.isApproved = (user as any).isApproved;
        token.householdId = (user as any).householdId ?? null;
        token.hasBabyPlanner = (user as any).hasBabyPlanner ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).isApproved = token.isApproved;
        (session.user as any).householdId = token.householdId ?? null;
        (session.user as any).hasBabyPlanner = token.hasBabyPlanner ?? false;
      }
      return session;
    },
  },
};
