# Inherit — Maintainer's Handbook (KT)

> Living document. Last updated **2026-06-12** after Session 4 (invite-to-share outreach).
> Read this top-to-bottom once and you can maintain, extend, and explain the system.

---

## 1. What this is

**Inherit** is SST's placement-intelligence platform: a gated, searchable knowledge base
where students share structured placement experiences (OAs, interviews, offers) so the
next person interviewing at a company walks in with the batch's collective intelligence.

- **Live:** https://inherit-three.vercel.app
- **PRD:** `../PRD-SST-Placement-Intelligence.md` (repo root) — the product contract
- **Design source of truth:** `../Inherit Rough Design/` (prototype JSX + screenshots)
- **Build plan / decisions log:** kept in the build session plan; key decisions repeated here

---

## 2. Current status — one table

| Area | Status | Notes |
|---|---|---|
| All 10 screens, pixel-faithful to design | ✅ **Live** | Tailwind 4 rebuild of prototype |
| Postgres schema (full PRD §9, 16 tables) | ✅ **Live on Neon** | incl. audit tables, constraints |
| Read paths (dashboard, companies, company, experience, feed, search) | ✅ **Real DB** | funnel + topics computed from rows |
| Share form (5 steps, block-composed rounds, curated tags, autosave) | ✅ **Live** | submits via Server Action; drafts still localStorage |
| My Posts / Under Review / Ops queue | ✅ **Real DB** | tabs, statuses, FIFO queue, all actions write rows |
| Ops users tab | ✅ UI complete | still hardcoded; role management is a later session |
| Auth (Clerk, `@sst.scaler.com` gate) | ✅ **Live** | users mirrored to DB; `/ops` gated by **DB role** ∪ `OPS_EMAILS` (§7) |
| Write loop (submit → moderate → publish → hide/delete/withdraw) | ✅ **Live** | Zod + Server Actions + one-batch transactions; invariant test in `db/verify-write-loop.ts` |
| Helpful votes / views / saves (persisted) | ✅ **Live** | Server Actions; cached counts move atomically with the rows; views = total detail-page opens; Saved tab on /me |
| Invite-to-share (CSV outreach) | ✅ **Live** (send-only V1) | PRD §7 Flow F; email dispatch behind the `EmailSender` console stub |
| Email (Resend) + L&D Sheets sync | ⏳ Not started | `EmailSender` interface exists (`lib/email.ts`, console stub); Resend swap + Sheets are next |

**The one-sentence status:** *the full loop is real — a student submits, Ops moderates
(FIFO), the post publishes, every author/moderator state (needs-edits, reject,
hide, delete, withdraw, edit→re-review) round-trips through Postgres, reader
engagement (Helpful votes, saves, views) persists with it, and Ops can batch-invite
interviewees from a CSV (deduped, audited; the email itself is stubbed until Resend).*

---

## 3. Tech stack & why (for the tech team)

| Layer | Choice | Why (short) |
|---|---|---|
| Framework | **Next.js 16** (App Router) + TypeScript | One tool for UI + server; Server Components for reads, Server Actions (upcoming) for writes |
| Database | **PostgreSQL on Neon** | Deeply relational data (experience→rounds→blocks→tags); Neon = serverless + free tier + DB branching |
| ORM | **Drizzle** + drizzle-kit | Type-safe end-to-end, SQL-transparent, no runtime engine |
| Styling | **Tailwind 4** with design tokens extracted from the prototype CSS | Utility classes driven by the token system in `app/globals.css` `@theme` |
| UI behavior | **Radix UI** (so far: Dialog) wrapped in `components/ui/*` | Unstyled a11y primitives; we bring the look |
| Auth | **Clerk** (`@clerk/nextjs` v7), domain-gated to `@sst.scaler.com` | Domain restriction is one setting; no auth code to own (details: §7) |
| Hosting | **Vercel** (project `inherit`) | Zero-config Next deploys, preview per PR |

**Versions:** Next 16.2.7 · React 19 · Tailwind 4 · Drizzle latest · Node 24.

### Next.js 16 gotchas (memorize these three)
1. `params`/`searchParams` are **Promises** — `const { slug } = await props.params`,
   typed via the generated `PageProps<'/route'>` helper.
