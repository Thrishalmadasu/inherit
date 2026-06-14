"use client";

// Curated-taxonomy topic picker. Per the PRD, students tag ONLY from the
// controlled vocabulary (concern #10): typing filters the canonical taxonomy
// (DB-sourced, passed in as `taxonomy`); Enter adds the top match; suggestion
// chips add with one click. Free text is never stored.
import { useMemo, useState } from "react";

export function TagInput({
  value,
  onChange,
  taxonomy,
  suggestions,
  placeholder = "Type to search topics…",
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  taxonomy: { label: string; category: string }[];
  suggestions: string[];
  placeholder?: string;
}) {
  const [q, setQ] = useState("");

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return taxonomy
      .filter((tag) => tag.label.toLowerCase().includes(t) && !value.includes(tag.label))
      .slice(0, 6);
  }, [q, value, taxonomy]);

  const add = (label: string) => {
    if (!value.includes(label)) onChange([...value, label]);
    setQ("");
  };
  const remove = (label: string) => onChange(value.filter((t) => t !== label));

  const freeSuggestions = suggestions.filter((s) => !value.includes(s)).slice(0, 7);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-border bg-bg-2 px-2.5 py-1.5 transition-[border-color,box-shadow] focus-within:border-blue-border focus-within:shadow-[0_0_0_3px_var(--color-blue-soft)]">
          {value.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-blue-border bg-blue-soft py-[3px] pl-2.5 pr-1 text-[11.5px] font-medium text-blue"
            >
              {t}
              <button
                type="button"
                onClick={() => remove(t)}
                className="grid size-[18px] place-items-center rounded-full text-sm leading-none text-blue opacity-60 hover:bg-[rgba(46,160,248,0.18)] hover:opacity-100"
                aria-label={`Remove ${t}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (matches[0]) add(matches[0].label);
              } else if (e.key === "Backspace" && !q && value.length) {
                remove(value[value.length - 1]);
              }
            }}
            placeholder={value.length === 0 ? placeholder : ""}
            className="min-w-[140px] flex-1 border-0 bg-transparent px-0.5 py-1 text-[13px] text-fg outline-none placeholder:text-fg-4"
          />
        </div>

        {matches.length > 0 && (
          <div className="absolute inset-x-0 top-[calc(100%+4px)] z-10 overflow-hidden rounded-md border border-border-strong bg-surface shadow-[0_14px_40px_-8px_rgba(0,0,0,0.6)]">
            {matches.map((m) => (
              <button
                key={m.label}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(m.label);
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] text-fg hover:bg-bg-2"
              >
                {m.label}
                <span className="text-[10.5px] uppercase tracking-[0.06em] text-fg-4">
                  {m.category.replace("_", " ")}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {freeSuggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-3">
            Suggested
          </span>
          {freeSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="inline-flex h-[26px] items-center rounded-full border border-border bg-surface px-2.5 text-xs font-medium text-fg-2 hover:border-border-hover hover:text-fg"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
