import { Fragment } from "react";
import { Icon } from "@/components/icons";

// Round-by-round funnel: counts[i] = experiences that reached path[i].
export function Funnel({ path, counts }: { path: string[]; counts: number[] }) {
  const max = Math.max(...counts);
  return (
    <div className="mt-1 flex items-center gap-1">
      {path.map((step, i) => (
        <Fragment key={step}>
          <div className="relative min-w-0 flex-1 rounded-md border border-border bg-bg-2 px-2.5 pb-3 pt-2.5">
            <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-fg-3">
              {step}
            </div>
            <div className="mt-1 flex items-baseline gap-1 text-[17px] font-semibold">
              {counts[i]}
              <small className="text-[10.5px] font-medium text-fg-3">
                experiences
              </small>
            </div>
            <div className="absolute inset-x-2.5 bottom-1.5 h-[3px] overflow-hidden rounded-[2px] bg-gray-soft">
              <span
                className="block h-full rounded-[2px] bg-gradient-to-r from-blue to-blue-deep"
                style={{ width: `${(counts[i] / max) * 100}%` }}
              />
            </div>
          </div>
          {i < path.length - 1 && (
            <span className="shrink-0 text-fg-4" aria-hidden>
              <Icon.arrow className="block size-3" />
            </span>
          )}
        </Fragment>
      ))}
    </div>
  );
}
