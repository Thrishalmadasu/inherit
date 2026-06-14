"use client";

// Step 2's round card: pipeline label + status (quick mode), and an expandable
// detail panel COMPOSED from typed content blocks (coding / system design /
// behavioral / open). Round type is a label only - any round can hold any mix
// of block types (PRD locked decision).
import { Icon } from "@/components/icons";
import { TagInput } from "@/components/share/tag-input";
import { cn } from "@/lib/cn";
import type { DraftBlock, DraftBlockType, DraftRound } from "@/lib/draft";
import {
  BLOCK_TAG_SUGGESTIONS,
  BLOCK_TYPE_META,
  ROUND_STATUSES,
  emptyBlock,
} from "@/lib/share-form";

const INPUT =
  "w-full rounded-md border border-border bg-surface px-3 text-sm text-fg outline-none transition-[border-color,box-shadow] placeholder:text-fg-3 hover:border-border-hover focus:border-blue-border focus:shadow-[0_0_0_3px_var(--color-blue-soft)]";
const LABEL = "text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-3";

const STATUS_ACTIVE: Record<string, string> = {
  Passed: "text-green bg-green-soft",
  Failed: "text-red bg-red-soft",
  Awaiting: "text-amber bg-amber-soft",
};

export function RoundEditor({
  round,
  idx,
  total,
  roundTypes,
  topics,
  onChange,
  onMove,
  onDelete,
}: {
  round: DraftRound;
  idx: number;
  total: number;
  roundTypes: string[]; // canonical round vocabulary (DB-sourced, concern #10)
  topics: { label: string; category: string }[]; // canonical topic taxonomy (DB)
  onChange: (next: DraftRound) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete?: () => void;
}) {
  const set = (patch: Partial<DraftRound>) => onChange({ ...round, ...patch });
  // A non-canonical label (e.g. from an invite ?round= link, or legacy data)
  // still needs to render as the selected option - but students can only ever
  // pick canonical entries; Ops introduces new round types in /ops/taxonomy.
  const isKnown = roundTypes.includes(round.round);

  const setBlock = (i: number, next: DraftBlock) =>
    set({ blocks: round.blocks.map((b, j) => (j === i ? next : b)) });
  const removeBlock = (i: number) =>
    set({ blocks: round.blocks.filter((_, j) => j !== i) });
  const addBlock = (type: DraftBlockType) =>
    set({ blocks: [...round.blocks, emptyBlock(type)], detailed: true });

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border bg-surface transition-[border-color,box-shadow]",
        round.detailed
          ? "border-border-hover shadow-[0_0_0_1px_rgba(255,255,255,0.02)]"
          : "border-border",
      )}
    >
      {/* Head: position, mover, round select, status, delete */}
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3.5 px-3.5 py-3">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-grid size-6 place-items-center rounded-full border text-[11.5px] font-semibold",
              round.detailed
                ? "border-blue-border bg-blue-soft text-blue"
                : "border-border bg-bg-2 text-fg-2",
            )}
          >
            {idx + 1}
          </span>
          <div className="flex flex-col gap-px">
            <MoveBtn dir={-1} disabled={idx === 0} onClick={() => onMove(-1)} />
            <MoveBtn dir={1} disabled={idx === total - 1} onClick={() => onMove(1)} />
          </div>
        </div>

        <div className="grid grid-cols-[minmax(140px,1fr)_auto] items-end gap-3.5 max-md:grid-cols-1">
          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>Round</span>
            <select
              value={round.round}
              onChange={(e) => set({ round: e.target.value })}
              className={cn(INPUT, "h-9 cursor-pointer appearance-none text-[13px]")}
            >
              {/* Keep a non-canonical prefilled value selectable (invite links /
                  legacy), but the offered choices are the canonical list only. */}
              {!isKnown && round.round && (
                <option value={round.round}>{round.round} (non-standard)</option>
              )}
              {roundTypes.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>Status</span>
            <div className="inline-flex h-9 overflow-hidden rounded-md border border-border bg-bg-2">
              {ROUND_STATUSES.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set({ status: s })}
                  className={cn(
                    "px-3 text-xs font-medium transition-[background,color]",
                    i < ROUND_STATUSES.length - 1 && "border-r border-border",
                    round.status === s
                      ? STATUS_ACTIVE[s]
                      : "text-fg-3 hover:bg-surface hover:text-fg",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="grid size-7 place-items-center self-start rounded-[7px] border border-transparent text-fg-3 hover:border-red-border hover:bg-red-soft hover:text-red"
            aria-label="Remove round"
          >
            <Icon.x className="size-3.5" />
          </button>
        ) : (
          <span />
        )}
      </div>

      {/* Detail toggle */}
      <button
        type="button"
        onClick={() => set({ detailed: !round.detailed })}
        className={cn(
          "flex w-full items-center gap-2 border-t px-3.5 py-2.5 text-left text-[12.5px] font-medium transition-[background,color]",
          round.detailed
            ? "border-t-blue-border bg-[rgba(46,160,248,0.04)] text-blue"
            : "border-t border-dashed border-border text-fg-2 hover:bg-bg-2 hover:text-fg",
        )}
      >
        <Icon.chev
          className={cn(
            "size-3 transition-transform",
            round.detailed ? "rotate-90 text-blue" : "text-fg-3",
          )}
        />
        {round.detailed ? "Hide details" : "Add details · platform, notes, content blocks"}
        <span className="ml-auto text-[11.5px] font-normal text-fg-3">
          {round.blocks.length > 0 &&
            `${round.blocks.length} block${round.blocks.length === 1 ? "" : "s"}`}
        </span>
      </button>

      {/* Detail body - typed content blocks */}
      {round.detailed && (
        <div className="border-t border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.015),transparent)] px-3.5 pb-[18px] pt-4">
          <div className="mb-4 grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Platform (optional)</span>
              <input
                value={round.platform}
                onChange={(e) => set({ platform: e.target.value })}
                placeholder="HackerRank, Amazon Chime, In-person…"
                className={cn(INPUT, "h-9 text-[13px]")}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>One-line note (optional)</span>
              <input
                value={round.note}
                onChange={(e) => set({ note: e.target.value })}
                placeholder="e.g. 90 min, two coding + one aptitude"
                className={cn(INPUT, "h-9 text-[13px]")}
              />
            </label>
          </div>

          {round.blocks.map((b, i) => (
            <BlockEditor
              key={i}
              block={b}
              index={i}
              topics={topics}
              onChange={(next) => setBlock(i, next)}
              onRemove={() => removeBlock(i)}
            />
          ))}

          {/* Add-block menu: a round can mix types */}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className={LABEL}>Add block</span>
            {(Object.keys(BLOCK_TYPE_META) as DraftBlockType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => addBlock(t)}
                className="inline-flex h-[30px] items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-[12.5px] font-medium text-fg-2 hover:border-blue-border hover:text-blue"
              >
                <Icon.plus className="size-3" />
                {BLOCK_TYPE_META[t].label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BlockEditor({
  block,
  index,
  topics,
  onChange,
  onRemove,
}: {
  block: DraftBlock;
  index: number;
  topics: { label: string; category: string }[];
  onChange: (next: DraftBlock) => void;
  onRemove: () => void;
}) {
  const meta = BLOCK_TYPE_META[block.type];
  const set = (patch: Partial<DraftBlock>) => onChange({ ...block, ...patch });

  return (
    <div className="mb-3 rounded-lg border border-border bg-surface p-4">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-fg-3">
          Block {index + 1} · <span className="text-blue">{meta.label}</span>
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="grid size-7 place-items-center rounded-[7px] border border-transparent text-fg-3 hover:border-red-border hover:bg-red-soft hover:text-red"
          aria-label="Remove block"
        >
          <Icon.x className="size-3.5" />
        </button>
      </div>

      <label className="mb-3 flex flex-col gap-1.5">
        <span className={LABEL}>{meta.promptLabel}</span>
        <textarea
          value={block.prompt}
          onChange={(e) => set({ prompt: e.target.value })}
          placeholder={meta.promptPlaceholder}
          maxLength={500}
          className={cn(INPUT, "min-h-[64px] resize-y py-2.5 leading-[1.55]")}
        />
      </label>

      <div className="mb-3 flex flex-col gap-1.5">
        <span className={LABEL}>
          Topic tags {block.type === "coding" ? "" : "(optional)"}
        </span>
        <TagInput
          value={block.topics}
          onChange={(next) => set({ topics: next })}
          taxonomy={topics}
          suggestions={BLOCK_TAG_SUGGESTIONS[block.type]}
        />
      </div>

      {meta.hasDifficulty && (
        <div className="mb-3 flex items-center gap-2.5">
          <span className={LABEL}>Difficulty</span>
          <div className="inline-flex overflow-hidden rounded-md border border-border bg-bg-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => set({ difficulty: n })}
                className={cn(
                  "h-8 w-9 text-xs font-semibold tabular-nums transition-[background,color]",
                  n < 5 && "border-r border-border",
                  block.difficulty === n
                    ? n >= 4
                      ? "bg-red-soft text-red"
                      : "bg-amber-soft text-amber"
                    : "text-fg-3 hover:bg-surface hover:text-fg",
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <span className="text-[11.5px] text-fg-3">1 = easy · 5 = brutal</span>
        </div>
      )}

      {meta.detailLabel && (
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>{meta.detailLabel}</span>
          <textarea
            value={block.detail}
            onChange={(e) => set({ detail: e.target.value })}
            placeholder={meta.detailPlaceholder}
            maxLength={500}
            className={cn(INPUT, "min-h-[56px] resize-y py-2.5 leading-[1.55]")}
          />
        </label>
      )}
    </div>
  );
}

function MoveBtn({
  dir,
  disabled,
  onClick,
}: {
  dir: -1 | 1;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={dir === -1 ? "Move up" : "Move down"}
      className="grid h-3.5 w-[18px] place-items-center rounded border border-transparent p-0 text-fg-4 hover:bg-bg-2 hover:text-fg-2 disabled:cursor-not-allowed disabled:opacity-30"
    >
      <Icon.chev className={cn("size-2.5", dir === -1 ? "-rotate-90" : "rotate-90")} />
    </button>
  );
}
