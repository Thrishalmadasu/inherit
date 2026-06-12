// Route protection (Next 16 proxy — the file formerly known as middleware).
// Everything requires a session except Clerk's own sign-in/sign-up routes.
//
// Deliberately NOT auth.protect(): in Next 16 proxies it resolves the sign-in
// URL from NEXT_PUBLIC_CLERK_SIGN_IN_URL at runtime and silently redirects to
// the *current* URL when unset (clerk/javascript#8302). The explicit redirect
// has no env dependency.
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// /dev-login is the DEV-ONLY ticket consumer (docs/HANDBOOK.md §7) — it must
// be reachable signed-out, and the page itself 404s outside `next dev`.
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/dev-login(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // Dev impersonation (handbook §7): under `next dev` only, the cookie set by
  // /dev-login stands in for a session; lib/auth.ts resolves the actual user.
  // Signed-out dev traffic goes to the /dev-login picker, NOT /sign-in —
  // Clerk dev instances bounce through *.clerk.accounts.dev on the sign-in
  // page, which headless/preview browsers (localhost-only) cannot follow.
  // Gates mirror lib/auth.isDevBypassEnabled (inlined: importing lib/auth
  // would pull the DB client into the proxy bundle): explicit opt-in env var
  // (gitignored .env.local only) + dev runtime + never on Vercel.
  const devBypass =
    process.env.DEV_AUTH_BYPASS === "1" &&
    process.env.NODE_ENV === "development" &&
    !process.env.VERCEL;
  if (devBypass) {
    if (req.cookies.has("dev-impersonate")) {
      // Clerk's own pages can't render under impersonation (the layout
      // mounts no ClerkProvider) — bounce them back into the app.
      if (isPublicRoute(req) && !req.nextUrl.pathname.startsWith("/dev-login"))
        return NextResponse.redirect(new URL("/", req.url));
      return;
    }
    if (isPublicRoute(req)) return;
    const { userId } = await auth();
    if (!userId) return NextResponse.redirect(new URL("/dev-login", req.url));
    return;
  }
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
