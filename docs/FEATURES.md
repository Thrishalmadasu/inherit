# Inherit: what it does

Inherit is a private site for SST where students write up their placement
interviews (OAs and rounds) in a structured way, so juniors and batchmates
preparing for the same companies can actually use them later. Only people with
an `@sst.scaler.com` account can get in.

It is just as much a tool for the placement team: they control what gets
published through a review queue, they can nudge students who just finished
interviews with one CSV upload instead of chasing them individually, and every
approved post lands in their own tracker sheet automatically, so the data
collection they do by hand today happens on its own.

Live at https://sst-inherit.vercel.app

This doc lists everything that works today, first the student side, then the
admin side for the placement team.

## Student side

**Signing in.** Students log in with their college Google account. There is no
separate password, and only `@sst.scaler.com` accounts can get in.

**Reading experiences.** The main reason the site exists. Students can browse
by company or scroll a feed of everything. Each company page shows the actual
interview pipeline (say OA, then Tech 1, then Hiring Manager), which is
computed from what people posted, and the topics that keep coming up there.
Opening a post shows the full story round by round: what platform the OA was
on, whether they passed, the coding and system design questions, the
behavioral questions and what the interviewer seemed to care about, plus prep
tips and a short reflection at the end. There is also search and sorting by
latest, most helpful, or most viewed.

**Writing one.** The share form walks you through it in five steps: company
and role, then your rounds, then what happened in each round, then tips, then
review and submit. Topics are picked from a fixed list instead of free typing,
which keeps the data clean and searchable. The form autosaves, so you can
close it and come back. Most people should be able to finish in under ten
minutes.

**Anonymity.** Posting under your real name is the default, but every post has
an anonymous option. Readers never see who wrote an anonymous post. The
placement team still can, so nobody can hide behind anonymity to post junk.

**Managing your posts.** A My Posts page shows everything you have written and
where it stands: under review, live, needs edits, or rejected. You can edit a
pending post, withdraw it, or resubmit it later. Editing a live post sends it
back through review before the new version goes up. Deleting a post is
reversible, you can restore it whenever.

**Emails.** Authors get an email at each step: when the post enters the
queue, when it goes live, when a reviewer asks for changes (the note is
included), or when it is rejected (the reason is included).

**Votes, saves, views.** Readers can mark a post Helpful (once each), save
posts to a personal list, and every post shows how many times it was opened.

## Admin side (placement team)

**Who gets in.** The /ops area only opens for accounts with a moderator or
admin role. Every admin action checks the role again on the server, not just
on the page.

**The review queue.** Nothing goes live without review. Submissions line up
first come first served, and edits go to the back of the line like everything
else. For each post a moderator can approve it, send it back with a note, or
reject it with a reason. The note and reason fields are mandatory, so there is
no silent rejecting. The whole post is readable right inside the queue.

**Hiding live posts.** If something problematic slips through, a moderator can
hide a live post instantly. A reason is required and every hide and unhide is
logged permanently with who did it and when. Hiding by the team and deleting
by the author are tracked separately so it is always clear which happened.

**Inviting students to post.** This is for the daily routine during placement
season. The team uploads a CSV of students who just finished interviews (the
columns are matched loosely, so full_name or employer style headers are fine).
Rows with a valid email are ready to send, rows with a broken email are
flagged. There is no deduplication on purpose: a student who interviewed at
three companies should get three invites, one per experience, and the team
decides who is on the list. The email itself is written once with
placeholders like {{name}} and {{company}} that get filled per student, with
a live preview. After sending, each recipient's outcome (sent or failed) is
recorded. The link in the email opens the share form with the company, role,
and round already filled in.

**Managing the team.** A Users page lets a super admin promote or demote
people: student to moderator, moderator to super admin, and back. Only super
admins see this page, moderators cannot change roles. Every role change is
logged permanently with who made it and why, and the app refuses to demote
the last super admin so the team can never lock itself out.

**The tracker sheet.** When a post is approved, its data is appended to the
team's own Google Sheet automatically: one row per technical question
(company, round, topics, DSA or not, the question, a link back) and one row
per behavioral question. It happens in the background and retries on failure,
so publishing never waits on Google. Only approved posts ever reach the
sheet. The team keeps working in the spreadsheet they already use, nothing to
export or copy.

## Roles at a glance

There are three roles. Everyone starts as a student; the placement team's
accounts are promoted to moderator, and one or two owners hold super admin.
Moderators and super admins are students too, so they can also post and read
like anyone else.

| What you can do | Student | Moderator | Super Admin |
|---|---|---|---|
| Read, search, vote, and save published experiences | Yes | Yes | Yes |
| Post experiences, edit/withdraw/delete your own posts | Yes | Yes | Yes |
| See who wrote an anonymous post | No | Yes | Yes |
| Review the queue (approve / ask for edits / reject) | No | Yes | Yes |
| Hide or unhide a live post (with a logged reason) | No | Yes | Yes |
| Send invite campaigns from a CSV | No | Yes | Yes |
| Open the Users page and change anyone's role | No | No | Yes |

## Some guarantees that hold everywhere

- A post can never end up half published, every change is one transaction.
- Moderation actions and role changes are logged and the logs are append only.
- Nothing is ever truly deleted, so mistakes are recoverable.

Built and maintained by Thrishal Madasu ('27).
