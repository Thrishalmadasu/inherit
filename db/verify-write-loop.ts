// End-to-end invariant test for the write loop (Session 2, PRD §7 B/C/E, §10).
// Drives the REAL write cores against the REAL database as the three seeded
// roles (student → moderator → student), then asserts through the REAL read
// queries — exactly what the UI consumes.
//   Run: npx tsx --env-file=.env.local db/verify-write-loop.ts
// (--env-file, not process.loadEnvFile: lib/db connects at import time.)
// Leaves test rows behind — reseed afterwards (npx tsx db/seed.ts).
import { eq } from "drizzle-orm";
import { db, schema as s } from "../lib/db";
import {
  getEditPrefill,
  getInviteDedupe,
  getMyPendingPost,
  getMyPosts,
  getOpsQueue,
  getSavedExperiences,
  getViewerEngagement,
  listFeed,
  getExperience,
  getCompanyPage,
  listOpsPublished,
} from "../lib/db/queries";
import { recordViewCore, setHelpfulCore, setSavedCore } from "../lib/write/engagement";
import { submitExperienceCore, resubmitExperienceCore, WriteError } from "../lib/write/experiences";
import {
  approveCore,
  hideCore,
  rejectCore,
  suggestEditsCore,
  unhideCore,
} from "../lib/write/moderation";
import {
  deleteMyPostCore,
  restoreMyPostCore,
  resubmitWithdrawnCore,
  withdrawMyPostCore,
} from "../lib/write/my-posts";
import { sendInvitesCore } from "../lib/write/invites";
import type { ShareDraftForm } from "../lib/draft";

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
  let queue = await getOpsQueue();
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
  ok((await getOpsQueue()).length === 0, "needs_edits post left the queue");

  console.log("\n— Flow C: edit → resubmit joins the BACK of the queue —");
  const prefill = await getEditPrefill(id2, student2.id);
  ok(prefill?.form.rounds[0].blocks[0].topics.includes("Sliding Window"), "edit prefill restores topics from DB");
  const id3 = await submitExperienceCore(student1, form("Google")); // queued first
  await resubmitExperienceCore(student2, id2, { ...prefill!.form, role: "SDE-1" });
  queue = await getOpsQueue();
  ok(queue.length === 2 && queue[0].id === id3 && queue[1].id === id2, "resubmission is BEHIND the newer submission (back of FIFO)");
  ok(queue[1].role === "SDE-1", "resubmitted content replaced");
  mine = await getMyPosts(student2.id);
  ok(mine.find((p) => p.id === id2)?.status === "Under Review", "status reset to Under Review");

  console.log("\n— §10: editing an APPROVED post pulls the live version —");
  const pre1 = await getEditPrefill(id1, student1.id);
  await resubmitExperienceCore(student1, id1, pre1!.form);
  vis = await visibleEverywhere(id1, "amazon");
  ok(!vis.feed && !vis.direct && !vis.companyPage, "live version hidden until re-approval");
  queue = await getOpsQueue();
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
  const opsPub = await listOpsPublished();
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
  ok(!(await getOpsQueue()).some((q) => q.id === id4), "withdrawn post left the queue");
  ok((await getMyPendingPost(student2.id))?.id !== id4, "withdrawn post is not 'pending' for the author");
  ok((await getMyPosts(student2.id)).find((p) => p.id === id4)?.status === "Withdrawn", "author sees Withdrawn");
  await resubmitWithdrawnCore(student2, id4);
  queue = await getOpsQueue();
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
  let savedList = await getSavedExperiences(student2.id);
  ok(savedList.length === 1 && savedList[0].id === id1, "saved list shows the bookmark once");
  ok((await getViewerEngagement(student2.id, id1)).saved, "viewer-engagement read sees the save");
  await hideCore(moderator, id1, "Verify-script hide for the saved-tab invariant.");
  ok((await getSavedExperiences(student2.id)).length === 0, "hidden post drops out of the saved list");
  await unhideCore(moderator, id1);
  ok((await getSavedExperiences(student2.id)).length === 1, "unhide brings the bookmark back");
  await setSavedCore(student2, id1, false);
  ok((await getSavedExperiences(student2.id)).length === 0, "unsave removes it");

  console.log("\n— Flow F: invite-to-share (CSV → campaign + recipients, dedupe) —");
  // Header aliases on purpose (full_name/email_address/employer/position/stage).
  // student1 has a live post by now → must be skipped as already_shared.
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
    sent1.sent === 1 && sent1.skipped === 2 && sent1.errors === 1,
    "buckets: 1 ready (aliased headers), already-shared + in-file dupe skipped, bad email errored",
  );
  const [camp] = await db
    .select()
    .from(s.inviteCampaigns)
    .where(eq(s.inviteCampaigns.createdByUserId, moderator.id));
  ok(
    camp.readyCount === 1 && camp.skippedCount === 2 && camp.errorCount === 1 && !!camp.sentAt,
    "campaign row records the counts and templates",
  );
  const recRows = await db
    .select()
    .from(s.inviteRecipients)
    .where(eq(s.inviteRecipients.campaignId, camp.id));
  ok(recRows.length === 4, "every CSV row recorded for the audit trail");
  ok(
    recRows.find((r) => r.email === student1.sstEmail)?.skipReason === "already_shared" &&
      recRows.find((r) => r.email === "not-an-email")?.skipReason === "invalid_email",
    "skip reasons stored per recipient",
  );
  ok(
    (await getInviteDedupe()).alreadyInvited.includes("invitee.23bcs10999@sst.scaler.com"),
    "sent recipient joins the dedupe set",
  );
  await sendInvitesCore(moderator, {
    csv: inviteCsv,
    fileName: "verify.csv",
    subject: "s",
    body: "b",
  }).then(
    () => ok(false, "re-running the same campaign must refuse"),
    (e) =>
      ok(
        e instanceof WriteError && /No ready recipients/.test(e.message),
        "same CSV next day: everyone already invited/shared → send refused",
      ),
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