2. `middleware.ts` is renamed **`proxy.ts`** (matters when adding Clerk).
3. Turbopack is the default bundler; `npm run build` runs it.

---

## 4. Codebase tour

```
web/
├─ proxy.ts                   # ★ route protection (Next 16 middleware) — see §7
├─ app/                       # routes (App Router)
│  ├─ page.tsx                # Dashboard — async server component (DB)
│  ├─ layout.tsx              # ClerkProvider + domain gate + user mirror (§7)
│  ├─ sign-in|sign-up/        # Clerk catch-all routes, token-themed
│  ├─ companies/page.tsx      #   + [slug]/page.tsx — DB-backed
│  ├─ experiences/[id]/page.tsx  # DB-backed, 404s on unknown id
│  ├─ feed/page.tsx           # DB-backed
│  ├─ search/page.tsx         # DB-backed (client-side filtering)
│  ├─ share/page.tsx          # 5-step form; ?edit=<id> prefills from DB (author-gated)
│  ├─ me/page.tsx             # My Posts — real rows, all states + Saved tab
│  ├─ under-review/page.tsx   # author's actual pending post + edit/withdraw
│  ├─ actions/                # ★ Server Action endpoints ("use server"): thin
│  │                          #   auth wrappers around lib/write/* cores
│  └─ ops/                    # layout = DB-role ∪ OPS_EMAILS gate; queue + invite real; users mock
├─ components/
│  ├─ ui/                     # primitive layer: pill, button, chip, stat-card,
│  │                          #   funnel, topics-list, experience-card, select, modal
│  ├─ share/                  # share-form, round-editor (block editor), tag-input
│  ├─ me/my-posts-view.tsx    # client half of My Posts (tabs, draft row, actions)
│  ├─ under-review/           # pending-actions (edit/withdraw buttons)
│  ├─ ops/ops-shell.tsx       # Ops chrome (client half of the gated layout)
│  ├─ ops/queue-view.tsx      # moderation queue UI: approve/edits/reject/hide/unhide
│  ├─ ops/invite-view.tsx     # invite tab: CSV drop zone, buckets table, compose+preview
│  ├─ company|companies|experience|feed|search/  # per-screen client views
│  ├─ top-nav.tsx, user-menu.tsx, hero-search.tsx, icons.tsx
│  ├─ restricted-screen.tsx   # non-SST account blocked screen (§7)
├─ lib/
│  ├─ types.ts                # ★ shared DTO types + card helpers (see §6)
│  ├─ auth.ts                 # ensureDbUser (Clerk→users mirror) + requireDbUser /
│  │                          #   requireOps (action-layer authz, DB role ∪ OPS_EMAILS)
│  ├─ user-display.ts         # shortName/initials/batch-from-email helpers
│  ├─ db/schema.ts            # ★ THE data model — 16 tables + enums
│  ├─ db/index.ts             # Drizzle client (Neon HTTP driver)
│  ├─ db/queries.ts           # ★ read queries + THE visibility invariant
│  │                          #   (+ author/Ops reads that deliberately bypass it)
│  ├─ validations/experience.ts  # Zod schema for the share payload (mirrors draft)
│  ├─ invite.ts               # invite domain: CSV parser, header aliases, dedupe
│  │                          #   bucketing, merge tags — pure; runs client AND server
│  ├─ email.ts                # ★ EmailSender seam (console stub until Resend lands)
│  ├─ write/                  # ★ write cores: experiences (submit/resubmit),
│  │                          #   moderation, my-posts, engagement (helpful/save/
│  │                          #   view), invites (campaign send), run (action wrapper).
│  │                          #   Take an explicit `actor` — testable without Clerk
│  ├─ share-form.ts           # curated taxonomy, form constants, completion %
│  ├─ draft.ts                # localStorage draft persistence
│  ├─ cn.ts, toast.ts
├─ db/seed.ts                 # wipe + seed (npx tsx db/seed.ts)
├─ db/verify-write-loop.ts    # ★ 64-assertion invariant test: write loop + engagement + invites
├─ drizzle.config.ts
└─ docs/HANDBOOK.md           # this file
```

