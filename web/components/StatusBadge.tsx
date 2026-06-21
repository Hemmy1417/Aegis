import { STATUS_META } from "@/lib/config";

const TONE: Record<string, string> = {
  neutral: "!bg-surface-strong !text-muted",
  active: "!bg-sky-100 !text-sky-800",
  warn: "!bg-amber-100 !text-amber-800",
  good: "!bg-emerald-100 !text-emerald-800",
  bad: "!bg-rose-100 !text-rose-800",
};

export function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, tone: "neutral" as const };
  return <span className={`badge ${TONE[meta.tone]}`}>{meta.label}</span>;
}
