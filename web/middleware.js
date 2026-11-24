import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const clerk = clerkMiddleware();

// The iPhone app (ios-app/) opens the site's home page; send it to the app's onboarding instead,
// which forwards paying accounts on to /jobs.
export default function middleware(req, event) {
  if (req.nextUrl.pathname === "/" && /PetesPostingsApp/.test(req.headers.get("user-agent") || "")) {
    return NextResponse.redirect(new URL("/onboarding", req.url));
  }
  return clerk(req, event);
}

export const config = {
  matcher: ["/((?!.*\\..*|_next|sitemap|robots|google).*)", "/", "/(api|trpc)(.*)"],
};