### Conventions
- **Reads:** route = async Server Component → calls `lib/db/queries.ts` → passes typed
  props into a `"use client"` view component. Never query from client components.
- **Writes:** the logic lives in `lib/write/*` ("cores") taking an explicit `actor`
  (our users row); `app/actions/*` are thin `"use server"` endpoints that resolve the
  actor (`requireDbUser` / `requireOps`) and delegate. Cores validate with Zod, batch
  every mutation group into ONE `db.batch()` (Neon runs it as a single transaction),
  throw `WriteError` for user-safe messages, and are exercised directly by
  `db/verify-write-loop.ts` — never put business logic in the `"use server"` file
  (its exports are public RPC endpoints). No REST routes.
- **Styling:** tokens only — `bg-surface`, `text-fg-2`, `border-border`, `text-blue` etc.
  (defined in `app/globals.css` `@theme`). Don't hardcode hex values in components.
- **Icons:** `components/icons.tsx` inline SVG set (`<Icon.search className="size-4" />`).
- Status colors are consistent app-wide: blue=Under Review, green=Approved/Offer/Passed,
  amber=Needs Edits/Draft/Awaiting, red=Rejected/Failed/Hidden.

---

## 5. The data model (the part that must outlive everything)

`lib/db/schema.ts` implements PRD §9 exactly. Core chain:

```
users ──< experiences ──< rounds ──< content_blocks >──< topic_tags
                │                                          (join: content_block_topic_tags)
                ├──< prep_tips
                ├──< reactions          (Helpful-only; UNIQUE(user, experience))
                ├──< saved_experiences  (PK(user, experience))
                └──< notifications
companies ──< experiences
role_change_audit / moderation_actions  (append-only audit)
invite_campaigns ──< invite_recipients  (outreach + dedupe)
flags                                    (reserved, no UI in V1)
```

**Invariants enforced in schema or query layer:**
- **Visibility** (`lib/db/queries.ts → visibleExp`): student-facing = `approved` AND
  `deleted_at IS NULL` AND `hidden_at IS NULL`. *Every* read goes through this one
  condition — never re-implement it per-screen.
- **One Helpful vote per user** — DB unique index, not app logic. The cached
  `experiences.helpful_count` (and `view_count`) moves in the SAME SQL statement
  that inserts/deletes the row — a CTE counts how many rows actually changed and
  the counter moves by exactly that (`lib/write/engagement.ts`), so repeated or
  concurrent calls can never make the counter drift from the rows.
- **Views count every detail-page open** (product decision 2026-06-12 — total
  opens, not unique viewers; reloads/revisits included). A guarded `view_count + 1`
  on visible rows only. The beat is fired from a client `useEffect` on the
  experience page (a deliberate Server Action), never from the server render, so
  router prefetch can't inflate counts; a ref de-dupes within one mount (React
  dev strict mode). The `viewed_experiences` dedupe table existed for a few hours
  on 2026-06-12 and was dropped with this decision.
- **Author delete ≠ Ops hide** — separate column sets (`deleted_*` vs `hidden_*`) so
  accountability is never ambiguous. Hide requires a reason (enforced in the action layer).
- **Round is a container** — `rounds.name` is a label ("OA", "Tech 1", custom). Content is
  typed `content_blocks` (coding | system_design | behavioral | open); any round can mix types.
- **Curated taxonomy** — students pick tags only from `topic_tags`; `is_dsa` powers the
  future L&D split. Enforced twice: the Zod schema admits only `TOPIC_TAXONOMY` labels,
  and the write core re-resolves labels against ACTIVE `topic_tags` rows.
- Soft-delete only; nothing is ever hard-deleted.
- **`created_at` on an under_review experience = queue-entry time.** The Ops queue is
  `ORDER BY created_at ASC`, and every (re)submission — edit of an approved post,
  needs-edits fix, resubmitted withdrawal — re-stamps `created_at` to NOW. One column,
  one ordering, and "back of the FIFO queue" (PRD §10) falls out for free. Display
  dates for published posts use `published_at`, so nothing user-visible shifts.
