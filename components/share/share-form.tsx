"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useViewer } from "@/lib/viewer";
import { batchLabelFromEmail, initialsOf, shortName } from "@/lib/user-display";
import { TopNav } from "@/components/top-nav";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { PipeChip } from "@/components/ui/pill";
import { RoundEditor } from "@/components/share/round-editor";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import {
  DRAFT_KEY,
  clearDraft,
  editDraftKey,
  loadDraft,
  relativeTime,
  saveDraft,
  type ShareDraftForm,
} from "@/lib/draft";
import {
  OUTCOMES,
  ROLE_SUGGESTIONS,
  STEPS,
  YEARS,
  completionPct,
  emptyForm,
  emptyRound,
  wordCount,
  type ShareFormOptions,
} from "@/lib/share-form";
import { submitExperience } from "@/app/actions/experiences";
import { firstIssue, sanitizeShareForm, sharePayloadSchema } from "@/lib/validations/experience";
import type { ReviewStatus } from "@/lib/types";

const INPUT =
  "w-full h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg outline-none transition-[border-color,box-shadow] placeholder:text-fg-3 hover:border-border-hover focus:border-blue-border focus:shadow-[0_0_0_3px_var(--color-blue-soft)]";
const FIELD_LABEL = "flex items-baseline justify-between text-[13px] font-medium text-fg";

