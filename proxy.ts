// Route protection (Next 16 proxy — the file formerly known as middleware).
// Everything requires a session except Clerk's own sign-in/sign-up routes.
//
// Deliberately NOT auth.protect(): in Next 16 proxies it resolves the sign-in
// URL from NEXT_PUBLIC_CLERK_SIGN_IN_URL at runtime and silently redirects to
// the *current* URL when unset (clerk/javascript#8302). The explicit redirect
// has no env dependency.
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;
  const { userId } = await auth();
  if (!userId) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("redirect_url", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(signInUrl);
  }
});

export const config = {
  matcher: [
    // All routes except Next internals and static assets…
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // …and always run for API + Clerk's own endpoints.
    "/(api|trpc)(.*)",
    "/__clerk(.*)",
  ],
};
