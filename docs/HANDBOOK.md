# Inherit — Maintainer's Handbook (KT)

> Living document. Last updated **2026-06-14** — canonical entities / zero duplicates (#10): Ops-managed `round_types`, companies resolved-at-review (no auto-create), DB-sourced share-form vocabularies, `/ops/taxonomy` admin. Prior: pre-launch perf pass + invite CSV fix; Session 5 (Resend email + L&D Sheets sync, behind interfaces).
> Read this top-to-bottom once and you can maintain, extend, and explain the system.

---

## 1. What this is

**Inherit** is SST's placement-intelligence platform: a gated, searchable knowledge base
where students share structured placement experiences (OAs, interviews, offers) so the
next person interviewing at a company walks in with the batch's collective intelligence.

- **Live:** https://sst-inherit.vercel.app (the sole public URL as of 2026-06-14; the old
  `inherit-three.vercel.app` alias was removed)
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
| Ops users tab + role management | ✅ **Real DB** | **super-admin ONLY** — the `/ops/users` page redirects non-super-admins and the nav tab is hidden from moderators; paginated + searchable user table; super-admin-only promote/demote (`app/actions/roles.ts` → `lib/write/roles.ts`), last-super-admin lockout guard, `role_change_audit` trail; bootstrap via `SUPER_ADMIN_EMAILS` (§9) |
| Canonical entities — companies / round types / topics / **roles** (no dupes, #10) | ✅ **Real DB** | share form: round/topic SELECT from active rows; **company + role are server-side typeaheads** (`app/actions/share.ts`, ≤5 results) that allow a proposed value. A new company OR role rides as a proposal resolved at review (no auto-create; approve blocked until both resolved). `/ops/taxonomy` admin (companies add/rename/alias/**merge** + **server-paginated/searchable**; round types / **roles** / topics add/rename/activate) — `lib/write/taxonomy.ts`, moderator-gated. Roles mirror companies: `role_types` table + nullable `experiences.role_type_id` |
| Auth (Clerk, `@sst.scaler.com` gate) | ✅ **Live** | users mirrored to DB; `/ops` gated by **DB role** ∪ `OPS_EMAILS` (§7) |
| Write loop (submit → moderate → publish → hide/delete/withdraw) | ✅ **Live** | Zod + Server Actions + one-batch transactions; invariant test in `db/verify-write-loop.ts` |
| Helpful votes / views / saves (persisted) | ✅ **Live** | Server Actions; cached counts move atomically with the rows; views = total detail-page opens; Saved tab on /me |
| Invite-to-share (CSV + manual outreach) | ✅ **Live** (send-only V1) | PRD §7 Flow F; CSV upload AND a manual add-recipient form (`classifyRecipient` validates both identically; merged into one campaign); per-recipient sent/failed statuses from real dispatch results |
| Email (Resend) | ✅ **Code live** (Session 5) | `lib/email/` seam: review-status emails (Flow D) + invite batch dispatch; **runs as console stub until `RESEND_API_KEY` + DNS land** (§9) |
| L&D Sheets sync | ✅ **Code live** (Session 5) | `lib/sheets/` seam: Technical+Behavioral rows appended async on first publish; **console stub until service-account key + sheet id land** (§9) |

**The one-sentence status:** *the full loop is real — a student submits, Ops moderates
(FIFO), the post publishes, every author/moderator state (needs-edits, reject,
hide, delete, withdraw, edit→re-review) round-trips through Postgres, reader
engagement (Helpful votes, saves, views) persists with it, Ops can batch-invite
interviewees from a CSV (every valid row sends — no dedupe; audited, per-recipient dispatch statuses), every
review transition emails the author, and publishing appends Technical+Behavioral
rows to the L&D sheet — with both integrations running as console stubs until the
Resend key/DNS and the Google service account are provisioned (§9).*

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
│  └─ ops/                    # layout = DB-role ∪ OPS_EMAILS gate; queue, invite,
│                             #   taxonomy (#10 canonical-entity admin) — all real;
│                             #   users tab is super-admin ONLY (moderators redirected)
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
│  ├─ invite.ts               # invite domain: CSV parser, header aliases, ready/error
│  │                          #   split (valid-email check only — NO dedupe), merge tags
│  │                          #   — pure; runs client AND server
│  ├─ email/                  # ★ EmailSender seam (Session 5): index = interface +
│  │                          #   console stub + driver pick (CLIENT-SAFE — invite
│  │                          #   preview imports the From constants); resend.ts =
│  │                          #   REST driver (no SDK dep); templates.ts = Flow D bodies
│  ├─ sheets/                 # ★ SheetSync seam (Session 5): index = interface + stub
│  │                          #   + loader + syncPublishedExperience (retries, never
│  │                          #   throws); rows.ts = PURE §13 row mapping; google.ts =
│  │                          #   service-account JWT + values.append (zero deps)
│  ├─ write/                  # ★ write cores: experiences (submit/resubmit),
│  │                          #   moderation (incl. resolve-proposed-company),
│  │                          #   taxonomy (#10: company/round-type/topic add/
│  │                          #   rename/alias/merge/activate), my-posts,
│  │                          #   engagement, invites, roles, run (action wrapper).
│  │                          #   Take an explicit `actor` — testable without Clerk
│  ├─ share-form.ts           # curated taxonomy, form constants, completion %
│  ├─ draft.ts                # localStorage draft persistence
│  ├─ cn.ts, toast.ts
├─ db/seed.ts                 # wipe + seed (npx tsx db/seed.ts)
├─ db/verify-write-loop.ts    # ★ 81-assertion invariant test: write loop + engagement
│                             #   + invites + status emails + sheet rows
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
invite_campaigns ──< invite_recipients  (outreach audit trail — no dedupe)
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
- **Round is a container** — `rounds.name` is a label ("OA", "Tech 1"…). Content is
  typed `content_blocks` (coding | system_design | behavioral | open); any round can mix types.
- **Canonical vocabularies — no duplicates, ever (#10).** Companies, round types
  (`round_types`), and topics (`topic_tags`) are Ops-managed canonical lists; students
  SELECT from them in the share form (`getShareFormOptions` → props), never free-type.
  Uniqueness is enforced at the ROOT (only Ops adds entries via `/ops/taxonomy`), not by
  cleanup. The write cores re-resolve every submitted round/topic label against ACTIVE rows
  (`assertRoundTypes` / `resolveTagIds`) and reject unknowns — the real contract; Zod only
  checks shape/length now (so an Ops-added entry works the instant it exists). Renaming a
  round type propagates to the denormalized `rounds.name` (all stored names are canonical, so
  they match by old label); renaming a topic needs no propagation (links reference `tag_id`).
- **Companies are never auto-created.** `resolveCompany` matches the canonical list by name or
  alias; an unmatched name rides along as `experiences.proposed_company_name` with
  `company_id` NULL (nullable now). A moderator resolves it during the EXISTING review — map
  to an existing company (the typed spelling is folded in as an alias, so the next student
  auto-binds) or promote it to canonical. `approveCore` REFUSES to publish while `company_id`
  is NULL. Every visible/approved experience therefore has a company; only author/Ops reads
  ever see a proposed name (`loadWhere` left-joins companies; `companyNameOf` falls back to the
  proposal). Ops `/ops/taxonomy` also supports rename / add-alias / **merge** (repoint every
  experience, fold name+aliases into the target, delete the source — one batch).
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
changes; Session 5 added `experiences.sheet_synced_at` the same explicit-ALTER way; the
#10 pass added the `round_types` table, made `experiences.company_id` NULLABLE,
and added `experiences.proposed_company_name`; the roles extension added the
`role_types` table + nullable `experiences.role_type_id` — all via `drizzle-kit
push` on a clean pre-launch DB + reseed).
The planned switch to generated migrations did NOT happen
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
3. **Code-level domain backstop** — `ensureDbUser()`/`requireDbUser()` in `lib/auth.ts`,
   called from the root layout. A signed-in account that is neither `@sst.scaler.com` NOR
   on `ALLOWED_EXTERNAL_EMAILS` gets `components/restricted-screen.tsx` (sign-out + retry)
   instead of the app, even if the dashboard allowlist is misconfigured. Never trust one
   layer. **To allow a specific external guest:** add them to Clerk's allowlist (so they can
   sign in) AND to `ALLOWED_EXTERNAL_EMAILS` (so this backstop lets them through) — both, via
   `isAllowedEmail()`.
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
| Ops users tab | **Neon** | **super-admin ONLY** (page redirects moderators, nav hides the tab); role change real + audited |
| Ops taxonomy tab (`/ops/taxonomy`) | **Neon** | companies / round types / topics — add/rename/alias/merge/activate (real, moderator-gated, `lib/write/taxonomy.ts`) |
| Share form vocabularies | **Neon** (`getShareFormOptions`) | company typeahead + round `<select>` + topic tags all SELECT canonical DB rows; unmatched company = proposal resolved at review |
| Ops invite tab | **Neon** (campaign + recipient rows = audit trail; **no dedupe** — every valid row sends) | Send = real (`sendInvites`); recipients from CSV upload AND/OR the manual add-recipient form (both re-validated server-side by `classifyRecipient`); dispatch through `lib/email` — Resend when `RESEND_API_KEY` is set, console stub otherwise; rows stamped sent/failed per recipient |
| Notifications | **rows written** on every transition | no bell UI yet; **emails real** for the four review transitions (under review / live / needs edits / rejected) via `lib/email`, best-effort after the batch commits |
| L&D sheet | `sheet_synced_at` stamp on experiences | append fired by `after()` in the approve action → `lib/sheets.syncPublishedExperience` (async, 3 attempts, never blocks/fails publish); Google driver when SA key + sheet id set, stub otherwise |

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
                     # 132-assertion write-loop + engagement + invite (CSV+manual) + email/sheets + roles + canonical-entity (#10) + Ops-search invariant test (real DB!) —
                     # leaves test rows behind; ALWAYS reseed after. Run before deploys.