export function ShareForm({
  editId,
  prefill,
  editStatus,
  options,
}: {
  editId?: string;
  prefill?: ShareDraftForm; // DB state of the post being edited (server-loaded)
  editStatus?: ReviewStatus;
  options: ShareFormOptions; // canonical companies / round types / topics (DB)
}) {
  const router = useRouter();
  const draftKey = editId ? editDraftKey(editId) : DRAFT_KEY;

  // Initial form: in-progress edit draft → DB prefill → new draft → empty.
  const [form, setForm] = useState<ShareDraftForm>(() => {
    const existing = loadDraft(draftKey);
    if (existing) return existing.form;
    if (prefill) return prefill;
    return emptyForm();
  });
  // Resume on the step the user left off (saved with the draft), clamped to a
  // valid range in case STEPS changed or the stored value is stale.
  const [step, setStep] = useState(() => {
    const saved = loadDraft(draftKey)?.step ?? 0;
    return Math.min(Math.max(saved, 0), STEPS.length - 1);
  });
  const [submitting, setSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Debounced autosave - only after the user actually touches the form. Persist
  // the current step too, so a mid-fill reload resumes in place (re-runs on
  // step changes, not just field edits).
  const dirtyRef = useRef(false);
  const startedAtRef = useRef(Date.now());
  useEffect(() => {
    if (!dirtyRef.current) return;
    const t = setTimeout(() => {
      const now = Date.now();
      saveDraft({ form, step, startedAt: startedAtRef.current, savedAt: now }, draftKey);
      setSavedAt(now);
    }, 500);
    return () => clearTimeout(t);
  }, [form, step, draftKey]);

  const update = (patch: Partial<ShareDraftForm>) => {
    dirtyRef.current = true;
    setForm((f) => ({ ...f, ...patch }));
  };

  const pct = useMemo(
    () => (step >= 3 ? Math.max(completionPct(form), 92) : completionPct(form)),
    [form, step],
  );

  // Validate locally first (instant feedback), then hand the raw form to the
  // Server Action - it re-sanitizes and re-validates; never trust the client.
  const submit = async () => {
    const check = sharePayloadSchema.safeParse(sanitizeShareForm(form));
    if (!check.success) {
      toast(firstIssue(check.error));
      return;
    }
    setSubmitting(true);
    const result = await submitExperience(form, editId);
    if (!result.ok) {
      setSubmitting(false);
      toast(result.error);
      return;
    }
    clearDraft(draftKey);
    toast(editId ? "Resubmitted - back in the review queue" : "Submitted for review");
    router.push("/under-review");
  };

  return (
    <>
      <TopNav showSearch={false} />
      <main className="mx-auto max-w-[760px] px-7 pb-24 pt-7">
        {/* Sticky progress */}
        <div className="sticky top-[65px] z-20 -mx-2 mb-7 bg-[linear-gradient(180deg,var(--color-bg)_70%,transparent)] px-4 pb-4 pt-[18px]">
          <div className="relative mb-3.5 h-[3px] overflow-hidden rounded-sm bg-surface-3">
            <span
              className="absolute inset-y-0 left-0 rounded-sm bg-gradient-to-r from-blue to-[#56b6fb] shadow-[0_0_10px_var(--color-blue-glow)] transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between gap-1.5">
            {STEPS.map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => setStep(i)}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2 rounded-[8px] px-1.5 py-1 text-left text-[12.5px] transition-colors",
                  i === step ? "text-fg" : "text-fg-3 hover:text-fg-2",
                )}
              >
                <span
                  className={cn(
                    "grid size-[22px] shrink-0 place-items-center rounded-full border text-[11px] font-semibold tabular-nums transition-all",
                    i < step
                      ? "border-green-border bg-green-soft text-green"
                      : i === step
                        ? "border-blue bg-blue text-white shadow-[0_0_0_3px_var(--color-blue-soft)]"
                        : "border-border-strong bg-surface-3 text-fg-3",
                  )}
                >
                  {i < step ? <Icon.check className="size-3" /> : i + 1}
                </span>
                <span className="truncate font-medium max-md:hidden">{label}</span>
              </button>
            ))}
            <span className="ml-2 shrink-0 text-[11.5px] tabular-nums text-fg-3">
              {pct}%{savedAt && ` · saved ${relativeTime(savedAt)}`}
            </span>
          </div>
        </div>

        {/* Edit banner */}
        {editId && (
          <div className="mb-6 flex gap-2.5 rounded-md border border-amber-border bg-amber-soft px-[13px] py-[11px] text-[13px] leading-[1.55] text-fg">
            <Icon.info className="mt-0.5 size-4 shrink-0 text-amber" />
            <div>
              <b className="font-semibold">You&apos;re editing an existing post.</b>{" "}
              Resubmitting sends it to the back of the review queue
              {editStatus === "Approved" &&
                " and pulls the live version offline until it's re-approved"}
              .
            </div>
          </div>
        )}

        {step === 0 && <StepBasics form={form} update={update} options={options} />}
        {step === 1 && <StepRounds form={form} update={update} options={options} />}
        {step === 2 && <StepTips form={form} update={update} />}
        {step === 3 && <StepReflections form={form} update={update} />}
        {step === 4 && <StepIdentity form={form} update={update} />}

        {/* Footer nav */}
        <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
          <Button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className={cn(step === 0 && "invisible")}
          >
            ← Back
          </Button>
          <span className="text-xs text-fg-3">
            Step {step + 1} of {STEPS.length}
          </span>
          {step < STEPS.length - 1 ? (
            <Button variant="primary" onClick={() => setStep((s) => s + 1)}>
              Continue <Icon.arrow />
            </Button>
          ) : (
            <Button variant="primary" onClick={submit} disabled={submitting}>
              <Icon.check />{" "}
              {submitting
                ? "Submitting…"
                : editId
                  ? "Resubmit for review"
                  : "Submit for review"}
            </Button>
          )}
        </div>
      </main>
    </>
  );
}

