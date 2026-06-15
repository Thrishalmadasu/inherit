// Shared share-form draft persistence (localStorage) - used by the share form
// (autosave), My Posts, and the dashboard resume strip. Client-only.
// Tonight this is the system of record for drafts; server drafts come later.

export interface DraftQuestion {
  topics: string[];
  text: string;
}

export type DraftBlockType = "coding" | "system_design" | "behavioral" | "open";

export interface DraftBlock {
  type: DraftBlockType;
  prompt: string;
  topics: string[];
  detail: string;
}

export interface DraftRound {
  round: string;
  status: "Passed" | "Failed" | "Awaiting";
  detailed: boolean;
  platform: string;
  note: string;
  blocks: DraftBlock[];
}

export interface DraftTip {
  category: "resource" | "strategy" | "mindset";
  text: string;
}

export interface ShareDraftForm {
  company: string;
  role: string;
  year: number;
  outcome: string;
  rounds: DraftRound[];
  tips: DraftTip[];
  reflection: string;
  anonymous: boolean;
}

export interface ShareDraft {
  form: ShareDraftForm;
  step?: number; // wizard step the user was on, so a reload resumes in place
  startedAt: number;
  savedAt: number;
}

export const DRAFT_KEY = "inherit:draft:share";
export const editDraftKey = (postId: string) => `inherit:edit:${postId}`;

export function loadDraft(key: string = DRAFT_KEY): ShareDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw) as ShareDraft;
    if (!d || typeof d !== "object" || !d.form) return null;
    return d;
  } catch {
    return null;
  }
}

export function saveDraft(draft: ShareDraft, key: string = DRAFT_KEY) {
  try {
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // storage full/blocked - drafts are best-effort
  }
}

export function clearDraft(key: string = DRAFT_KEY) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// A draft only "counts" once the user actually touched something - prevents
// the pristine seed form from showing up as a draft on /me and the dashboard.
export function draftTouched(d: ShareDraft | null): d is ShareDraft {
  if (!d) return false;
  const f = d.form;
  return Boolean(
    f.company?.trim() ||
      f.role?.trim() ||
      f.outcome ||
      f.rounds?.some((r) => r.detailed || r.blocks?.length > 0) ||
      f.reflection?.trim() ||
      f.tips?.some((t) => t.text?.trim()),
  );
}

export function relativeTime(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