npx vercel deploy --prod --yes   # deploy
```

- **Env:** `web/.env.local` (gitignored) and Vercel production env vars — always both:
  | Var | What |
  |---|---|
  | `DATABASE_URL` | Neon Postgres connection string |
  | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk frontend key (`pk_test_…` for now) |
  | `CLERK_SECRET_KEY` | Clerk backend key (`sk_test_…` for now) |
  | `OPS_EMAILS` | comma-separated `/ops` ACCESS bootstrap — OR-gate alongside DB roles (moderator/super_admin); keeps moderation reachable if the roles table is misconfigured |
  | `SUPER_ADMIN_EMAILS` | comma-separated bootstrap for the SUPER-ADMIN power (granting roles in `/ops/users`). **Required in prod** until a `super_admin` row exists, else nobody can assign roles. `ensureDbUser` writes it THROUGH to the DB on sign-in (self-healing — the listed user becomes `super_admin` in the table + audit), so once they've signed in the var is redundant and removable. Keep to the 1–2 role owners; distinct from `OPS_EMAILS` so a student-moderator never gains role-management power |
  | `ALLOWED_EXTERNAL_EMAILS` | comma-separated guests allowed in **despite not being `@sst.scaler.com`** (e.g. an external admin/partner). Relaxes the code-level domain backstop only (§7); the SAME address must ALSO be on Clerk's allowlist or Clerk won't authenticate them. SST accounts always pass without this |
  | `DEV_AUTH_BYPASS` | `1` enables dev impersonation (§7) — **`.env.local` ONLY, never Vercel** |
  | `RESEND_API_KEY` | flips `lib/email` from console stub → Resend (real sends!). Needs the From domain verified in Resend (SPF/DKIM DNS) first |
  | `NEXT_PUBLIC_EMAIL_FROM` | sender address once Ops locks the subdomain (PRD §15 Q4); defaults to `ops@inherit.sst.scaler.com`. Build-time inlined → redeploy to change |
  | `GOOGLE_SERVICE_ACCOUNT_KEY` | the service account's JSON key, verbatim. With `LD_SHEET_ID`, flips `lib/sheets` from stub → Google |
  | `LD_SHEET_ID` | L&D tracker spreadsheet id; share the sheet with the SA's `client_email` (Editor). Optional `LD_SHEET_TECHNICAL_TAB`/`LD_SHEET_BEHAVIORAL_TAB` if tab names differ from `Technical`/`Behavioral` |
  | `EMAIL_DRIVER` / `SHEETS_DRIVER` | force `console`\|`resend` / `console`\|`google` — the invariant test pins both to `console` so it can never email students or write the real sheet |

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
4. ~~**Invite-to-share**~~ ✅ **Done (Session 4; dedupe removed Session 5)** — send-only
   V1 of PRD §7 Flow F, ported faithfully from the prototype's `outreach-page.jsx` (no
   KPI strip / campaigns table — those are deferred Ops Analytics). CSV → header-alias
   normalisation → Ready/Errors buckets (valid-email check only — **NO dedupe** as of
   2026-06-13: every valid row sends, including in-file duplicates and re-runs of the
   same file; Ops invites a student per interview experience) → compose with merge tags +
   live preview → confirm → ONE `db.batch()` writes `invite_campaigns` +
   all recipient rows (ready→sent/failed per dispatch, plus bad-email rows recorded as
   skipped with invalid_email/missing_email — full audit trail). The client parses
   for instant feedback but the Send action re-parses + re-validates the raw CSV
   server-side — the client is never trusted. Invite links land
   on `/share?company=&role=&round=` pre-filled (an in-progress draft still wins).
   Email dispatch is the `lib/email` driver; Flow F assertions in
   `db/verify-write-loop.ts` (incl. that re-running the SAME CSV sends again — no
   cross-campaign dedupe — and that in-file duplicates each dispatch).
5. ~~**Email (Resend) + L&D Sheets sync**~~ ✅ **Code done (Session 5)** — both behind
   interfaces with env-picked drivers (`lib/email/`, `lib/sheets/`; details below).
   Review-status emails fire from the write cores after the batch commits
   (best-effort — the notifications row is the durable record); invite dispatch
   goes through Resend's batch endpoint in ≤100-email chunks with 429/5xx retries
   and stamps `invite_recipients` sent/**failed** per row BY ROW ID (duplicates are
   allowed now, so an email no longer identifies one row); failed = re-send by
   re-uploading the same CSV (no dedupe blocks it);
   the sheet append runs via `after()` post-response with 3 attempts and the
   `sheet_synced_at` stamp making it append-on-FIRST-publish only (PRD §13 —
   re-approved edits do NOT re-append; reconciliation is deferred two-way sync).
   **Still needed to go live (user setup, §9):** Resend account + API key + DNS
   records for the sending subdomain (decide with Ops, PRD §15 Q4), and a Google
   Cloud service account + the L&D sheet shared with it (+ both tabs created with
   the header rows from `lib/sheets/rows.ts`). Until then both run as console stubs.
6. **Hardening before '27 launch**: switch to migration files, invariant tests
   (visibility, FIFO, one-vote), GitHub-connected deploys, rate limits on actions,
   transfer accounts to an SST org, and a durable retry queue for failed sheet
   appends (today a final failure just logs and leaves `sheet_synced_at` NULL —
   PRD §13's "background worker with retries" is approximated by `after()`+3 tries).
   - **At the Neon-account switch (when the DB is rebuilt fresh):** delete the three
     LEGACY `invite_skip_reason` enum values (`duplicate_in_file` / `already_shared` /
     `already_invited`) from `lib/db/schema.ts` BEFORE the first `drizzle-kit push`
     against the new database. Postgres can't drop them from the live enum, but a
     fresh DB builds the enum from the TS definition — so the migration is the one
     clean chance to shed them. Nothing writes them and no rows reference them. This
     is the only known stale artifact in the codebase (left by the 2026-06-13 invite
     dedupe removal).

7. **Pre-launch pass (2026-06-14, partial)** — triage of pre-launch concerns; this
   batch deployed (`f402897`):
   - **Read-path perf:** every list page used to load the *entire* published corpus
     (full object graph via `loadWhere`) and filter/slice in JS. Fixed the hot paths
     to scope in SQL — `getExperience` fetches by id + a `LIMIT 4` related set,
     `latestExperiences` pushes `LIMIT n`, `getCompanyPage` scopes by `companyId`,
     and `listCompanies` counts via a single `GROUP BY` (count + max, no hydration).
     `loadWhere` gained an optional `limit`. Behavior-preserving (same `visibleExp`
     invariant + ordering); verified by `verify-write-loop.ts` (79) + a read-path
     equivalence check.
   - **Invite CSV re-upload fix:** the file `<input>` now resets its `.value` after
     each read, so re-uploading the SAME CSV (how Ops retries failed rows) fires
     `onChange` again instead of silently no-op'ing until a reload.
   - ✅ **Role model (done, follow-up batch):** the Ops users tab is now real —
     paginated + searchable user table (`listOpsUsers`), super-admin-only promote/
     demote (`app/actions/roles.ts` → `lib/write/roles.ts`, gated by
     `requireSuperAdmin`), last-super-admin lockout guard, and a real
     `role_change_audit` trail (`listRecentRoleChanges`). Bootstrap via
     `SUPER_ADMIN_EMAILS` (§9), which `ensureDbUser` writes THROUGH to the DB on
     sign-in (self-healing — DB stays the single source of truth, env removable
     after first sign-in). Verified by 10 new harness assertions. **Access is
     super-admin ONLY (2026-06-14):** the `/ops/users` page redirects
     non-super-admins to the queue and the nav tab is hidden from moderators —
     user/role management isn't a moderator concern.
   - ✅ **Ops-nav gap closed:** `ensureDbUser` now resolves the users row every
     request (one cheap indexed read; the slow Clerk metadata write stays gated) and
     sources `viewer.isOps` from the DB role (`isOpsUser`), so a moderator promoted
     purely via `/ops/users` sees the nav link without being in `OPS_EMAILS`.
   - ✅ **#4 hide hardening:** destructive hide/unhide now require the moderator+
     ROLE (`requireModerator`, NOT the `OPS_EMAILS` bootstrap) so student-ops can't
     hide by mistake; the Ops published tab shows "View only" to non-moderators; and
     a de-emphasized moderator-only hide control (reason modal) now lives on the
     experience detail page, not just the published tab. +3 harness assertions.
   - ✅ **Tier-3 pagination (feed + search):** `listFeedPage` filters (round via
     EXISTS, outcome) + sorts (latest/helpful/views/difficulty-via-correlated-
     subquery) + paginates in SQL; `FeedView` is now server-driven with "Load more"
     (filters/sorts re-query page 1, so they span the whole dataset correctly).
     `/search` uses server-side `searchExperiences` (bounded, debounced) instead of
     loading the whole corpus to filter client-side. Reads via `app/actions/{feed,
     search}.ts`. Verified by an 11-assertion read-only check.
   - ✅ **Tier-3 pagination (Ops + Saved):** `getOpsQueue` (with an `anonymousOnly`
     server filter), `listOpsPublished`, and `getSavedExperiences` now return a
     `Paginated<T>` ({items,total,hasMore}); the Ops queue/published tabs and the /me
     Saved tab use "Load more" (reads via `app/actions/{ops,me}.ts`). The Ops queue
     page seeds all/anonymous/published page-1 in parallel. `usePaged` keeps page-1
     from props (fresh after `router.refresh`) and accumulates extra pages, resetting
     on any moderation action. The saved query joins through `visibleExp` so
     total/page stay consistent under the visibility invariant.
   - ✅ **Canonical roles + more pagination (2026-06-14):** roles are now canonical too —
     `role_types` table (Ops-managed, mirrors companies) + nullable `experiences.role_type_id`;
     `resolveRole` binds a canonical role or carries a PROPOSED one; `approveCore` blocks until
     BOTH company and role are resolved; `resolveExperienceRoleCore` + a queue-card `RoleResolver`
     resolve it; `/ops/taxonomy` gained a **Roles** tab; the share form's company + role fields are
     server-side typeaheads (`app/actions/share.ts`, ≤5). Also paginated/searched server-side:
     **`/companies`** (`listCompaniesPage`, URL `?q&?page`) and the **Ops taxonomy Companies tab**
     (`fetchOpsCompanies`); round-types/roles/topics stay full-list (small, bounded). +10 harness
     assertions (132 total). Default page size is **10** everywhere.
   - ✅ **Ops search (2026-06-14):** `getOpsQueue` + `listOpsPublished` take an optional
     `q` (server-side `opsSearchCond`: role / company name / proposed name / round, via
     correlated subqueries so it folds into both the COUNT and the page query). Each Ops
     tab has a search box; `usePaged` runs in a search mode (debounced page-1 from the
     server + q-aware Load-more, props ignored) so a moderator can find ANY matching post
     to hide/unhide, however old — not just scroll Load-more. Verified by 4 harness assertions.
   - **`getMyPosts` deliberately NOT paginated:** it's one author's own rows
     (naturally bounded) AND the My Posts view mixes client-only localStorage drafts
     with DB rows — server pagination would be disproportionate. Revisit only if a
     user can realistically exceed ~100 posts.
   - ✅ **Loading skeletons:** `components/ui/skeleton.tsx` (Skeleton / SkeletonCard /
     SkeletonRow + list variants, `animate-pulse`) + `loading.tsx` for feed, search,
     companies, company, experience, me, ops/queue, ops/users — fixes the
     "blocks then pops in" feel on navigation (was: no loading UI, force-dynamic
     pages blocked on DB).
   - **Confirmed (concern #10): companies ARE effectively free-text.** The share
     form's company `Combo` (share-form.tsx) is a plain input with autocomplete from a
     STATIC `COMPANY_SUGGESTIONS` list (not the DB); `resolveCompanyId`
     (lib/write/experiences.ts) auto-creates a row on any unmatched name → real dup
     risk ("Goldman" vs "Goldman Sachs").
   - ✅ **#10 canonical entities / zero duplicates (done):** companies, round types
     (new `round_types` table), and topics are Ops-managed canonical lists the share form
     SELECTs from (`getShareFormOptions`); students never free-type. Unknown company →
     `proposed_company_name` (company_id nullable) resolved at the EXISTING Ops review (map →
     fold-as-alias / promote), `approveCore` gated on resolution; `/ops/taxonomy` admin
     (add/rename/alias/**merge** companies; add/rename/activate round types + topics) in
     `lib/write/taxonomy.ts`, moderator-gated. Read layer left-joins companies + null-safe
     mapping; visible surfaces unchanged. +23 harness assertions (115 total).
   - ✅ **Manual add-recipient in invite (#8, done):** the invite tab takes recipients from a
     CSV upload AND a manual add-recipient form (name/email/company/role/round). Manual rows are
     carried as a structured list and re-validated server-side by the SAME `classifyRecipient`
     used for CSV rows (client untrusted), then merged into one campaign. +3 harness assertions.
   - **Deferred to a future release (post-launch):** daily moderator report email (received vs
     reviewed) — pairs with the cron/infra work, not a launch blocker. The pre-launch triage is
     otherwise cleared; only the broader share-form UX polish (#12) remains. Full backlog lives in
     the assistant's project memory.

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
  protection); the public URL is `sst-inherit.vercel.app` (the old `inherit-three` alias was removed).
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
  edit mode).
- **Invite-to-share has NO dedupe** (2026-06-13): re-uploading the same CSV sends
  again, and the same email twice in one file dispatches twice. This is intended —
  Ops invites a student per interview experience and owns recipient selection. The
  only rejected rows are bad emails (missing/invalid), recorded as `skipped` with
  reason `invalid_email`/`missing_email`. `failed` rows (dispatch error) re-send on
  the next upload, same as everything else — nothing blocks a re-send.
- `NEXT_PUBLIC_EMAIL_FROM` is inlined at build time (it's NEXT_PUBLIC so the Ops
  compose preview shows the real sender) — changing the From address requires a
  redeploy, not just an env edit.
- Hide/unhide send NO email by design (PRD §12 scopes review-status emails to the
  four review transitions); the in-app notification row is still written. Unhide
  re-fires `post_live` as a row only.
- The L&D sheet column order/casing in `lib/sheets/rows.ts` is provisional until
  L&D confirms their tracker shape (PRD §15 Q6) — adjust `*_HEADERS` + `*Cells`
  there, nothing else. The sync appends data rows only; create the two tabs with
  header rows by hand when setting up the sheet.
- The sheet append is fired from the approve ACTION (`after()` needs request
  scope), not the core — approving via a script/test must call
  `syncPublishedExperience(expId)` itself if it wants the append.
