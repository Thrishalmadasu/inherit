// End-to-end invariant test for the write loop (Session 2, PRD §7 B/C/E, §10).
// Drives the REAL write cores against the REAL database as the three seeded
// roles (student → moderator → student), then asserts through the REAL read
// queries — exactly what the UI consumes.
//   Run: npx tsx --env-file=.env.local db/verify-write-loop.ts
// (--env-file, not process.loadEnvFile: lib/db connects at import time.)
// Leaves test rows behind — reseed afterwards (npx tsx db/seed.ts).
import { eq, sql } from "drizzle-orm";
import { db, schema as s } from "../lib/db";
import {
  getEditPrefill,
  getMyPendingPost,
  getMyPosts,
  getOpsQueue,
  getSavedExperiences,
  getShareFormOptions,
  getViewerEngagement,
  listFeed,
  getExperience,
  getCompanyPage,
  listOpsCompanies,
  listOpsPublished,
  listOpsRoundTypes,
  listOpsUsers,
  listRecentRoleChanges,
} from "../lib/db/queries";
import { changeRoleCore } from "../lib/write/roles";
import { isModerator } from "../lib/auth";
import { recordViewCore, setHelpfulCore, setSavedCore } from "../lib/write/engagement";
import { submitExperienceCore, resubmitExperienceCore, WriteError } from "../lib/write/experiences";
import {
  approveCore,
  hideCore,
  rejectCore,
  resolveExperienceCompanyCore,
  suggestEditsCore,
  unhideCore,
} from "../lib/write/moderation";
import {
  addCompanyCore,
  addRoundTypeCore,
  mergeCompaniesCore,
  renameRoundTypeCore,
  setRoundTypeActiveCore,
} from "../lib/write/taxonomy";
import {
  deleteMyPostCore,
  restoreMyPostCore,
  resubmitWithdrawnCore,
  withdrawMyPostCore,
} from "../lib/write/my-posts";
import { sendInvitesCore } from "../lib/write/invites";
import { setEmailSenderForTest, type EmailSender } from "../lib/email";
import {
  loadSheetExperience,
  setSheetSyncForTest,
  syncPublishedExperience,
  type SheetRows,
} from "../lib/sheets";
import { buildSheetRows } from "../lib/sheets/rows";
import type { ShareDraftForm } from "../lib/draft";

// Belt + braces: even if .env.local grows real keys, this script must never
// email a student or write the L&D sheet. (The capturing sender below already
// overrides the seam; these pin the drivers for anything that escapes it.)
process.env.EMAIL_DRIVER = "console";
process.env.SHEETS_DRIVER = "console";

// Capturing sender: records every dispatch so transitions can assert who got
// mailed; invites report ok so rows stamp "sent" like a healthy prod send.
const sentEmails: { kind: "status" | "invite"; to: string; subject: string }[] = [];
const captureSender: EmailSender = {
  async sendStatus(e) {
    sentEmails.push({ kind: "status", to: e.to, subject: e.subject });
  },
  async sendInvites(emails) {
    emails.forEach((e) => sentEmails.push({ kind: "invite", to: e.to, subject: e.subject }));
    return emails.map((e) => ({ to: e.to, ok: true }));
  },
};
setEmailSenderForTest(captureSender);

