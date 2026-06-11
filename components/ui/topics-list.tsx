import type { TopicCount } from "@/lib/types";

export function TopicsList({ topics }: { topics: TopicCount[] }) {
  const max = Math.max(...topics.map((t) => t.count));
  return (
    <div className="flex flex-col gap-[9px]">
      {topics.map((t) => (
        <div key={t.name} className="flex items-center gap-3 text-[13px]">
          <span className="min-w-0 flex-1 truncate text-fg">{t.name}</span>
          <span className="h-1 shrink-0 grow-0 basis-[90px] overflow-hidden rounded-[2px] bg-gray-soft">
            <span
              className="block h-full rounded-[2px] bg-gradient-to-r from-blue to-[#56b6fb]"
              style={{ width: `${(t.count / max) * 100}%` }}
            />
          </span>
          <span className="w-[22px] text-right text-xs tabular-nums text-fg-2">
            {t.count}
          </span>
        </div>
      ))}
    </div>
  );
}
