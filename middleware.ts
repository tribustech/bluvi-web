import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const protectedPaths = [
  "/dashboard",
  "/profile",
  "/organizer",
  "/create-competition",
  "/scale",
  "/raffle",
];

export default auth((request) => {
  const pathname = request.nextUrl.pathname;
  const isProtected = protectedPaths.some((value) => pathname.startsWith(value));

  if (isProtected && !request.auth) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
