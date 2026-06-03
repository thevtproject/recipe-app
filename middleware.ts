import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const session = req.auth;
  const { nextUrl } = req;

  const isLoggedIn = !!session;
  const isAdmin = session?.user?.role === "ADMIN";

  const isAuthRoute =
    nextUrl.pathname.startsWith("/login") ||
    nextUrl.pathname.startsWith("/register");
  const isAppRoute =
    nextUrl.pathname.startsWith("/recipes") ||
    nextUrl.pathname.startsWith("/planner");
  const isAdminRoute = nextUrl.pathname.startsWith("/admin");

  // Redirect authenticated users away from auth pages
  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  // Protect app routes — require login
  if (isAppRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // Protect admin routes — require ADMIN role
  if (isAdminRoute && (!isLoggedIn || !isAdmin)) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|uploads).*)"],
};
