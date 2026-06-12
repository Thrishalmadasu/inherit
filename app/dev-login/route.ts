// DEV-ONLY impersonation switch (handbook §7). Hard 404 unless EVERY gate in
// lib/auth.isDevBypassEnabled holds (explicit DEV_AUTH_BYPASS=1 opt-in from
// gitignored .env.local + NODE_ENV=development + not on Vercel) — and the
// cookie this sets is only honored behind those same gates.
//
//   /dev-login                               → picker (click a seeded user)
//   /dev-login?as=<seeded users.sst_email>   → impersonate (validates the row)
//   /dev-login?off                           → back to real auth
//
// Deliberately Clerk-free: in dev, signed-out traffic lands HERE (proxy.ts)
// because Clerk dev instances bounce the sign-in page through
// *.clerk.accounts.dev, which headless/preview browsers can't follow.
import { NextResponse, type NextRequest } from "next/server";
import { db, schema as s } from "@/lib/db";
import { DEV_IMPERSONATE_COOKIE, isDevBypassEnabled } from "@/lib/auth";

export async function GET(req: NextRequest) {
  if (!isDevBypassEnabled()) return new NextResponse(null, { status: 404 });

  const home = NextResponse.redirect(new URL("/", req.url));

  if (req.nextUrl.searchParams.has("off")) {
    home.cookies.delete(DEV_IMPERSONATE_COOKIE);
    return home;
  }

  const rows = await db
    .select({ email: s.users.sstEmail, name: s.users.name, role: s.users.role })
    .from(s.users)
    .orderBy(s.users.sstEmail);

  const as = req.nextUrl.searchParams.get("as")?.toLowerCase();
  const match = as ? rows.find((r) => r.email === as) : undefined;
  if (match) {
    home.cookies.set(DEV_IMPERSONATE_COOKIE, match.email, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    return home;
  }

  const items = rows
    .map(
      (r) =>
        `<li><a href="/dev-login?as=${encodeURIComponent(r.email)}">${r.name}</a>` +
        ` — ${r.email} <code>${r.role}</code></li>`,
    )
    .join("\n");
  return new NextResponse(
    `<!doctype html><html><head><title>Dev login</title></head>
<body style="font:14px/1.6 system-ui;max-width:640px;margin:48px auto;color:#ddd;background:#0d121d">
<h1 style="font-size:18px">Dev impersonation${as ? ` — <code>${as}</code> not found` : ""}</h1>
<p>Pick a seeded user (dev only; production always uses Clerk):</p>
<ul>${items}</ul>
<p><a href="/dev-login?off">Stop impersonating</a></p>
<p style="color:#888">For real Clerk sign-in open <code>/sign-in</code> in a normal browser —
inside the preview pane it dead-ends (Clerk dev instances redirect through
clerk.accounts.dev, and the preview only allows localhost).</p>
</body></html>`,
    { status: as ? 404 : 200, headers: { "content-type": "text/html" } },
  );
}
