"use client";

// Client half of Invite-to-share (PRD §7 Flow F), ported from the design
// prototype's outreach-page.jsx. Send-only V1: no KPI strip, no campaigns
// table — those ship with Ops Analytics.
//
// Parsing + email validation run in-browser for instant feedback; the Send
// action re-parses and re-validates the same raw CSV server-side before
// writing (the client is never trusted). NO dedupe (2026-06-13): every row
// with a valid email sends — duplicates and re-runs included.
import { useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Chip } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import { useViewer } from "@/lib/viewer";
import { sendInvites } from "@/app/actions/invites";
import type { SendInvitesResult } from "@/lib/write/invites";
import { FROM_ADDRESS, FROM_NAME } from "@/lib/email";
import {
  DEFAULT_BODY,
  DEFAULT_SUBJECT,
  ISSUE_COPY,
  MERGE_TAGS,
  SAMPLE_CSV,
  applyMerge,
  buildRecipients,
  parseCsv,
  type ParsedRecipient,
  type RecipientStatus,
} from "@/lib/invite";

const CARD = "rounded-lg border border-border bg-surface px-[22px] pb-5 pt-[22px]";
const MONO = "font-mono";

export function InviteView({ emailLive }: { emailLive: boolean }) {
  const viewer = useViewer();

  const [rawCsv, setRawCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [filter, setFilter] = useState<"all" | RecipientStatus>("all");
  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [justSent, setJustSent] = useState<SendInvitesResult | null>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [focusTarget, setFocusTarget] = useState<"subject" | "body">("body");

  const parsed = useMemo(() => (rawCsv ? parseCsv(rawCsv) : []), [rawCsv]);
  const recipients = useMemo(() => buildRecipients(parsed), [parsed]);

  const readyRecipients = recipients.filter((r) => r.status === "ready");
  const sampleRecipient = readyRecipients[0] || recipients[0] || null;
  const counts = {
    ready: readyRecipients.length,
    error: recipients.filter((r) => r.status === "error").length,
  };

  const setCsv = (text: string, name?: string) => {
    setRawCsv(text);
    setFileName(name || "uploaded.csv");
    setFilter("all");
    setJustSent(null);
  };
  const clearCsv = () => {
    setRawCsv("");
    setFileName("");
    setFilter("all");
  };

  // Insert a merge tag at the cursor of whichever editor was last focused.
  const insertTag = (tag: string) => {
    const isSubject = focusTarget === "subject";
    const target = isSubject ? subjectRef.current : bodyRef.current;
    const value = isSubject ? subject : body;
    const set = isSubject ? setSubject : setBody;
    if (!target) {
      set(value + tag);
      return;
    }
    const start = target.selectionStart ?? value.length;
    const end = target.selectionEnd ?? value.length;
    set(value.slice(0, start) + tag + value.slice(end));
    requestAnimationFrame(() => {
      target.focus();
      const caret = start + tag.length;
      target.setSelectionRange(caret, caret);
    });
  };

  const doSend = async () => {
    setShowConfirm(false);
    setSending(true);
    const result = await sendInvites({
      csv: rawCsv,
      fileName: fileName || null,
      subject,
      body,
    });
    setSending(false);
    if (!result.ok) {
      toast(result.error);
      return;
    }
    setJustSent(result.data);
    clearCsv();
  };

  return (
    <>
      {justSent != null && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-green-border bg-[linear-gradient(180deg,rgba(46,207,133,0.08),transparent)] bg-surface px-4 py-3.5 text-[13px] leading-[1.55] text-fg-2 shadow-[0_0_0_1px_var(--color-green-border),0_0_22px_-8px_rgba(46,207,133,0.35)]">
          <span className="grid size-6 shrink-0 place-items-center rounded-full border border-green-border bg-green-soft text-green">
            <Icon.check className="size-3.5" />
          </span>
          <div>
            <strong className="font-semibold text-fg">
              {justSent.sent} invitation{justSent.sent === 1 ? "" : "s"} sent.
            </strong>{" "}
            Recipients will land on a pre-filled share form.
            {justSent.failed > 0 && (
              <>
                {" "}
                <strong className="font-semibold text-red">
                  {justSent.failed} failed to dispatch
                </strong>{" "}
                — failed recipients stay re-invitable: re-upload the same CSV to
                retry just them.
              </>
            )}
            {!emailLive &&
              " (Email dispatch is currently stubbed — no RESEND_API_KEY set; sends are logged server-side.)"}
          </div>
          <button
            type="button"
            onClick={() => setJustSent(null)}
            aria-label="Dismiss"
            className="ml-auto grid size-[22px] shrink-0 place-items-center rounded-full text-fg-3 hover:bg-surface-3 hover:text-fg"
          >
            <Icon.x className="size-3" />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {/* ── Step 1 · Upload recipients ───────────────────────────────── */}
        <div className={CARD}>
          <CardHeader
            n={1}
            title="Upload recipients"
            sub="Drop a CSV of students you'd like to nudge — one row per experience you want them to write up. Every row with a valid email gets an invite (no dedupe; duplicates and re-runs all send)."
          />
          <DropZone
            onCsv={setCsv}
            hasFile={!!rawCsv}
            fileName={fileName}
            rowCount={Math.max(0, parsed.length - 1)}
            onClear={clearCsv}
          />
          <RecipientsTable recipients={recipients} filter={filter} onFilter={setFilter} />
        </div>

        {/* ── Step 2 · Compose ─────────────────────────────────────────── */}
        <div className={CARD}>
          <CardHeader
            n={2}
            title="Compose the invite"
            sub="Merge tags fill in per recipient. The preview on the right uses the first ready recipient from your CSV."
          />

          <MergeTagsBar onInsert={insertTag} />

          <div className="grid grid-cols-2 items-stretch gap-[18px] max-[980px]:grid-cols-1">
            <div className="flex flex-col">
              <label
                htmlFor="invite-subject"
                className="mb-[7px] text-[13px] font-medium text-fg"
              >
                Subject
              </label>
              <input
                id="invite-subject"
                ref={subjectRef}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                onFocus={() => setFocusTarget("subject")}
                placeholder="Subject line"
                className="w-full rounded-md border border-border bg-bg-2 px-3 py-2.5 text-[13.5px] leading-[1.55] text-fg outline-none transition-[border-color,box-shadow] placeholder:text-fg-3 focus:border-blue-border focus:shadow-[0_0_0_3px_var(--color-blue-soft)]"
              />
              <label
                htmlFor="invite-body"
                className="mb-[7px] mt-3.5 text-[13px] font-medium text-fg"
              >
                Body
              </label>
              <textarea
                id="invite-body"
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onFocus={() => setFocusTarget("body")}
                rows={14}
                className={cn(
                  "min-h-[240px] w-full flex-1 resize-y rounded-md border border-border bg-bg-2 px-3 py-2.5 text-[12.5px] leading-[1.55] text-fg outline-none transition-[border-color,box-shadow] placeholder:text-fg-3 focus:border-blue-border focus:shadow-[0_0_0_3px_var(--color-blue-soft)]",
                  MONO,
                )}
              />
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11.5px] text-fg-3">
                <span>
                  <b className="font-medium text-fg-2">From:</b> {FROM_NAME.split(" ·")[0]}{" "}
                  &lt;{FROM_ADDRESS}&gt;
                </span>
                <span className="size-[3px] rounded-full bg-fg-4" />
                <span>
                  <b className="font-medium text-fg-2">Reply-to:</b>{" "}
                  {viewer?.email ?? "you@sst.scaler.com"}
                </span>
              </div>
            </div>

            <EmailPreview subject={subject} body={body} recipient={sampleRecipient} />
          </div>
        </div>

        {/* ── Send bar ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3.5 rounded-lg border border-blue-border bg-[linear-gradient(180deg,rgba(46,160,248,0.05),transparent)] bg-surface px-[18px] py-3.5 shadow-[0_0_0_1px_var(--color-blue-border),0_0_28px_-10px_var(--color-blue-glow)]">
          <div className="flex items-baseline gap-2.5 text-[13.5px] text-fg-2">
            <span className="text-[22px] font-bold tabular-nums tracking-[-0.02em] text-fg">
              {counts.ready}
            </span>
            <span>
              ready to send
              {counts.error > 0 && (
                <span className="text-[12.5px] text-red"> · {counts.error} errors</span>
              )}
            </span>
          </div>
          <div className="ml-auto flex gap-2.5">
            <Button onClick={clearCsv} disabled={!rawCsv} className={cn(!rawCsv && "opacity-40")}>
              Reset
            </Button>
            <Button
              variant="primary"
              disabled={counts.ready === 0 || sending}
              onClick={() => setShowConfirm(true)}
              className={cn((counts.ready === 0 || sending) && "cursor-not-allowed opacity-40")}
            >
              <Icon.send />
              {sending
                ? "Sending…"
                : `Send ${counts.ready || ""} invite${counts.ready === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Confirm modal ──────────────────────────────────────────────── */}
      <Modal
        open={showConfirm}
        onOpenChange={(o) => !o && setShowConfirm(false)}
        title={`Send ${counts.ready} invitation${counts.ready === 1 ? "" : "s"}?`}
        description={
          <>
            Each recipient gets a personalised email with merge tags filled in.
            Sends happen immediately from{" "}
            <code className={cn("text-[12px] text-fg", MONO)}>{FROM_ADDRESS}</code>.
          </>
        }
      >
        <div className="rounded-md border border-border bg-bg-2 px-3.5 py-3 text-[13.5px] font-semibold tracking-[-0.01em] text-fg">
          {applyMerge(subject, sampleRecipient) || "(no subject)"}
        </div>
        <div className="mt-3.5 flex items-center justify-end gap-2">
          <Button onClick={() => setShowConfirm(false)}>Cancel</Button>
          <Button variant="primary" onClick={doSend}>
            <Icon.send /> Send {counts.ready} now
          </Button>
        </div>
      </Modal>
    </>
  );
}

// ── Card header with the step number ─────────────────────────────────────────
function CardHeader({ n, title, sub }: { n: number; title: string; sub: string }) {
  return (
    <div className="mb-[18px] flex items-start gap-3.5">
      <span className="mt-0.5 grid size-[26px] shrink-0 place-items-center rounded-full border border-blue-border bg-blue-soft text-[12.5px] font-semibold tabular-nums text-blue shadow-[0_0_12px_-4px_var(--color-blue-glow)]">
        {n}
      </span>
      <div>
        <h3 className="m-0 text-base font-semibold tracking-[-0.01em] text-fg">{title}</h3>
        <p className="m-0 mt-1 max-w-[64ch] text-[13px] leading-[1.55] text-fg-3">{sub}</p>
      </div>
    </div>
  );
}

// ── Drop zone / file bar ─────────────────────────────────────────────────────
function downloadTemplateCsv() {
  const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "inherit-invite-template.csv";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

function DropZone({
  onCsv,
  hasFile,
  fileName,
  rowCount,
  onClear,
}: {
  onCsv: (text: string, name?: string) => void;
  hasFile: boolean;
  fileName: string;
  rowCount: number;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const readFile = (file: File | undefined | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onCsv(String(reader.result), file.name);
    reader.readAsText(file);
    // Reset the input so re-selecting the SAME file fires onChange again —
    // Ops re-uploads the same CSV to retry failed rows after a send.
    if (inputRef.current) inputRef.current.value = "";
  };

  if (hasFile) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-border bg-bg-2 px-3.5 py-3">
        <span className="grid size-[34px] shrink-0 place-items-center rounded-[8px] border border-blue-border bg-blue-soft text-blue">
          <Icon.doc className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-semibold text-fg">
            {fileName || "uploaded.csv"}
          </div>
          <div className="mt-0.5 text-xs text-fg-3">
            {rowCount} {rowCount === 1 ? "row" : "rows"} parsed · ready to review below
          </div>
        </div>
        <FileBarAction onClick={() => inputRef.current?.click()}>
          <Icon.refresh className="size-[13px]" /> Replace
        </FileBarAction>
        <FileBarAction danger onClick={onClear}>
          <Icon.x className="size-[13px]" /> Clear
        </FileBarAction>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => readFile(e.target.files?.[0])}
        />
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        readFile(e.dataTransfer?.files?.[0]);
      }}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      className={cn(
        "cursor-pointer rounded-lg border-[1.5px] border-dashed px-7 pb-7 pt-[38px] text-center transition-[border-color,background,box-shadow]",
        dragOver
          ? "border-blue-border bg-[linear-gradient(180deg,rgba(46,160,248,0.08),transparent)] bg-surface shadow-[0_0_0_1px_var(--color-blue-border),0_0_28px_-8px_var(--color-blue-glow)]"
          : "border-border-strong bg-[linear-gradient(180deg,rgba(46,160,248,0.02),transparent)] bg-bg-2 hover:border-border-hover hover:bg-surface-3",
      )}
    >
      <div className="mx-auto mb-3.5 grid size-[52px] place-items-center rounded-[14px] border border-blue-border bg-blue-soft text-blue shadow-[0_0_18px_-6px_var(--color-blue-glow)]">
        <Icon.upload className="size-[22px]" />
      </div>
      <div className="mb-1.5 text-[15px] font-semibold text-fg">
        Drop a CSV here, or click to browse
      </div>
      <div className="text-[12.5px] leading-[1.6] text-fg-3">
        Expected columns: <CsvCode>name</CsvCode>, <CsvCode>email</CsvCode>,{" "}
        <CsvCode>company</CsvCode>, <CsvCode>role</CsvCode>, <CsvCode>round</CsvCode>
      </div>
      <div
        className="mt-[18px] flex flex-wrap justify-center gap-2.5"
        onClick={(e) => e.stopPropagation()}
      >
        <Button onClick={downloadTemplateCsv}>
          <Icon.download className="size-[13px]" /> Download template
        </Button>
        <Button variant="text" onClick={() => onCsv(SAMPLE_CSV, "demo-recipients.csv")}>
          Or load a demo CSV →
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(e) => readFile(e.target.files?.[0])}
      />
    </div>
  );
}

