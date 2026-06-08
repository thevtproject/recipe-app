import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

// Edge-safe NextAuth instance (no Prisma, no bcrypt)
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const session = req.auth;
  const { nextUrl } = req;

  const isLoggedIn = !!session;
  const isAdmin = session?.user?.role === "ADMIN";

  const isAuthRoute =
    nextUrl.pathname.startsWith("/login") ||
    nextUrl.pathname.startsWith("/register");
  const isAppRoute =
    nextUrl.pathname.startsWith("/dashboard") ||
    nextUrl.pathname.startsWith("/recipes") ||
    nextUrl.pathname.startsWith("/profile") ||
    nextUrl.pathname.startsWith("/favorites");
  // /planner/share/* is public (token-based access); other /planner routes are auth-gated
  const isPublicPlannerShare = /^\/planner\/share\/[^/]+$/.test(nextUrl.pathname);
  const isProtectedPlanner =
    nextUrl.pathname.startsWith("/planner") && !isPublicPlannerShare;
  const isAdminRoute = nextUrl.pathname.startsWith("/admin");

  // Redirect authenticated users away from auth pages
  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  // Protect app routes — require login
  if ((isAppRoute || isProtectedPlanner) && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // Protect admin routes — require ADMIN role
  if (isAdminRoute) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", nextUrl));
    }
    if (!isAdmin) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|uploads).*)"],
};
