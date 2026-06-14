// Invite-to-share domain (PRD §7 Flow F): CSV parsing, header normalisation,
// and recipient bucketing. UI-free and side-effect-free so the SAME code runs
// twice — in the client view for instant feedback, and in the write core,
// which re-parses the raw CSV server-side (never trust the client). Ported
// from the design prototype's outreach-page.jsx.
//
// NO dedupe (product decision 2026-06-13): a student interviews at several
// companies and Ops invites them per experience, so blocking by email was
// counterproductive. Every row with a valid email sends — including exact
// duplicates and re-runs of the same file. Ops owns recipient selection.
// The only rejection left is VALIDITY: a missing/malformed email can't be
// emailed (that's not dedupe).

// ── CSV parsing (quoted fields, commas inside quotes, escaped quotes) ────────
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let buf = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          buf += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        buf += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") {
        cur.push(buf);
        buf = "";
      } else if (ch === "\r") {
        /* skip */
      } else if (ch === "\n") {
        cur.push(buf);
        rows.push(cur);
        cur = [];
        buf = "";
      } else buf += ch;
    }
  }
  if (buf.length > 0 || cur.length > 0) {
    cur.push(buf);
    rows.push(cur);
  }

  return rows.filter((r) => r.some((c) => c && c.trim().length > 0));
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Header aliases (PRD: `full_name`, `employer`, `stage`… normalise) ────────
function normaliseHeader(h: string): string {
  return String(h || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const HEADER_ALIASES: Record<string, string[]> = {
  name: ["name", "full_name", "student", "student_name"],
  email: ["email", "email_address", "mail"],
  company: ["company", "employer", "org", "organisation", "organization"],
  role: ["role", "position", "title", "job_title"],
  round: ["round", "stage", "interview_round"],
  date: ["date", "interview_date", "interviewed_on", "when"],
};

function mapHeaders(headerRow: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headerRow.forEach((h, idx) => {
    const norm = normaliseHeader(h);
    for (const key of Object.keys(HEADER_ALIASES)) {
      if (HEADER_ALIASES[key].includes(norm)) {
        if (map[key] == null) map[key] = idx;
        return;
      }
    }
  });
  return map;
}

// ── Validation: ready vs. error (the only split — no dedupe) ─────────────────
export type RecipientIssue = "missing_email" | "invalid_email";

export type RecipientStatus = "ready" | "error";

export interface ParsedRecipient {
  id: string;
  name: string;
  email: string;
  company: string;
  role: string;
  round: string;
  status: RecipientStatus;
  issues: RecipientIssue[];
}

export const ISSUE_COPY: Record<RecipientIssue, string> = {
  missing_email: "Missing email",
  invalid_email: "Invalid email",
};

// The five fields a recipient carries, however they were entered (CSV row or
// the manual add-recipient form). Shared so CSV and manual rows validate
// IDENTICALLY — the server re-runs this classifier on both (client untrusted).
export interface RecipientFields {
  name: string;
  email: string;
  company: string;
  role: string;
  round: string;
}

// No dedupe: a valid email is "ready". The only "error" is a missing/malformed
// email (can't be sent). Duplicates and re-runs all send (per-experience).
export function classifyRecipient(fields: Partial<RecipientFields>, id: string): ParsedRecipient {
  const email = (fields.email || "").trim().toLowerCase();
  const issues: RecipientIssue[] = [];
  if (!email) issues.push("missing_email");
  else if (!EMAIL_RE.test(email)) issues.push("invalid_email");
  return {
    id,
    name: (fields.name || "").trim(),
    email,
    company: (fields.company || "").trim(),
    role: (fields.role || "").trim(),
    round: (fields.round || "").trim(),
    status: issues.length ? "error" : "ready",
    issues,
  };
}

export function buildRecipients(rows: string[][]): ParsedRecipient[] {
  if (!rows.length) return [];
  const headerMap = mapHeaders(rows[0]);
  const out: ParsedRecipient[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const get = (k: string) => (headerMap[k] != null ? (row[headerMap[k]] || "").trim() : "");
    out.push(
      classifyRecipient(
        { name: get("name"), email: get("email"), company: get("company"), role: get("role"), round: get("round") },
        `r-${r}`,
      ),
    );
  }
  return out;
}

// Manually-entered recipients (the add-recipient form) — validated by the SAME
// classifier as CSV rows. `m-` ids distinguish them in the UI (removable).
export function buildManualRecipients(rows: RecipientFields[]): ParsedRecipient[] {
  return rows.map((f, i) => classifyRecipient(f, `m-${i}`));
}

// ── Merge tags + template defaults ───────────────────────────────────────────
export const MERGE_TAGS = [
  { tag: "{{name}}", label: "First name" },
  { tag: "{{company}}", label: "Company" },
  { tag: "{{role}}", label: "Role" },
  { tag: "{{round}}", label: "Round" },
] as const;

export const DEFAULT_SUBJECT =
  "Share your {{company}} interview - 5 mins, batch '27 needs it";

export const DEFAULT_BODY = `Hi {{name}},

Our records show you recently interviewed at {{company}} for the {{role}} role - specifically the {{round}} round. While the details are still fresh, would you mind sharing what it was like?

Batch '27 is gearing up for placements and your write-up could be the single most useful thing they read this month. It takes 5-7 mins, and you can post anonymously if you'd prefer.

Click below to start - we'll prefill what we already know:

   →  Share my {{company}} experience

Thanks for paying it forward,
Placement Ops`;

export function applyMerge(
  text: string,
  r: Pick<ParsedRecipient, "name" | "company" | "role" | "round"> | null,
): string {
  if (!r) return text;
  return text
    .replace(/\{\{name\}\}/g, (r.name || "there").split(" ")[0])
    .replace(/\{\{company\}\}/g, r.company || "the company")
    .replace(/\{\{role\}\}/g, r.role || "the role")
    .replace(/\{\{round\}\}/g, r.round || "your interview round");
}

// The CTA destination: the standard share form, pre-filled from the CSV row
// (PRD Flow F #6). /share reads these query params.
export function shareLinkPath(r: Pick<ParsedRecipient, "company" | "role" | "round">): string {
  const params = new URLSearchParams();
  if (r.company) params.set("company", r.company);
  if (r.role) params.set("role", r.role);
  if (r.round) params.set("round", r.round);
  const qs = params.toString();
  return qs ? `/share?${qs}` : "/share";
}

// ── Template CSV (download + demo dataset) ───────────────────────────────────
export const SAMPLE_CSV = `name,email,company,role,round,interview_date
Aanya Verma,aanya.23bcs10009@sst.scaler.com,Stripe,SDE Intern,System Design,2026-04-22
Kabir Joshi,kabir.23bcs10027@sst.scaler.com,Stripe,SDE Intern,DSA Round 2,2026-04-21
Ishita Bansal,ishita.23bcs10044@sst.scaler.com,Atlassian,SDE Intern,Hiring Manager,2026-04-19
Devansh Patel,devansh.23bcs10056@sst.scaler.com,Razorpay,SDE Intern,Final Loop,2026-04-18
Meera Iyer,meera.23bcs10063@sst.scaler.com,Stripe,SDE Intern,Coding Round,2026-04-17
Yash Khanna,yash.23bcs10078@sst.scaler.com,Microsoft,SDE Intern,OA + Tech 1,2026-04-15
Sneha Reddy,sneha.23bcs10089@sst.scaler.com,Walmart Global Tech,SDE Intern,Tech Round 2,2026-04-14
Arjun Mehta,arjun.23bcs10094@sst.scaler.com,Atlassian,SDE Intern,System Design,2026-04-12
Tanvi Shah,tanvi.23bcs10102@sst.scaler.com,Razorpay,SDE Intern,DSA Round 1,2026-04-11
Rohan Gupta,rohan.23bcs10118@sst.scaler.com,Amazon,SDE Intern,Bar Raiser,2026-04-10
Aarav S.,aarav.23bcs10084@sst.scaler.com,Razorpay,SDE Intern,DSA Round 1,2026-04-09
not-an-email,broken-row,,,Tech 1,
,empty.email@,Atlassian,SDE Intern,HM,2026-04-08`;