function FileBarAction({
  danger,
  onClick,
  children,
}: {
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-[5px] rounded-full border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-fg-2",
        danger
          ? "hover:border-red-border hover:bg-red-soft hover:text-red"
          : "hover:border-border-hover hover:bg-surface-3 hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function CsvCode({ children }: { children: React.ReactNode }) {
  return (
    <code
      className={cn(
        "mx-px rounded-[5px] border border-border bg-surface px-1.5 py-px text-[11.5px] text-fg-2",
        MONO,
      )}
    >
      {children}
    </code>
  );
}

// ── Recipients table with bucket chips ───────────────────────────────────────
function StatusPill({ status }: { status: RecipientStatus }) {
  if (status === "ready")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-green-border bg-green-soft px-2 py-[3px] text-[11px] font-semibold text-green">
        <Icon.check className="size-2.5" /> Ready
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-red-border bg-red-soft px-2 py-[3px] text-[11px] font-semibold text-red">
      <Icon.warn className="size-2.5" /> Error
    </span>
  );
}

const ROW_GRID =
  "grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)] items-center gap-3.5 px-4 py-2.5";

function RecipientsTable({
  recipients,
  filter,
  onFilter,
}: {
  recipients: ParsedRecipient[];
  filter: "all" | RecipientStatus;
  onFilter: (f: "all" | RecipientStatus) => void;
}) {
  const counts = useMemo(
    () => ({
      all: recipients.length,
      ready: recipients.filter((r) => r.status === "ready").length,
      error: recipients.filter((r) => r.status === "error").length,
    }),
    [recipients],
  );
  const visible = useMemo(
    () => (filter === "all" ? recipients : recipients.filter((r) => r.status === filter)),
    [recipients, filter],
  );

  if (!recipients.length) return null;

  return (
    <div className="mt-[18px]">
      <div className="mb-3 flex flex-wrap gap-2">
        {(
          [
            ["all", "All", counts.all],
            ["ready", "Ready to send", counts.ready],
            ["error", "Errors", counts.error],
          ] as const
        ).map(([k, label, n]) => (
          <Chip key={k} label={label} count={n} active={filter === k} onClick={() => onFilter(k)} />
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-bg-2">
        <div
          className={cn(
            ROW_GRID,
            "border-b border-border bg-white/[0.015] text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-3",
          )}
        >
          <span>Recipient</span>
          <span>Company</span>
          <span>Role / Round</span>
          <span className="text-right">Status</span>
        </div>
        <div>
          {visible.slice(0, 50).map((r) => (
            <div
              key={r.id}
              className={cn(
                ROW_GRID,
                "text-[13px] [&+&]:border-t [&+&]:border-border",
                r.status === "error" &&
                  "bg-[linear-gradient(90deg,var(--color-red-soft),transparent_60%)]",
              )}
            >
              <div>
                <div className="font-semibold text-fg">{r.name || "—"}</div>
                <div className={cn("mt-0.5 truncate text-xs text-fg-3", MONO)}>
                  {r.email || <em>—</em>}
                </div>
              </div>
              <div className="text-fg-2">{r.company || "—"}</div>
              <div>
                <div>{r.role || "—"}</div>
                {r.round && <div className="mt-0.5 text-[11.5px] text-fg-3">{r.round}</div>}
              </div>
              <div className="text-right">
                <StatusPill status={r.status} />
                {r.issues.length > 0 && (
                  <div className="mt-1 text-[11px] italic text-fg-3">
                    {r.issues.map((i) => ISSUE_COPY[i]).join(" · ")}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        {visible.length > 50 && (
          <div className="border-t border-border bg-white/[0.02] px-4 py-2.5 text-center text-xs text-fg-3">
            Showing 50 of {visible.length} rows. Send will process all.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Merge tags bar ───────────────────────────────────────────────────────────
function MergeTagsBar({ onInsert }: { onInsert: (tag: string) => void }) {
  return (
    <div className="mb-3.5 flex flex-wrap items-center gap-2 rounded-md border border-border bg-bg-2 px-3 py-2.5">
      <span className="inline-flex items-center gap-1.5 pr-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-3">
        <Icon.tag className="size-[11px]" /> Merge tags
      </span>
      {MERGE_TAGS.map((t) => (
        <button
          key={t.tag}
          type="button"
          onClick={() => onInsert(t.tag)}
          title={`Insert ${t.tag}`}
          className="group inline-flex items-center gap-[7px] rounded-full border border-border bg-surface px-2.5 py-[5px] text-xs text-fg-2 hover:border-blue-border hover:bg-blue-soft hover:text-blue"
        >
          <code className={cn("text-[11px] text-blue", MONO)}>{t.tag}</code>
          <span className="text-[11.5px] text-fg-3 group-hover:text-fg-2">{t.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Live email preview ───────────────────────────────────────────────────────
function EmailPreview({
  subject,
  body,
  recipient,
}: {
  subject: string;
  body: string;
  recipient: ParsedRecipient | null;
}) {
  const initials = (recipient?.name || "??")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex min-w-0 flex-col">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-blue">
          Live preview
        </span>
        {recipient ? (
          <span className="inline-flex items-center gap-[7px] text-[11.5px] text-fg-3">
            <span className="grid size-[18px] place-items-center rounded-full border border-border-strong bg-surface-3 text-[9.5px] font-semibold text-fg-2">
              {initials}
            </span>
            To {recipient.email}
          </span>
        ) : (
          <span className="text-[11.5px] italic text-fg-3">No ready recipients yet</span>
        )}
      </div>
      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border bg-surface">
        <div className="flex items-center gap-2.5 border-b border-border bg-bg-2 px-4 py-3">
          <span className="grid size-7 place-items-center rounded-[8px] bg-gradient-to-b from-blue to-blue-deep text-[13px] font-bold text-white shadow-[0_0_14px_-4px_var(--color-blue-glow)]">
            I
          </span>
          <div>
            <div className="text-[12.5px] font-semibold text-fg">{FROM_NAME}</div>
            <div className={cn("mt-px text-[11px] text-fg-3", MONO)}>{FROM_ADDRESS}</div>
          </div>
          <span className="ml-auto text-[11px] text-fg-3">now</span>
        </div>
        <div className="px-4 pb-1 pt-3.5 text-sm font-semibold tracking-[-0.01em] text-fg">
          {applyMerge(subject, recipient) || "(no subject)"}
        </div>
        <div className="flex-1 whitespace-pre-wrap break-words px-4 pb-[18px] pt-2 text-[13px] leading-[1.65] text-fg-2">
          {applyMerge(body, recipient)
            .split("\n")
            .map((line, i) =>
              line.match(/→/) ? (
                <div
                  key={i}
                  className="my-2 inline-block rounded-md border border-blue-border bg-[linear-gradient(180deg,var(--color-blue-soft),transparent)] bg-surface-3 px-3.5 py-2 text-[12.5px] font-semibold text-blue shadow-[0_0_14px_-6px_var(--color-blue-glow)]"
                >
                  {line}
                </div>
              ) : (
                <div key={i} className={cn("min-h-[1em]", line.trim() === "" && "h-2")}>
                  {line || " "}
                </div>
              ),
            )}
        </div>
      </div>
    </div>
  );
}
