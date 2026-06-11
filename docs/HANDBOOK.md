# Inherit — Maintainer's Handbook (KT)

> Living document. Last updated **2026-06-12** after the gated-alpha build night.
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
| Share form (5 steps, block-composed rounds, curated tags, autosave) | ✅ UI complete | **submits nowhere yet** — draft in localStorage |
| My Posts / Under Review / Ops queue / Ops users | ✅ UI complete | **on mock data**; actions are toast-only |
| Auth (Clerk, `@sst.scaler.com` gate) | ⏳ Not started | next milestone; app is currently OPEN |
| Write loop (submit → moderate → publish) | ⏳ Not started | Server Actions, after auth |
| Helpful votes / views / saves (persisted) | ⏳ Not started | UI exists; localStorage/optimistic only |
| Invite-to-share (CSV outreach) | ⏳ Placeholder tab | full spec in PRD §7 Flow F |
| Email (Resend) + L&D Sheets sync | ⏳ Not started | last; behind interfaces per plan |

**The one-sentence status:** *everything a reader touches is real; everything a writer
touches is a working UI waiting for auth + Server Actions.*

---

## 3. Tech stack & why (for the tech team)

| Layer | Choice | Why (short) |
|---|---|---|
| Framework | **Next.js 16** (App Router) + TypeScript | One tool for UI + server; Server Components for reads, Server Actions (upcoming) for writes |
| Database | **PostgreSQL on Neon** | Deeply relational data (experience→rounds→blocks→tags); Neon = serverless + free tier + DB branching |
| ORM | **Drizzle** + drizzle-kit | Type-safe end-to-end, SQL-transparent, no runtime engine |
| Styling | **Tailwind 4** with design tokens extracted from the prototype CSS | Utility classes driven by the token system in `app/globals.css` `@theme` |
| UI behavior | **Radix UI** (so far: Dialog) wrapped in `components/ui/*` | Unstyled a11y primitives; we bring the look |
| Auth (planned) | **Clerk**, domain-gated to `@sst.scaler.com` | Domain restriction is one setting; no auth code to own |
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
├─ app/                       # routes (App Router)
│  ├─ page.tsx                # Dashboard — async server component (DB)
│  ├─ companies/page.tsx      #   + [slug]/page.tsx — DB-backed
│  ├─ experiences/[id]/page.tsx  # DB-backed, 404s on unknown id
│  ├─ feed/page.tsx           # DB-backed
│  ├─ search/page.tsx         # DB-backed (client-side filtering)
│  ├─ share/page.tsx          # 5-step form (?edit=<id>) — localStorage drafts
│  ├─ me/page.tsx             # My Posts — MOCK
│  ├─ under-review/page.tsx   # author preview — MOCK
│  └─ ops/                    # layout + queue / invite / users — MOCK
├─ components/
│  ├─ ui/                     # primitive layer: pill, button, chip, stat-card,
│  │                          #   funnel, topics-list, experience-card, select, modal
│  ├─ share/                  # share-form, round-editor (block editor), tag-input
│  ├─ company|companies|experience|feed|search/  # per-screen client views
│  ├─ top-nav.tsx, user-menu.tsx, hero-search.tsx, icons.tsx
├─ lib/
│  ├─ db/schema.ts            # ★ THE data model — 16 tables + enums
│  ├─ db/index.ts             # Drizzle client (Neon HTTP driver)
│  ├─ db/queries.ts           # ★ read queries + THE visibility invariant
│  ├─ mock/data.ts            # Phase-0 mock + shared DTO types (see §6)
│  ├─ share-form.ts           # curated taxonomy, form constants, completion %
│  ├─ draft.ts                # localStorage draft persistence
│  ├─ cn.ts, toast.ts
├─ db/seed.ts                 # wipe + seed (npx tsx db/seed.ts)
├─ drizzle.config.ts
└─ docs/HANDBOOK.md           # this file
```

### Conventions
- **Reads:** route = async Server Component → calls `lib/db/queries.ts` → passes typed
  props into a `"use client"` view component. Never query from client components.
- **Writes (upcoming):** Server Actions in `app/actions/*`, validated with Zod,
  authorized via a `requireRole` helper. No REST routes.
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
                ├──< saved_experiences
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
- **One Helpful vote per user** — DB unique index, not app logic.
- **Author delete ≠ Ops hide** — separate column sets (`deleted_*` vs `hidden_*`) so
  accountability is never ambiguous. Hide requires a reason (enforced in the action layer).
- **Round is a container** — `rounds.name` is a label ("OA", "Tech 1", custom). Content is
  typed `content_blocks` (coding | system_design | behavioral | open); any round can mix types.
- **Curated taxonomy** — students pick tags only from `topic_tags`; `is_dsa` powers the
  future L&D split.
- Soft-delete only; nothing is ever hard-deleted.

**Two pragmatic deviations from a "pure" design (intentional, documented):**
- `experiences.id` is `text` (e.g. `exp-019`) so seeded deep links stay stable; new
  submissions should use nanoid.
- `experiences.overview` column added (detail page renders an Overview lead; PRD §9
  didn't list it but design §17.5 requires it).

**Schema changes:** tonight used `drizzle-kit push` (fast iteration). **Before the write
loop ships, switch to generated migrations** (`drizzle-kit generate` + commit the SQL in
`drizzle/`) — from then on, migrations are the only way schema changes.

---

## 6. Data flow & the DTO seam

```
Neon Postgres ──> lib/db/queries.ts ──> DTO (Experience/CompanyListItem types) ──> client views
```

- Queries load rows and **map them to the card/detail shapes the UI consumes**
  (`toCard`, `toDetail` in queries.ts). Funnel = experiences counted per round label,
  ordered by average position. Top topics = tag frequency across blocks. All computed
  per request (dataset is small; cache later if needed).
- **The DTO types currently live in `lib/mock/data.ts`** (they began as mock types).
  The mock file therefore serves two roles: (a) type definitions used everywhere,
  (b) mock *values* still consumed by `/me`, `/under-review`, `/ops`, and the share
  form's edit-prefill. **First refactor for the next session: move the types to
  `lib/types.ts`**, leaving mock values only where screens are still mock.
- Read routes set `export const dynamic = "force-dynamic"` so pages always reflect the DB.

---

## 7. What is mock vs real — the exact seam (critical when extending)

| Surface | Data | Actions |
|---|---|---|
| Dashboard, Companies, Company, Experience, Feed, Search | **Neon** | Save/Helpful = optimistic UI only (not persisted) |
| Share form | drafts in **localStorage** (`inherit:draft:share`, `inherit:edit:<id>`) | Submit clears draft + shows success — **no DB write** |
| My Posts | `lib/mock/data.ts → myPosts` | Restore/discard = toast only |
| Under Review | mock experience preview | Edit/Withdraw buttons link only |
| Ops queue / users | `mock → opsQueue` + hardcoded users | Approve/Reject/Hide/role-change = toast only |
| Dashboard "your post under review" strip | hardcoded | — |

---

## 8. Running, developing, deploying

```bash
cd web
npm run dev          # local dev (auto port)
npx tsc --noEmit     # typecheck
npm run build        # production build — must be green before deploy
npx drizzle-kit push # apply schema changes to Neon (dev-mode; see §5 re migrations)
npx tsx db/seed.ts   # WIPE + reseed the database (dev only!)
npx vercel deploy --prod --yes   # deploy
```

- **Env:** `web/.env.local` holds `DATABASE_URL` (gitignored). Vercel has it as an
  encrypted production env var. New secrets: add to both.
- **Accounts** (all under thrishalmadasu's GitHub): Vercel (`inherit`), Neon
  (project `inherit`, ap-southeast-1). Plan: transfer to an SST org before batch handover.
- Deploys are manual via CLI right now. **Recommended next:** push the repo to GitHub and
  connect it to the Vercel project → auto-deploy on push + preview URLs per PR.

---

## 9. Roadmap from here (the order matters)

1. **Clerk auth** (~1 evening): signup → keys in env, `<ClerkProvider>` in layout,
   `app/proxy.ts` route protection, `@sst.scaler.com` allowlist, real user in nav +
   share-form byline, ops gating (email allowlist first, DB roles after).
   Also: mirror users into `users` table on first sign-in (keeps the vendor seam).
2. **Write loop** (the big one): Zod schemas for the share form → Server Action
   `submitExperience` (insert experience + rounds + blocks + tag links + tips,
   status `under_review`) → Ops queue reads real pending rows (FIFO by `created_at`)
   → approve/suggest-edits/reject actions → publish sets `published_at`/`reviewed_*`
   → My Posts reads real rows → edit→re-review (live version hidden) → withdraw.
   Hide-published writes `moderation_actions` (reason required).
3. **Engagement**: Helpful toggle + saves as Server Actions; unique view counts
   server-side; cached `helpful_count` updated transactionally.
4. **Invite-to-share**: CSV parse (the prototype's `outreach-page.jsx` has the full
   reference implementation incl. header aliases + dedupe buckets) + `invite_*` tables.
5. **Email (Resend)** behind an `EmailSender` interface (console stub first), then
   **L&D Sheets sync** (service account, append-on-publish, background, never blocks).
6. **Hardening before '27 launch**: switch to migration files, invariant tests
   (visibility, FIFO, one-vote), GitHub-connected deploys, rate limits on actions,
   transfer accounts to an SST org.

**Per-PRD deferred (do NOT build into V1):** Ops Analytics tab, Follow-company,
"actively hiring" indicators, comments, weekly digest, AI moderation, saved searches.

---

## 10. For the product team — decisions already locked

- **Helpful-only voting** (no "Not helpful") — decided 2026-06-12, PRD updated everywhere.
- **Every post reviewed before publish; FIFO queue, no fast-tracking** (PRD §10).
- **Anonymity:** default real name; per-post anonymous toggle; Ops always sees identity.
- **SST-only, permanently** — will be enforced by Clerk domain allowlist + `robots.txt`.
- **Soft-delete forever** (author restore any time) vs **Ops hide with required reason**
  (logged, reversible) — two separate mechanisms by design.
- **Block-composed rounds** — a round can mix coding/system-design/behavioral/open blocks;
  the round name is just the pipeline label.
- **Curated tag taxonomy** — students can't free-type tags; Ops curates the list
  (34 seeded). This is the contract that keeps Top-topics analytics and the future
  L&D sheet clean. *Open question owner: who curates the seed list (PRD §15 Q5).*

## 11. Known quirks
- `<body suppressHydrationWarning>` in `app/layout.tsx` — tolerates browser-extension
  attribute injection (e.g. Bitdefender's `bis_register`). Scoped to body attributes only.
- Local dev port is auto-assigned because Docker
  squats on 3000.
- The `…-thrishal-madasus-projects.vercel.app` URLs 401 by design (Vercel deployment
  protection); the public URL is `inherit-three.vercel.app`.
- `db/seed.ts` **wipes the database**. Fine now; add a guard before real user data exists.
