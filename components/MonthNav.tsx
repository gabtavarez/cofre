import Link from "next/link";
import { Icon } from "@/components/icons";
import { MonthRemember } from "@/components/MonthRemember";
import { monthLabel, shiftMonth } from "@/lib/dates";

export function MonthNav({ month, basePath }: { month: string; basePath: string }) {
  const prev = `${basePath}?m=${shiftMonth(month, -1)}`;
  const next = `${basePath}?m=${shiftMonth(month, 1)}`;
  return (
    <div className="flex min-h-12 items-center gap-1 rounded-[14px] border border-line bg-surface px-1.5">
      <MonthRemember month={month} />
      <Link
        href={prev}
        aria-label="Mês anterior"
        className="flex size-10 items-center justify-center rounded-[10px] text-muted hover:bg-raised hover:text-text"
      >
        <Icon name="left" size={18} stroke={2} />
      </Link>
      <span className="min-w-28 text-center text-sm font-bold">{monthLabel(month)}</span>
      <Link
        href={next}
        aria-label="Próximo mês"
        className="flex size-10 items-center justify-center rounded-[10px] text-muted hover:bg-raised hover:text-text"
      >
        <Icon name="right" size={18} stroke={2} />
      </Link>
    </div>
  );
}