// ── Step 1: Basics ───────────────────────────────────────────────────────────
function StepBasics({
  form,
  update,
  options,
}: {
  form: ShareDraftForm;
  update: (p: Partial<ShareDraftForm>) => void;
  options: ShareFormOptions;
}) {
  const [tipsOpen, setTipsOpen] = useState(false);
  return (
    <>
      <header className="mb-[22px]">
        <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-blue">
          Share your experience
        </div>
        <h1 className="mb-1 text-[26px] font-bold tracking-[-0.02em]">
          Start with the basics
        </h1>
        <p className="text-sm leading-[1.55] text-fg-2">
          Company, role, and how it went. Everything is reviewed by Placement Ops
          before going live.
        </p>
      </header>

      {/* Posting tips disclosure */}
      <button
        type="button"
        onClick={() => setTipsOpen((v) => !v)}
        className={cn(
          "mb-5 flex w-full items-center gap-2 rounded-md border border-border bg-surface px-3.5 py-2.5 text-left text-[12.5px] font-medium text-fg-2 hover:text-fg",
          tipsOpen && "rounded-b-none",
        )}
      >
        <Icon.bolt className="size-3.5 text-amber" />
        Tips for a post people thank you for
        <Icon.chev
          className={cn("ml-auto size-3 text-fg-3 transition-transform", tipsOpen && "rotate-90")}
        />
      </button>
      {tipsOpen && (
        <ul className="-mt-5 mb-5 list-disc rounded-b-md border border-t-0 border-border bg-surface py-3 pl-9 pr-4 text-[13px] leading-[1.7] text-fg-2">
          <li>Specifics beat summaries - name the topics, not just &ldquo;DSA questions&rdquo;.</li>
          <li>Rejections are the most valuable posts. Share what you&apos;d do differently.</li>
          <li>Don&apos;t name interviewers or share anything under NDA.</li>
        </ul>
      )}

      <Combo
        label="Company"
        value={form.company}
        onChange={(company) => update({ company })}
        placeholder="Start typing - e.g. Amazon"
        options={options.companies.map((c) => ({ main: c.name, sub: c.industry }))}
        hint="Pick from the list where you can. A new company is reviewed by Ops before it's added."
      />
      <Combo
        label="Role"
        value={form.role}
        onChange={(role) => update({ role })}
        placeholder="e.g. SDE Intern"
        options={ROLE_SUGGESTIONS.map((r) => ({ main: r.name, sub: r.hint }))}
      />

      <div className="mb-4 grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
        <label className="flex flex-col gap-[7px]">
          <span className={FIELD_LABEL}>Placement cycle</span>
          <select
            value={form.year}
            onChange={(e) => update({ year: Number(e.target.value) })}
            className={cn(INPUT, "cursor-pointer appearance-none")}
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-[7px]">
        <span className={FIELD_LABEL}>Overall outcome</span>
        <div className="flex flex-wrap gap-[7px]">
          {OUTCOMES.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => update({ outcome: o })}
              className={cn(
                "inline-flex h-[34px] items-center gap-1.5 rounded-full border px-[13px] text-[13px] font-medium transition-all",
                form.outcome === o
                  ? "border-blue-border bg-blue-soft text-blue shadow-[0_0_0_1px_var(--color-blue-border),0_0_14px_-4px_var(--color-blue-glow)]"
                  : "border-border bg-surface text-fg-2 hover:border-border-hover hover:text-fg",
              )}
            >
              <span className="size-1.5 rounded-full bg-current" />
              {o}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Step 2: Rounds (the pipeline) ────────────────────────────────────────────
function StepRounds({
  form,
  update,
  options,
}: {
  form: ShareDraftForm;
  update: (p: Partial<ShareDraftForm>) => void;
  options: ShareFormOptions;
}) {
  const setRound = (i: number, next: (typeof form.rounds)[number]) =>
    update({ rounds: form.rounds.map((r, j) => (j === i ? next : r)) });
  const move = (i: number, dir: -1 | 1) => {
    const next = form.rounds.slice();
    const [r] = next.splice(i, 1);
    next.splice(i + dir, 0, r);
    update({ rounds: next });
  };

  return (
    <>
      <header className="mb-[22px]">
        <h1 className="mb-1 text-[26px] font-bold tracking-[-0.02em]">Your rounds</h1>
        <p className="text-sm leading-[1.55] text-fg-2">
          Add each stage you went through. Quick mode takes seconds; add details
          with typed blocks (coding, system design, behavioral, open) where you
          have more to share - a single round can mix types.
        </p>
      </header>

      {/* Live pipeline preview */}
      <div className="mb-5 flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-bg-2 px-3.5 py-3">
        <span className="mr-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-3">
          Pipeline
        </span>
        {form.rounds.map((r, i) => (
          <Fragment key={i}>
            <PipeChip status={r.status} size="default" dashed={!r.detailed}>
              {r.round || "-"}
            </PipeChip>
            {i < form.rounds.length - 1 && (
              <Icon.arrow className="size-3.5 shrink-0 text-fg-4" />
            )}
          </Fragment>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {form.rounds.map((r, i) => (
          <RoundEditor
            key={i}
            round={r}
            idx={i}
            total={form.rounds.length}
            roundTypes={options.roundTypes}
            topics={options.topics}
            onChange={(next) => setRound(i, next)}
            onMove={(dir) => move(i, dir)}
            onDelete={
              form.rounds.length > 1
                ? () => update({ rounds: form.rounds.filter((_, j) => j !== i) })
                : undefined
            }
          />
        ))}
      </div>

      <Button
        onClick={() =>
          update({ rounds: [...form.rounds, emptyRound(options.roundTypes[1] ?? options.roundTypes[0])] })
        }
        className="mt-3"
      >
        <Icon.plus /> Add round
      </Button>
    </>
  );
}

// ── Step 3: Prep tips ────────────────────────────────────────────────────────
function StepTips({
  form,
  update,
}: {
  form: ShareDraftForm;
  update: (p: Partial<ShareDraftForm>) => void;
}) {
  const CATS = [
    { id: "resource", label: "Resource" },
    { id: "strategy", label: "Strategy" },
    { id: "mindset", label: "Mindset" },
  ] as const;

  return (
    <>
      <header className="mb-[22px]">
        <h1 className="mb-1 text-[26px] font-bold tracking-[-0.02em]">Prep tips</h1>
        <p className="text-sm leading-[1.55] text-fg-2">
          Short, concrete pointers - the resources, strategies, and mindset that
          actually helped.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {form.tips.map((tip, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <div className="inline-flex overflow-hidden rounded-md border border-border bg-bg-2">
                {CATS.map((c, j) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      update({
                        tips: form.tips.map((t, k) => (k === i ? { ...t, category: c.id } : t)),
                      })
                    }
                    className={cn(
                      "h-8 px-3 text-xs font-medium transition-[background,color]",
                      j < CATS.length - 1 && "border-r border-border",
                      tip.category === c.id
                        ? "bg-blue-soft text-blue"
                        : "text-fg-3 hover:bg-surface hover:text-fg",
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              {form.tips.length > 1 && (
                <button
                  type="button"
                  onClick={() => update({ tips: form.tips.filter((_, k) => k !== i) })}
                  className="grid size-7 place-items-center rounded-[7px] border border-transparent text-fg-3 hover:border-red-border hover:bg-red-soft hover:text-red"
                  aria-label="Remove tip"
                >
                  <Icon.x className="size-3.5" />
                </button>
              )}
            </div>
            <textarea
              value={tip.text}
              maxLength={240}
              onChange={(e) =>
                update({
                  tips: form.tips.map((t, k) => (k === i ? { ...t, text: e.target.value } : t)),
                })
              }
              placeholder="1–3 sentences, e.g. The NeetCode 150 covers ~90% of Amazon OA patterns…"
              className={cn(INPUT, "min-h-[64px] resize-y py-2.5 leading-[1.55]")}
            />
            <div
              className={cn(
                "mt-1 flex justify-end text-[11.5px] tabular-nums",
                tip.text.length > 200 ? "text-amber" : "text-fg-3",
              )}
            >
              {tip.text.length}/240
            </div>
          </div>
        ))}
      </div>

      <Button
        onClick={() => update({ tips: [...form.tips, { category: "strategy", text: "" }] })}
        className="mt-3"
      >
        <Icon.plus /> Add tip
      </Button>
    </>
  );
}

// ── Step 4: Reflections ──────────────────────────────────────────────────────
function StepReflections({
  form,
  update,
}: {
  form: ShareDraftForm;
  update: (p: Partial<ShareDraftForm>) => void;
}) {
  const words = wordCount(form.reflection);
  return (
    <>
      <header className="mb-[22px]">
        <h1 className="mb-1 text-[26px] font-bold tracking-[-0.02em]">
          Reflections <span className="text-base font-normal text-fg-3">(optional)</span>
        </h1>
        <p className="text-sm leading-[1.55] text-fg-2">
          Someone reads this the night before their interview. Focus on what
          surprised you and what you&apos;d do differently.
        </p>
      </header>

      <textarea
        value={form.reflection}
        onChange={(e) => update({ reflection: e.target.value })}
        placeholder="The OA itself isn't unreasonable - what makes it stressful is…"
        className={cn(INPUT, "min-h-[220px] resize-y py-3 leading-[1.65]")}
      />
      <div
        className={cn(
          "mt-1.5 flex justify-end text-[11.5px] tabular-nums",
          words > 500 ? "text-red" : words > 420 ? "text-amber" : "text-fg-3",
        )}
      >
        {words}/500 words
      </div>
    </>
  );
}

// ── Step 5: Identity & submit ────────────────────────────────────────────────
function StepIdentity({
  form,
  update,
}: {
  form: ShareDraftForm;
  update: (p: Partial<ShareDraftForm>) => void;
}) {
  const detailed = form.rounds.filter((r) => r.detailed).length;
  const taggedBlocks = form.rounds.flatMap((r) => r.blocks).filter((b) => b.topics.length).length;
  const tips = form.tips.filter((t) => t.text.trim()).length;

  const viewer = useViewer();
  const email = viewer?.email ?? "";
  const name = shortName(viewer?.name, email);
  const batch = batchLabelFromEmail(email);
  const byline = batch ? `${name} · ${batch}` : name;
  const anonByline = batch ? `SST ${batch} student` : "SST student";

  return (
    <>
      <header className="mb-[22px]">
        <h1 className="mb-1 text-[26px] font-bold tracking-[-0.02em]">Identity &amp; submit</h1>
        <p className="text-sm leading-[1.55] text-fg-2">
          Real names build trust; anonymity protects honesty. Either way, Ops can
          see your identity for review - readers see what you pick here.
        </p>
      </header>

      {/* Side-by-side identity cards */}
      <div className="mb-6 grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
        <IdentityCard
          active={!form.anonymous}
          onClick={() => update({ anonymous: false })}
          circle={initialsOf(viewer?.name, email)}
          title={`Post as ${byline}`}
          sub="Your name and batch appear on the post. Builds peer reputation."
        />
        <IdentityCard
          active={form.anonymous}
          onClick={() => update({ anonymous: true })}
          circle="?"
          title="Post anonymously"
          sub={`Shows as "${anonByline} · identity verified by Placement Ops".`}
        />
      </div>

      {/* Summary */}
      <div className="rounded-lg border border-border bg-surface px-5 py-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-fg-3">
          Submission summary
        </h3>
        <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[13.5px]">
          <SummaryK k="Company" v={form.company || "-"} />
          <SummaryK k="Role · Cycle" v={`${form.role || "-"} · ${form.year}`} />
          <SummaryK k="Overall outcome" v={form.outcome || "-"} />
          <span className="text-fg-3">Pipeline</span>
          <span className="flex flex-wrap items-center gap-1">
            {form.rounds.map((r, i) => (
              <Fragment key={i}>
                <span className="font-medium text-fg">{r.round}</span>
                {i < form.rounds.length - 1 && <span className="text-fg-4">→</span>}
              </Fragment>
            ))}
          </span>
          <SummaryK k="Detailed rounds" v={`${detailed}/${form.rounds.length}`} />
          <SummaryK k="Tagged blocks" v={String(taggedBlocks)} />
          <SummaryK k="Prep tips" v={String(tips)} />
          <SummaryK k="Reflections" v={form.reflection.trim() ? "Included" : "Skipped"} />
          <SummaryK k="Byline" v={form.anonymous ? "Anonymous" : byline} />
        </div>
      </div>

      <p className="mt-4 text-[12.5px] leading-[1.6] text-fg-3">
        Submitting sends your post to the back of the Placement Ops review queue
        (first-in, first-out). You&apos;ll get an email at every status change.
      </p>
    </>
  );
}

function IdentityCard({
  active,
  onClick,
  circle,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  circle: string;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border p-4 text-left transition-all",
        active
          ? "border-blue-border bg-blue-soft shadow-[0_0_0_1px_var(--color-blue-border),0_0_20px_-6px_var(--color-blue-glow)]"
          : "border-border bg-surface hover:border-border-hover",
      )}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <span
          className={cn(
            "grid size-9 place-items-center rounded-full text-[13px] font-semibold",
            circle === "?"
              ? "border border-dashed border-border-strong bg-surface-3 text-fg-3"
              : "bg-gradient-to-br from-blue to-blue-deep text-white",
          )}
        >
          {circle}
        </span>
        <span
          className={cn(
            "grid size-[18px] place-items-center rounded-full border",
            active ? "border-blue bg-blue text-white" : "border-border-strong",
          )}
        >
          {active && <Icon.check className="size-2.5" />}
        </span>
      </div>
      <div className="mb-1 text-sm font-semibold tracking-[-0.005em] text-fg">{title}</div>
      <div className="text-[12.5px] leading-[1.5] text-fg-3">{sub}</div>
    </button>
  );
}

function SummaryK({ k, v }: { k: string; v: string }) {
  return (
    <>
      <span className="text-fg-3">{k}</span>
      <span className="font-medium text-fg">{v}</span>
    </>
  );
}

// ── Combo (autocomplete input) ───────────────────────────────────────────────
function Combo({
  label,
  value,
  onChange,
  placeholder,
  options,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { main: string; sub: string }[];
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    const t = value.trim().toLowerCase();
    const list = t ? options.filter((o) => o.main.toLowerCase().includes(t)) : options;
    return list.slice(0, 6);
  }, [value, options]);
  const isNew = useMemo(() => {
    const t = value.trim().toLowerCase();
    return t.length > 0 && !options.some((o) => o.main.toLowerCase() === t);
  }, [value, options]);

  return (
    <label className="relative mb-4 flex flex-col gap-[7px]">
      <span className={FIELD_LABEL}>{label}</span>
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 140)}
        placeholder={placeholder}
        className={INPUT}
      />
      {open && matches.length > 0 && (
        <div className="absolute inset-x-0 top-[calc(100%+6px)] z-10 overflow-hidden rounded-md border border-border-strong bg-surface shadow-[0_14px_40px_-8px_rgba(0,0,0,0.6)]">
          {matches.map((o) => (
            <button
              key={o.main}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(o.main);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-[9px] text-left text-[13px] text-fg hover:bg-bg-2"
            >
              <span className="grid size-[26px] place-items-center rounded-[7px] border border-border-strong bg-surface-3 text-[13px] font-semibold">
                {o.main[0]}
              </span>
              {o.main}
              <span className="ml-auto text-[11.5px] text-fg-3">{o.sub}</span>
            </button>
          ))}
        </div>
      )}
      {hint && (
        <span className="text-[11.5px] leading-[1.5] text-fg-3">
          {isNew ? (
            <span className="text-amber">
              “{value.trim()}” isn&apos;t in our list yet - Ops will confirm or match it during review.
            </span>
          ) : (
            hint
          )}
        </span>
      )}
    </label>
  );
}