- **Reasons are required** for suggest-edits / reject / hide — enforced in the write
  cores (and the modals won't enable Confirm without one). Hide/unhide additionally
  append to `moderation_actions`.

**Two pragmatic deviations from a "pure" design (intentional, documented):**
- `experiences.id` is `text` (e.g. `exp-019`) so seeded deep links stay stable; new
  submissions should use nanoid.
- `experiences.overview` column added (detail page renders an Overview lead; PRD §9
  didn't list it but design §17.5 requires it).

**Schema changes:** still `drizzle-kit push` (Session 2 added one enum value,
`post_hidden`; Session 3 added — and same-day dropped — `viewed_experiences`, this way;
Session 4 added `invite_skip_reason.already_invited` via an explicit one-statement
`ALTER TYPE … ADD VALUE` instead of a blind push — prefer that for additive enum
changes). The planned switch to generated migrations did NOT happen
with the write loop — it moved to the hardening item (§10 #6) and must land before
real user data exists. Until then push remains the only mechanism; be careful.

**Withdrawn** is not a `review_status` value: it's `withdrawn_at` on an under_review
row (the author pulled it back; queue and pending-reads exclude it; resubmitting
clears it and re-stamps `created_at`). Same pattern as deleted/hidden — state
overlays live in columns, the enum only tracks the review pipeline.

---

## 6. Data flow & the DTO seam

```
Neon Postgres ──> lib/db/queries.ts ──> DTO (Experience/CompanyListItem types) ──> client views
```

- Queries load rows and **map them to the card/detail shapes the UI consumes**
  (`toCard`, `toDetail` in queries.ts). Funnel = experiences counted per round label,
  ordered by average position. Top topics = tag frequency across blocks. All computed
  per request (dataset is small; cache later if needed).
- **The DTO types live in `lib/types.ts`**. `lib/mock/data.ts` is GONE (Session 2) —
  every surface reads the DB. The only non-DB state left is localStorage drafts.
- Author/Ops reads (`getMyPosts`, `getMyPendingPost`, `getOpsQueue`,
  `listOpsPublished`, `getEditPrefill`) live in queries.ts too but deliberately
  bypass `visibleExp` — you always see your own posts; Ops sees pending ones.
- Read routes set `export const dynamic = "force-dynamic"` so pages always reflect the DB
  (now redundant-but-harmless: the auth check in the root layout makes every route dynamic).

---

## 7. Auth (Clerk) — how the gate works

Shipped in Session 1. Four layers, outermost first:

1. **`proxy.ts`** (repo root — Next 16's renamed middleware; it must sit *next to*
   `app/`, not inside it). `clerkMiddleware` + an explicit signed-out redirect to
   `/sign-in` for every route except `/sign-in(.*)` and `/sign-up(.*)`.
   ⚠️ Deliberately **not** `auth.protect()` — in Next 16 proxies it resolves the
   sign-in URL from env at runtime and silently redirects to the *current* URL when
   unset ([clerk/javascript#8302](https://github.com/clerk/javascript/issues/8302)).
2. **Clerk dashboard restrictions** — the real SST-only gate. Google-only sign-in +
   `sst.scaler.com` domain allowlist (Configure → Restrictions). Lives in the Clerk
   app `verified-doberman-18`, not in code.
3. **Code-level domain backstop** — `ensureDbUser()` in `lib/auth.ts`, called from
   the root layout. A signed-in non-`@sst.scaler.com` account gets
   `components/restricted-screen.tsx` (sign-out + retry) instead of the app, even if
   the dashboard allowlist is misconfigured. Never trust one layer.
4. **`/ops/*` gate** — `app/ops/layout.tsx` checks the DB role
   (moderator/super_admin) **OR** the `OPS_EMAILS` env allowlist
   (`lib/auth.isOpsUser`); the allowlist stays as a bootstrap so a bad roles table
   can never lock Ops out. Server Actions re-check via `requireOps()` — the page
   gate alone is never trusted. The "Switch to Ops view" menu item is hidden
   client-side via Clerk `publicMetadata.isOps`, which is still **env-derived
   only** (cosmetic): a DB-promoted moderator must also be in `OPS_EMAILS` to see
   the nav item until role management lands.

**User mirroring (the vendor seam, §3):** on first authenticated request,
`ensureDbUser()` upserts the Clerk user into our `users` table keyed by `sst_email`
(name from Google, `batch_year` parsed from the email's `23bcs`-style segment), then
stamps the DB id into Clerk `publicMetadata.dbUserId` so later requests skip the DB
write. Authorship/roles always reference *our* `users.id` — swapping auth vendors
never touches the data model. If `OPS_EMAILS` changes, the metadata re-syncs on the
user's next request.

**Client-side user display:** the `Viewer` DTO (`lib/viewer.tsx`) — resolved
SERVER-side by `ensureDbUser()` in the root layout and passed down via
`ViewerProvider`; client components call `useViewer()` + the pure helpers in
`lib/user-display.ts` (`shortName` → "Thrishal M.", `initialsOf`,
`batchLabelFromEmail` → "'27"). Used by the top-nav user menu and the share
form's identity step. Client components do NOT call Clerk's `useUser()` —
identity has one source of truth and works under dev impersonation. The only
client Clerk call left is sign-out (`useClerk().signOut`), isolated in
`ClerkSignOutButton` so it never runs without a ClerkProvider. The Ops nav
item is now driven by `viewer.isOps` = DB role ∪ `OPS_EMAILS` (no longer the
env-only Clerk `publicMetadata.isOps`, which remains only as the mirror's
re-sync trigger).

**Dev impersonation (local only — how headless browsers test):**
Clerk DEV instances do a top-level handshake redirect through
`*.clerk.accounts.dev` on every page load, which preview/headless browsers
(localhost-only) cannot follow — so under `next dev` the app can run with
Clerk bypassed entirely:

- **`/dev-login`** (route handler, hard **404 in production**): HTML picker of
  seeded users. `?as=<sst_email>` validates the users row and sets an httpOnly
  `dev-impersonate` cookie; `?off` clears it.
- **`lib/auth.ts`**: `ensureDbUser()` + `requireDbUser()` check that cookie
  FIRST — but only behind `isDevBypassEnabled()`. They resolve directly to our
  users row; Clerk is never consulted. **Five independent conditions**, any one
  of which keeps production safe: `DEV_AUTH_BYPASS=1` (explicit opt-in, lives
  ONLY in gitignored `.env.local` — never set it on Vercel) + `NODE_ENV ===
  "development"` (always `"production"` on Vercel builds) + `!VERCEL` (Vercel
  sets that var unconditionally, so even a misconfigured NODE_ENV can't wake
  the bypass there) + the cookie + the users row must exist. Verified by
  running `next start` (prod posture, opt-in present → 404 + forged cookie
  ignored) and `next dev` without the opt-in (same denials).
- **`proxy.ts` (dev branch)**: signed-out → `/dev-login` picker (never
  `/sign-in`); while impersonating, Clerk's own pages bounce home.
- **`app/layout.tsx`**: under impersonation, ClerkProvider is NOT mounted —
  clerk-js never loads, so no accounts.dev redirect can occur.

Real Google sign-in still works locally in a normal browser: with no cookie,
visit `/sign-in` directly. Production behavior is byte-for-byte unchanged.

**Styling:** Clerk components are themed once via the `appearance.variables` prop on
`<ClerkProvider>` in `app/layout.tsx`, with direct values mirroring the
`globals.css` tokens (Clerk derives shades via `color-mix`, so `var()` refs are out).

## 8. What is mock vs real — the exact seam (critical when extending)

| Surface | Data | Actions |
|---|---|---|
| Dashboard, Companies, Company, Experience, Feed, Search | **Neon** | Save/Helpful = real Server Actions (optimistic w/ rollback); every experience-page open counts a view (server-side, on mount) |
| Share form | drafts in **localStorage**; `?edit=` prefill from **Neon** | Submit/Resubmit = real (`submitExperience`) |
| My Posts (incl. Saved tab) / Under Review / dashboard strip | **Neon** | Delete/Restore/Withdraw/Resubmit = real; Saved tab lists bookmarks (others' posts, via the visibility invariant) |
| Ops queue (pending + published views) | **Neon**, FIFO | Approve/Suggest edits/Reject/Hide/Unhide = real |
| Ops users tab | hardcoded list | role change = toast only (later session) |
| Ops invite tab | **Neon** (dedupe sets + campaign/recipient rows) | Send = real (`sendInvites`); email dispatch = console stub (`lib/email.ts`) until Resend |
| Notifications | **rows written** on every transition | no UI yet (no bell, no email — email is roadmap #5) |

The write path end-to-end: form (client) → `app/actions/experiences.submitExperience`
→ Zod parse → `lib/write/experiences` core → one `db.batch()` → `revalidatePath` →
client `router.push("/under-review")`.

---

## 9. Running, developing, deploying

```bash
cd web
npm run dev          # local dev (auto port)
                     # → signed-out lands on /dev-login (dev impersonation picker, §7)
npx tsc --noEmit     # typecheck
npm run build        # production build — must be green before deploy
npx drizzle-kit push # apply schema changes to Neon (dev-mode; see §5 re migrations)
npx tsx db/seed.ts   # WIPE + reseed the database (dev only!)
npx tsx --env-file=.env.local db/verify-write-loop.ts
                     # 64-assertion write-loop + engagement + invite invariant test (real DB!) —
                     # leaves test rows behind; ALWAYS reseed after. Run before deploys.
npx vercel deploy --prod --yes   # deploy
```

- **Env:** `web/.env.local` (gitignored) and Vercel production env vars — always both:
  | Var | What |
  |---|---|
  | `DATABASE_URL` | Neon Postgres connection string |
  | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk frontend key (`pk_test_…` for now) |
  | `CLERK_SECRET_KEY` | Clerk backend key (`sk_test_…` for now) |
  | `OPS_EMAILS` | comma-separated `/ops` allowlist (interim, until DB roles) |
  | `DEV_AUTH_BYPASS` | `1` enables dev impersonation (§7) — **`.env.local` ONLY, never Vercel** |

  Still on Clerk **dev-instance** keys — before real launch, create the Clerk
  production instance and swap both keys.
- **Accounts** (all under thrishalmadasu's GitHub): Vercel (`inherit`), Neon
  (project `inherit`, ap-southeast-1). Plan: transfer to an SST org before batch handover.
- Deploys are manual via CLI right now. **Recommended next:** push the repo to GitHub and
  connect it to the Vercel project → auto-deploy on push + preview URLs per PR.

---

## 10. Roadmap from here (the order matters)

1. ~~**Clerk auth**~~ ✅ **Done (Session 1)** — see §7. The `sst.scaler.com`
   domain allowlist in the Clerk dashboard (Configure → Restrictions) was
   **confirmed set by Thrishal on 2026-06-12**; the code backstop remains as
   the second layer.
2. ~~**Write loop**~~ ✅ **Done (Session 2)** — see §4 conventions, §5 invariants, §8
   seam. Verified by `db/verify-write-loop.ts` (39 assertions: FIFO incl.
   resubmission ordering, visibility on every surface for hidden/deleted/pending,
   reason requirements, audit rows, notifications, authorization edges).
   Known gaps, deliberate: notifications have no UI/email yet; Ops "open full
   post" is an inline expansion (no dedicated route). In-browser click-through
   as the three roles is now possible locally via dev impersonation (§7);
   a pass with real Google-OAuth SST accounts on prod is still worthwhile
   before launch.
3. ~~**Engagement**~~ ✅ **Done (Session 3)** — Helpful toggle + saves as Server
   Actions (`lib/write/engagement.ts`, §5 invariants), view counts (every
   detail-page open; changed from unique-per-user the same day), Saved tab on /me. "Most helpful / Most viewed" sorts on
   Feed/Company now run on real columns — verified in `db/verify-write-loop.ts`
   (19 new assertions: idempotence, counter↔row consistency, view dedupe,
   saved-list visibility). In-browser pass now unblocked by dev impersonation
   (§7); verified server-rendered flows as student + moderator locally.
4. ~~**Invite-to-share**~~ ✅ **Done (Session 4)** — send-only V1 of PRD §7 Flow F,
   ported faithfully from the prototype's `outreach-page.jsx` (no KPI strip / campaigns
   table — those are deferred Ops Analytics). CSV → header-alias normalisation →
   Ready/Will-skip/Errors buckets (dedupe vs existing authors AND prior
   `invite_recipients`, plus in-file dupes / bad emails) → compose with merge tags +
   live preview → confirm → ONE `db.batch()` writes `invite_campaigns` +
   all recipient rows (sent/skipped + reason, full audit trail). The client parses
   for instant feedback but the Send action re-parses the raw CSV server-side
   against fresh dedupe sets — client buckets are never trusted. Invite links land
   on `/share?company=&role=&round=` pre-filled (an in-progress draft still wins).
   Email dispatch is the `lib/email.ts` console stub; 6 new assertions in
   `db/verify-write-loop.ts` (64 total, incl. the same-CSV-next-day refusal).
5. **Email (Resend)** behind the `EmailSender` interface (console stub shipped in
   Session 4 — swap `getEmailSender()`), then
   **L&D Sheets sync** (service account, append-on-publish, background, never blocks).
6. **Hardening before '27 launch**: switch to migration files, invariant tests
   (visibility, FIFO, one-vote), GitHub-connected deploys, rate limits on actions,
   transfer accounts to an SST org.

**Per-PRD deferred (do NOT build into V1):** Ops Analytics tab, Follow-company,
"actively hiring" indicators, comments, weekly digest, AI moderation, saved searches.

---

## 11. For the product team — decisions already locked

- **Helpful-only voting** (no "Not helpful") — decided 2026-06-12, PRD updated everywhere.
- **View count = total detail-page opens**, not unique viewers (reloads count) —
  decided 2026-06-12, replacing the same-day unique-viewer implementation.
- **Every post reviewed before publish; FIFO queue, no fast-tracking** (PRD §10).
- **Anonymity:** default real name; per-post anonymous toggle; Ops always sees identity.
- **SST-only, permanently** — enforced since Session 1 (Clerk allowlist + code
  backstop, §7); `robots.txt` still TODO.
- **Soft-delete forever** (author restore any time) vs **Ops hide with required reason**
  (logged, reversible) — two separate mechanisms by design.
- **Block-composed rounds** — a round can mix coding/system-design/behavioral/open blocks;
  the round name is just the pipeline label.
- **Curated tag taxonomy** — students can't free-type tags; Ops curates the list
  (34 seeded). This is the contract that keeps Top-topics analytics and the future
  L&D sheet clean. *Open question owner: who curates the seed list (PRD §15 Q5).*

## 12. Known quirks
- After a reseed, a `dev-impersonate` cookie keeps working (it's matched by
  email, which the seed recreates) — but if you impersonated a non-seeded user,
  hit `/dev-login?off`. The embedded preview pane can NEVER complete real Clerk
  sign-in (it blocks non-localhost navigation) — that's what dev impersonation
  is for; use a normal browser for the real OAuth flow.
- `<body suppressHydrationWarning>` in `app/layout.tsx` — tolerates browser-extension
  attribute injection (e.g. Bitdefender's `bis_register`). Scoped to body attributes only.
- Local dev port is auto-assigned because Docker
  squats on 3000.
- The `…-thrishal-madasus-projects.vercel.app` URLs 401 by design (Vercel deployment
  protection); the public URL is `inherit-three.vercel.app`.
- `db/seed.ts` **wipes the database**. Fine now; add a guard before real user data exists.
- The share form never captures `experiences.overview` (it's a seed/detail-page field);
  new submissions render the detail page without the Overview lead, and edits preserve
  whatever overview the row already had. Decide in a later session whether the form
  grows an Overview input or the column stays Ops/import-only.
- After a reseed, Clerk `publicMetadata.dbUserId` on real accounts points at a dead
  uuid. Harmless — authorship resolves by email (`requireDbUser`), not metadata — but
  don't start trusting `dbUserId` for writes without re-syncing it.
- The repo is a **local git repo only** (initialized Session 2); connecting GitHub +
  Vercel git deploys is still the recommended next infra step (§9).
- Invite-link prefill (`/share?company=…`) only applies when there's no saved share
  draft — a student mid-draft keeps their draft (deliberate; same draft-wins rule as
  edit mode). Recipients who were "sent" by the stub are dedupe-blocked from future
  campaigns even though no real email went out — fine before launch (reseed clears
  `invite_*`), but remember it when testing campaigns on prod data.