let passed = 0;
function ok(cond: unknown, label: string) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ FAIL: ${label}`);
    process.exit(1);
  }
}

const form = (company: string, over: Partial<ShareDraftForm> = {}): ShareDraftForm => ({
  company,
  role: "SDE Intern",
  year: 2026,
  outcome: "Shortlisted",
  rounds: [
    {
      round: "OA",
      status: "Passed",
      detailed: true,
      platform: "HackerRank",
      note: "",
      blocks: [
        {
          type: "coding",
          prompt: "Verify-script question: sliding window over prefix sums.",
          topics: ["Sliding Window", "Arrays & Strings"],
          difficulty: 3,
          detail: "Two pointers after prefix sums.",
        },
      ],
    },
    { round: "Tech 1", status: "Awaiting", detailed: false, platform: "", note: "", blocks: [] },
  ],
  tips: [{ category: "resource", text: "Verify-script tip." }],
  reflection: "Verify-script reflection.",
  anonymous: false,
  ...over,
});

async function user(email: string) {
  const [u] = await db.select().from(s.users).where(eq(s.users.sstEmail, email));
  if (!u) throw new Error(`Seed user missing: ${email}`);
  return u;
}

async function visibleEverywhere(id: string, company: string): Promise<{ feed: boolean; direct: boolean; companyPage: boolean }> {
  const [feed, direct, page] = await Promise.all([
    listFeed(),
    getExperience(id),
    getCompanyPage(company),
  ]);
  return {
    feed: feed.some((e) => e.id === id),
    direct: direct !== null,
    companyPage: page?.experiences.some((e) => e.id === id) ?? false,
  };
}

async function main() {
  const student1 = await user("aarav.23bcs10084@sst.scaler.com"); // student
  const student2 = await user("priya.23bcs10112@sst.scaler.com"); // student
  const moderator = await user("riya.23bcs10043@sst.scaler.com"); // moderator

  console.log("\n— Flow B: student submits → under review, FIFO, invisible —");
  const id1 = await submitExperienceCore(student1, form("Amazon"));
  const id2 = await submitExperienceCore(student2, form("Microsoft", { anonymous: true }));
  let queue = (await getOpsQueue()).items;
  ok(queue.length === 2, "queue has both submissions");
  ok(queue[0].id === id1 && queue[1].id === id2, "FIFO: first submitted is first in queue");
  ok(queue[1].bylineAs === "anonymous", "anonymous byline flagged for Ops");
  ok(queue[1].realAuthor.email === student2.sstEmail, "Ops still sees real identity");
  let vis = await visibleEverywhere(id1, "amazon");
  ok(!vis.feed && !vis.direct && !vis.companyPage, "pending post invisible on every read surface");
  const pending1 = await getMyPendingPost(student1.id);
  ok(pending1?.id === id1, "author's Under Review page finds the pending post");
  const notif1 = await db.select().from(s.notifications).where(eq(s.notifications.experienceId, id1));
  ok(notif1.some((n) => n.type === "post_under_review"), "submit wrote post_under_review notification");

  console.log("\n— Flow E: moderator approves (publishes) —");
  await approveCore(moderator, id1);
  vis = await visibleEverywhere(id1, "amazon");
  ok(vis.feed && vis.direct && vis.companyPage, "approved post visible everywhere");
  let mine = await getMyPosts(student1.id);
  ok(mine.find((p) => p.id === id1)?.status === "Approved", "author sees Approved");
  ok(
    (await db.select().from(s.notifications).where(eq(s.notifications.experienceId, id1))).some(
      (n) => n.type === "post_live",
    ),
    "approve wrote post_live notification",
  );
  let err = "";
  try {
    await approveCore(moderator, id1);
  } catch (e) {
    err = e instanceof WriteError ? e.message : "";
  }
  ok(err.includes("no longer"), "double-approve rejected");

  console.log("\n— Flow E: suggest edits → needs_edits with note —");
  await suggestEditsCore(moderator, id2, "Please remove the interviewer's name.");
  mine = await getMyPosts(student2.id);
  const p2 = mine.find((p) => p.id === id2);
  ok(p2?.status === "Needs Edits" && p2.opsNote?.includes("interviewer"), "author sees Needs Edits + note");
  ok(((await getOpsQueue()).items).length === 0, "needs_edits post left the queue");

  console.log("\n— Flow C: edit → resubmit joins the BACK of the queue —");
  const prefill = await getEditPrefill(id2, student2.id);
  ok(prefill?.form.rounds[0].blocks[0].topics.includes("Sliding Window"), "edit prefill restores topics from DB");
  const id3 = await submitExperienceCore(student1, form("Google")); // queued first
  await resubmitExperienceCore(student2, id2, { ...prefill!.form, role: "SDE-1" });
  queue = (await getOpsQueue()).items;
  ok(queue.length === 2 && queue[0].id === id3 && queue[1].id === id2, "resubmission is BEHIND the newer submission (back of FIFO)");
  ok(queue[1].role === "SDE-1", "resubmitted content replaced");
  mine = await getMyPosts(student2.id);
  ok(mine.find((p) => p.id === id2)?.status === "Under Review", "status reset to Under Review");

  console.log("\n— §10: editing an APPROVED post pulls the live version —");
  const pre1 = await getEditPrefill(id1, student1.id);
  await resubmitExperienceCore(student1, id1, pre1!.form);
  vis = await visibleEverywhere(id1, "amazon");
  ok(!vis.feed && !vis.direct && !vis.companyPage, "live version hidden until re-approval");
  queue = (await getOpsQueue()).items;
  ok(queue[queue.length - 1].id === id1, "edited-approved post is at the back of the queue");
  await approveCore(moderator, id1);
  ok((await visibleEverywhere(id1, "amazon")).feed, "re-approved → visible again");

  console.log("\n— Flow E: reject with reason —");
  await rejectCore(moderator, id3, "Duplicate of an existing post.");
  mine = await getMyPosts(student1.id);
  const p3 = mine.find((p) => p.id === id3);
  ok(p3?.status === "Rejected" && p3.opsNote?.includes("Duplicate"), "author sees Rejected + reason");
  err = "";
  try {
    await rejectCore(moderator, id2, "  ");
  } catch (e) {
    err = e instanceof WriteError ? e.message : "";
  }
  ok(err.includes("reason"), "reject without reason refused");

  console.log("\n— §10: hide a published post (reason required, logged) —");
  err = "";
  try {
    await hideCore(moderator, id1, "");
  } catch (e) {
    err = e instanceof WriteError ? e.message : "";
  }
  ok(err.includes("reason"), "hide without reason refused");
  await hideCore(moderator, id1, "Round count disputed by two later interviewees.");
  vis = await visibleEverywhere(id1, "amazon");
  ok(!vis.feed && !vis.direct && !vis.companyPage, "hidden post vanished from every read surface");
  mine = await getMyPosts(student1.id);
  const h1 = mine.find((p) => p.id === id1);
  ok(h1?.status === "Hidden" && h1.hiddenReason?.includes("disputed"), "author sees Hidden + reason");
  const modLog = await db.select().from(s.moderationActions).where(eq(s.moderationActions.experienceId, id1));
  ok(modLog.some((m) => m.action === "hide" && m.actorId === moderator.id && m.reason), "moderation_actions logged who/why");
  ok(
    (await db.select().from(s.notifications).where(eq(s.notifications.experienceId, id1))).some(
      (n) => n.type === "post_hidden",
    ),
    "hide notified the author",
  );
  const opsPub = (await listOpsPublished()).items;
  ok(opsPub.find((e) => e.id === id1)?.hiddenAt != null, "Ops Published view flags the hidden post");

  console.log("\n— §10: unhide reverses (logged) —");
  await unhideCore(moderator, id1);
  ok((await visibleEverywhere(id1, "amazon")).feed, "unhidden post is live again");
  const modLog2 = await db.select().from(s.moderationActions).where(eq(s.moderationActions.experienceId, id1));
  ok(modLog2.some((m) => m.action === "unhide"), "unhide appended to moderation_actions");

  console.log("\n— author soft-delete / restore —");
  await deleteMyPostCore(student1, id1);
  ok(!(await visibleEverywhere(id1, "amazon")).feed, "author-deleted post vanished from read surfaces");
  mine = await getMyPosts(student1.id);
  ok(mine.find((p) => p.id === id1)?.status === "Deleted", "author sees Deleted");
  await restoreMyPostCore(student1, id1);
  ok((await visibleEverywhere(id1, "amazon")).feed, "restore brings it back (still approved)");

  console.log("\n— withdraw / resubmit —");
  const id4 = await submitExperienceCore(student2, form("Atlassian"));
  await withdrawMyPostCore(student2, id4);
  ok(!((await getOpsQueue()).items).some((q) => q.id === id4), "withdrawn post left the queue");
  ok((await getMyPendingPost(student2.id))?.id !== id4, "withdrawn post is not 'pending' for the author");
  ok((await getMyPosts(student2.id)).find((p) => p.id === id4)?.status === "Withdrawn", "author sees Withdrawn");
  await resubmitWithdrawnCore(student2, id4);
  queue = (await getOpsQueue()).items;
  ok(queue[queue.length - 1].id === id4, "resubmitted withdrawal joins the back of the queue");

  console.log("\n— authorization edges —");
  err = "";
  try {
    await resubmitExperienceCore(student1, id4, form("Atlassian")); // not the author
  } catch (e) {
    err = e instanceof WriteError ? e.message : "";
  }
  ok(err.includes("not found"), "editing someone else's post refused");
  err = "";
  try {
    await submitExperienceCore(student1, {
      ...form("Amazon"),
      rounds: [{ ...form("Amazon").rounds[0], blocks: [{ type: "coding", prompt: "x", topics: ["Made Up Tag"], difficulty: 3, detail: "" }] }],
    } as ShareDraftForm);
  } catch (e) {
    err = e instanceof Error ? e.message : "";
  }
  ok(err.length > 0, "non-curated tag refused");

  // id1 is approved + visible here; id3 was rejected above.
  const expRow = async (id: string) =>
    (await db.select().from(s.experiences).where(eq(s.experiences.id, id)))[0];

  console.log("\n— engagement: Helpful votes (cached count ↔ reaction rows) —");
  await setHelpfulCore(student2, id1, true);
  ok((await expRow(id1)).helpfulCount === 1, "helpful on → cached count 1");
  await setHelpfulCore(student2, id1, true);
  ok((await expRow(id1)).helpfulCount === 1, "repeat helpful is idempotent (count unmoved)");
  ok(
    (await db.select().from(s.reactions).where(eq(s.reactions.experienceId, id1))).length === 1,
    "exactly one reactions row per user+experience",
  );
  err = "";
  try {
    await db.insert(s.reactions).values({ userId: student2.id, experienceId: id1 });
  } catch (e) {
    err = String(e);
  }
  ok(err.length > 0, "raw duplicate reaction rejected by the DB (UNIQUE is the invariant)");
  ok((await getViewerEngagement(student2.id, id1)).helpful, "viewer-engagement read sees the vote");
  await setHelpfulCore(moderator, id1, true);
  ok((await expRow(id1)).helpfulCount === 2, "second voter → count 2");
  ok(
    (await listFeed()).find((e) => e.id === id1)?.helpful === 2,
    "feed card carries the real count (the Most-helpful sort input)",
  );
  await setHelpfulCore(moderator, id1, false);
  ok((await expRow(id1)).helpfulCount === 1, "un-helpful decrements");
  await setHelpfulCore(moderator, id1, false);
  ok((await expRow(id1)).helpfulCount === 1, "repeat un-helpful is a no-op (count can't drift)");
  err = "";
  try {
    await setHelpfulCore(student1, id3, true); // id3 is rejected, not live
  } catch (e) {
    err = e instanceof WriteError ? e.message : "";
  }
  ok(err.includes("not found"), "helpful on a non-live post refused");

  console.log("\n— engagement: view counts (every open counts) —");
  await recordViewCore(student2, id1);
  await recordViewCore(student2, id1);
  ok((await expRow(id1)).viewCount === 2, "same user opening twice counts twice (total opens)");
  await recordViewCore(moderator, id1);
  ok((await expRow(id1)).viewCount === 3, "every viewer's open adds one");
  await recordViewCore(student1, id3); // not live → no-op, no throw
  ok((await expRow(id3)).viewCount === 0, "views on a non-live post don't count");
  ok(
    (await listFeed()).find((e) => e.id === id1)?.views === 3,
    "feed card carries the real count (the Most-viewed sort input)",
  );

  console.log("\n— engagement: saves + the visibility invariant —");
  await setSavedCore(student2, id1, true);
  await setSavedCore(student2, id1, true); // idempotent
  let savedList = (await getSavedExperiences(student2.id)).items;
  ok(savedList.length === 1 && savedList[0].id === id1, "saved list shows the bookmark once");
  ok((await getViewerEngagement(student2.id, id1)).saved, "viewer-engagement read sees the save");
  await hideCore(moderator, id1, "Verify-script hide for the saved-tab invariant.");
  ok(((await getSavedExperiences(student2.id)).items).length === 0, "hidden post drops out of the saved list");
  await unhideCore(moderator, id1);
  ok(((await getSavedExperiences(student2.id)).items).length === 1, "unhide brings the bookmark back");
  await setSavedCore(student2, id1, false);
  ok(((await getSavedExperiences(student2.id)).items).length === 0, "unsave removes it");

  console.log("\n— Flow F: invite-to-share (CSV → campaign + recipients, NO dedupe) —");
  // Header aliases on purpose (full_name/email_address/employer/position/stage).
  // student1 already has a live post AND the same email appears twice — with no
  // dedupe every valid row still sends (per-experience invites; Ops owns it).
  const inviteCsv = [
    "full_name,email_address,employer,position,stage",
    "Fresh Invitee,invitee.23bcs10999@sst.scaler.com,Stripe,SDE Intern,System Design",
    `Already Shared,${student1.sstEmail},Amazon,SDE Intern,OA`,
    "Dupe Row,invitee.23bcs10999@sst.scaler.com,Stripe,SDE Intern,System Design",
    "Bad Email,not-an-email,Stripe,SDE Intern,OA",
  ].join("\n");
  const sent1 = await sendInvitesCore(moderator, {
    csv: inviteCsv,
    fileName: "verify.csv",
    subject: "Share your {{company}} interview",
    body: "Hi {{name}} — {{role}}, {{round}}.",
  });
  ok(
    sent1.sent === 3 && sent1.errors === 1,
    "no dedupe: already-shared student + in-file duplicate both send; only the bad email errors",
  );
  const [camp] = await db
    .select()
    .from(s.inviteCampaigns)
    .where(eq(s.inviteCampaigns.createdByUserId, moderator.id));
  ok(
    camp.readyCount === 3 && camp.skippedCount === 0 && camp.errorCount === 1 && !!camp.sentAt,
    "campaign row records the counts and templates",
  );
  const recRows = await db
    .select()
    .from(s.inviteRecipients)
    .where(eq(s.inviteRecipients.campaignId, camp.id));
  ok(recRows.length === 4, "every CSV row recorded for the audit trail");
  ok(
    recRows.find((r) => r.email === student1.sstEmail)?.status === "sent" &&
      recRows.find((r) => r.email === "not-an-email")?.skipReason === "invalid_email",
    "already-shared student is now SENT (not skipped); bad email recorded with its reason",
  );
  const dupeRows = recRows.filter((r) => r.email === "invitee.23bcs10999@sst.scaler.com");
  ok(
    dupeRows.length === 2 && dupeRows.every((r) => r.status === "sent" && !!r.sentAt),
    "both rows for the duplicated email are sent and stamped (no in-file dedupe)",
  );
  ok(
    sentEmails.filter(
      (e) => e.kind === "invite" && e.to === "invitee.23bcs10999@sst.scaler.com",
    ).length === 2,
    "the duplicate email was dispatched twice",
  );
  const rerun = await sendInvitesCore(moderator, {
    csv: inviteCsv,
    fileName: "verify.csv",
    subject: "s",
    body: "b",
  });
  ok(
    rerun.sent === 3 && rerun.errors === 1,
    "re-running the SAME CSV sends again — no cross-campaign dedupe (the fix)",
  );

  console.log("\n— Flow F: dispatch failure → row marked failed, re-sendable —");
  const failEmail = "failcase.23bcs10001@sst.scaler.com";
  setEmailSenderForTest({
    ...captureSender,
    async sendInvites(emails) {
      return emails.map((e) => ({ to: e.to, ok: false, error: "verify-script outage" }));
    },
  });
  const failRes = await sendInvitesCore(moderator, {
    csv: `name,email\nFail Case,${failEmail}`,
    fileName: null,
    subject: "s",
    body: "b",
  });
  setEmailSenderForTest(captureSender);
  ok(failRes.sent === 0 && failRes.failed === 1, "dispatch failure surfaces in the result counts");
  const [failRow] = await db
    .select()
    .from(s.inviteRecipients)
    .where(eq(s.inviteRecipients.email, failEmail));
  ok(
    failRow?.status === "failed" && !failRow.sentAt,
    "failed dispatch recorded on the row (re-send by re-uploading the CSV)",
  );

  console.log("\n— roadmap #5: review-status emails (Flow D) —");
  sentEmails.length = 0;
  // Make this company canonical up front so the submissions below bind directly
  // (concern #10 added the resolve-before-approve gate; this section is about
  // emails/sheets, not company resolution).
  await addCompanyCore(moderator, { name: "Verify Sheets Co" });
  const sheetForm = form("Verify Sheets Co", {
    rounds: [
      {
        round: "OA",
        status: "Passed",
        detailed: true,
        platform: "HackerRank",
        note: "",
        blocks: [
          {
            type: "coding",
            prompt: "Sheet-test: max subarray after k swaps.",
            topics: ["Sliding Window", "Arrays & Strings"],
            difficulty: 3,
            detail: "",
          },
        ],
      },
      {
        round: "Hiring Manager",
        status: "Awaiting",
        detailed: true,
        platform: "",
        note: "",
        blocks: [
          {
            type: "behavioral",
            prompt: "Tell me about a conflict you resolved.",
            topics: ["Conflict Resolution", "Teamwork"],
            difficulty: null,
            detail: "Looked for ownership of the resolution.",
          },
        ],
      },
    ],
  });
  const sheetExpId = await submitExperienceCore(student2, sheetForm);
  ok(
    sentEmails.some(
      (e) => e.kind === "status" && e.to === student2.sstEmail && /review queue/.test(e.subject),
    ),
    "submit → 'in the review queue' email to the author",
  );
  await approveCore(moderator, sheetExpId);
  ok(
    sentEmails.some((e) => e.to === student2.sstEmail && /is live/.test(e.subject)),
    "approve → 'is live' email",
  );
  const edits1 = await submitExperienceCore(student1, form("Verify Sheets Co"));
  await suggestEditsCore(moderator, edits1, "Trim the interviewer anecdote.");
  ok(
    sentEmails.some((e) => e.to === student1.sstEmail && /needs a quick edit/.test(e.subject)),
    "suggest-edits → 'needs a quick edit' email",
  );
  await resubmitExperienceCore(student1, edits1, form("Verify Sheets Co"));
  await rejectCore(moderator, edits1, "Not enough detail to be useful.");
  ok(
    sentEmails.some((e) => e.to === student1.sstEmail && /wasn't approved/.test(e.subject)),
    "reject → 'wasn't approved' email",
  );

  console.log("\n— roadmap #5: L&D sheet rows (PRD §13) —");
  const sheetExp = await loadSheetExperience(sheetExpId);
  const rows = buildSheetRows(sheetExp!, "https://example.test");
  ok(
    rows.technical.length === 1 && rows.behavioral.length === 1,
    "one technical + one behavioral row (only coding/SD/behavioral blocks sync)",
  );
  const t = rows.technical[0];
  ok(
    t.company === "Verify Sheets Co" &&
      t.category === "Coding" &&
      t.round === "OA" &&
      t.cycle === 2026,
    "technical row carries company/category/round/cycle",
  );
  ok(
    t.isDsa && t.topics.includes("Sliding Window") && t.tools.includes("HackerRank"),
    "technical row: DSA split from tags, platform lands in tools",
  );
  ok(
    t.difficulty === 3 && t.link === `https://example.test/experiences/${sheetExpId}`,
    "technical row: difficulty + absolute link",
  );
  const b = rows.behavioral[0];
  ok(
    b.round === "Hiring Manager" &&
      b.competencies.includes("Conflict Resolution") &&
      /ownership/.test(b.notes),
    "behavioral row: round/competencies/looked-for notes",
  );

  const appended: SheetRows[] = [];
  setSheetSyncForTest({
    async appendPublished(r) {
      appended.push(r);
    },
  });
  await syncPublishedExperience(sheetExpId);
  const [syncedRow] = await db
    .select()
    .from(s.experiences)
    .where(eq(s.experiences.id, sheetExpId));
  ok(appended.length === 1 && !!syncedRow.sheetSyncedAt, "sync appends once and stamps sheet_synced_at");
  await syncPublishedExperience(sheetExpId);
  ok(appended.length === 1, "second sync is a no-op (append-on-FIRST-publish)");
  await syncPublishedExperience(edits1); // rejected above
  ok(appended.length === 1, "a non-live (rejected) post never reaches the sheet");
  setSheetSyncForTest(null);

  console.log("\n— roadmap #1/#2: role management (super-admin only, audited) —");
  const superAdmin = await user("thrishal.23bcs10115@sst.scaler.com"); // super_admin
  const rejects = async (fn: () => Promise<unknown>): Promise<string> => {
    try {
      await fn();
      return "";
    } catch (e) {
      return e instanceof WriteError ? e.message : `WRONG ERROR: ${e}`;
    }
  };

  ok(
    (await rejects(() => changeRoleCore(moderator, student1.id, "moderator"))).includes("super admin"),
    "a moderator cannot change roles (super-admin only)",
  );

  const promoted = await changeRoleCore(superAdmin, student1.id, "moderator", "joining the ops team");
  ok(
    promoted.fromRole === "student" && promoted.toRole === "moderator",
    "super admin promotes student → moderator",
  );
  const [afterPromote] = await db.select().from(s.users).where(eq(s.users.id, student1.id));
  ok(afterPromote.role === "moderator", "users row reflects the new role");

  const audit = await listRecentRoleChanges(5);
  ok(
    audit.some(
      (a) =>
        a.who === student1.name &&
        a.toRole === "moderator" &&
        a.by === superAdmin.name &&
        a.reason === "joining the ops team",
    ),
    "role change written to the audit trail (who / by / reason)",
  );

  ok(
    (await rejects(() => changeRoleCore(superAdmin, student1.id, "moderator"))).includes("Already"),
    "no-op: promoting to the same role is rejected",
  );
  ok(
    (await rejects(() => changeRoleCore(superAdmin, student1.id, "wizard"))).includes("Unknown role"),
    "unknown role is rejected",
  );

  // Lockout guard: Thrishal is the only super admin in the seed.
  ok(
    (await rejects(() => changeRoleCore(superAdmin, superAdmin.id, "student"))).includes(
      "last super admin",
    ),
    "can't demote the last super admin (lockout guard)",
  );
  // Promote a second super admin → the guard releases.
  await changeRoleCore(superAdmin, student2.id, "super_admin");
  const student2Admin = await user(student2.sstEmail); // now super_admin in DB
  const selfDemote = await changeRoleCore(superAdmin, superAdmin.id, "moderator");
  ok(selfDemote.toRole === "moderator", "with a 2nd super admin present, self-demotion is allowed");
  await changeRoleCore(student2Admin, superAdmin.id, "super_admin"); // restore Thrishal

  // Paginated + searchable list (concern #6).
  const search = await listOpsUsers({ q: "aarav" });
  ok(search.users.some((u) => u.id === student1.id), "listOpsUsers search matches by name/email");
  const pageOne = await listOpsUsers({ page: 1, pageSize: 2 });
  ok(
    pageOne.users.length <= 2 && pageOne.pageSize === 2 && pageOne.totalPages >= 1,
    "listOpsUsers respects pagination bounds",
  );

  // #4: destructive hide/unhide gate is the ROLE (requireModerator), never the
  // OPS_EMAILS bootstrap — so a student helping triage can't hide a live post.
  const freshStudent = await user("nikhil.23bcs10071@sst.scaler.com"); // untouched student
  ok(!isModerator(freshStudent), "a student is NOT a moderator (hide gate is role-only)");
  ok(isModerator(moderator), "a moderator passes the destructive-action gate");
  ok(isModerator(await user("thrishal.23bcs10115@sst.scaler.com")), "a super admin counts as moderator");

  console.log("\n— concern #10: canonical entities, zero duplicates —");

  // Canonical round/topic validation: students can only use active DB rows.
  ok(
    (
      await rejects(() =>
        submitExperienceCore(student1, {
          ...form("Amazon"),
          rounds: [
            { round: "Totally Made-Up Round", status: "Passed", detailed: false, platform: "", note: "", blocks: [] },
          ],
        } as ShareDraftForm),
      )
    ).includes("Unknown round type"),
    "non-canonical round type refused at submit",
  );

  // Proposed-company flow: an unknown company is NOT auto-created — it rides as
  // a proposed name until a moderator resolves it (the single gate).
  const propId = await submitExperienceCore(student1, form("Goldman Sachs Pvt"));
  let propRow = await expRow(propId);
  ok(
    propRow.companyId === null && propRow.proposedCompanyName === "Goldman Sachs Pvt",
    "unknown company rides as a proposed name (not auto-created)",
  );
  ok(
    (await db.select().from(s.companies).where(sql`lower(name) = ${"goldman sachs pvt"}`)).length === 0,
    "no speculative company row was created",
  );
  ok(
    (await rejects(() => approveCore(moderator, propId))).includes("Resolve the proposed company"),
    "approve is blocked until the proposed company is resolved",
  );

  // Resolve by PROMOTING to a new canonical company → approve unblocks.
  const promoteCo = await resolveExperienceCompanyCore(moderator, propId, {
    newCompany: { name: "Goldman Sachs", industry: "Investment Banking" },
  });
  ok(promoteCo.companyName === "Goldman Sachs", "moderator promotes the proposal to a canonical company");
  propRow = await expRow(propId);
  ok(
    propRow.companyId != null && propRow.proposedCompanyName === null,
    "experience binds to the canonical company; proposal cleared",
  );
  await approveCore(moderator, propId);
  ok((await visibleEverywhere(propId, "goldman-sachs")).feed, "resolved + approved post is visible");

  // Resolve by MAPPING to an existing company → the typed spelling becomes an
  // alias, so the NEXT student typing it auto-binds (dedup at the root).
  const varId = await submitExperienceCore(student2, form("Amzn"));
  ok((await expRow(varId)).companyId === null, "a variant spelling rides as proposed too");
  const [amazon] = await db.select().from(s.companies).where(eq(s.companies.slug, "amazon"));
  await resolveExperienceCompanyCore(moderator, varId, { existingCompanyId: amazon.id });
  ok((await expRow(varId)).companyId === amazon.id, "mapping binds the experience to the existing company");
  const [amazonAfter] = await db.select().from(s.companies).where(eq(s.companies.id, amazon.id));
  ok(
    amazonAfter.aliases.map((a) => a.toLowerCase()).includes("amzn"),
    "the mapped spelling is folded in as an alias",
  );
  const varId2 = await submitExperienceCore(student1, form("Amzn"));
  ok(
    (await expRow(varId2)).companyId === amazon.id,
    "the next submission of that spelling auto-binds — no second proposal",
  );

  // Taxonomy management (moderator-gated): add / rename-propagation / merge.
  ok(
    (await rejects(() => addCompanyCore(moderator, { name: "Amazon" }))).includes("already exists"),
    "adding a duplicate company is rejected",
  );
  await addRoundTypeCore(moderator, "Pair Programming");
  const ppId = await submitExperienceCore(
    student1,
    form("Amazon", {
      rounds: [
        { round: "Pair Programming", status: "Passed", detailed: false, platform: "", note: "", blocks: [] },
      ],
    }),
  );
  const [ppType] = await db.select().from(s.roundTypes).where(eq(s.roundTypes.label, "Pair Programming"));
  await renameRoundTypeCore(moderator, ppType.id, "Pairing Round");
  const ppRounds = await db.select().from(s.rounds).where(eq(s.rounds.experienceId, ppId));
  ok(
    ppRounds.length > 0 && ppRounds.every((r) => r.name === "Pairing Round"),
    "renaming a round type propagates to existing rounds.name",
  );

  const acmeA = await addCompanyCore(moderator, { name: "Acme Labs" });
  const acmeExp = await submitExperienceCore(student1, form("Acme Labs"));
  ok((await expRow(acmeExp)).companyId === acmeA.id, "a submission binds to a just-added canonical company");
  const acmeB = await addCompanyCore(moderator, { name: "Acme Corporation" });
  const merged = await mergeCompaniesCore(moderator, acmeA.id, acmeB.id);
  ok(merged.moved >= 1 && merged.target === "Acme Corporation", "merge reports moved count + target");
  ok((await expRow(acmeExp)).companyId === acmeB.id, "merge repoints experiences to the target company");
  ok(
    (await db.select().from(s.companies).where(eq(s.companies.id, acmeA.id))).length === 0,
    "the source company row is deleted after merge",
  );
  const [acmeBAfter] = await db.select().from(s.companies).where(eq(s.companies.id, acmeB.id));
  ok(
    acmeBAfter.aliases.map((a) => a.toLowerCase()).includes("acme labs"),
    "the source name is folded into the target's aliases",
  );

  // Share-form options + Ops taxonomy reads.
  const shareOpts = await getShareFormOptions();
  ok(
    shareOpts.roundTypes.includes("OA") && shareOpts.companies.some((c) => c.name === "Amazon"),
    "getShareFormOptions exposes active round types + canonical companies",
  );
  ok(
    shareOpts.topics.some((t) => t.label === "Sliding Window"),
    "getShareFormOptions exposes the active topic taxonomy",
  );
  const [barRaiser] = await db.select().from(s.roundTypes).where(eq(s.roundTypes.label, "Bar Raiser"));
  await setRoundTypeActiveCore(moderator, barRaiser.id, false);
  ok(
    !(await getShareFormOptions()).roundTypes.includes("Bar Raiser"),
    "a deactivated round type drops out of the share-form list",
  );
  const opsCos = await listOpsCompanies("acme");
  ok(opsCos.some((c) => c.name === "Acme Corporation"), "listOpsCompanies search matches by name/alias");
  ok(
    (await listOpsRoundTypes()).some((r) => r.label === "Pairing Round"),
    "listOpsRoundTypes returns the managed round vocabulary",
  );

  console.log(`\nAll ${passed} assertions passed. Reseed before deploying: npx tsx db/seed.ts`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
