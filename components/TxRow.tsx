"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { deleteTransaction, setPaid } from "@/lib/actions";
import { brl } from "@/lib/format";

export type TxRowData = {
  id: string;
  date: string; // dd/mm
  description: string;
  category: string | null;
  account: string | null;
  kind: "expense" | "income";
  amount: number;
  paid: boolean;
  late: boolean;
  tag: string | null;
  inSeries: boolean;
};

export function TxRow({ t }: { t: TxRowData }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = t.paid ? "paid" : t.late ? "late" : "sched";
  const statusColor = status === "paid" ? "text-income" : status === "late" ? "text-expense" : "text-warn";
  const statusLabel = t.paid
    ? t.kind === "income" ? "Recebido" : "Pago"
    : t.late ? "Atrasado" : "Agendado";
  const actionLabel = t.paid
    ? "Marcar como não pago"
    : t.kind === "income" ? "Marcar como recebido" : "Marcar como pago";

  function toggle() {
    setError(null);
    startTransition(async () => {
      const res = await setPaid(t.id, !t.paid);
      if (!res.ok) setError(res.error);
    });
  }

  function remove(scope: "one" | "future") {
    setError(null);
    startTransition(async () => {
      const res = await deleteTransaction(t.id, scope);
      if (!res.ok) setError(res.error);
      else setConfirming(false);
    });
  }

  return (
    <div className={`border-t border-line ${pending ? "opacity-60" : ""}`}>
      <div className="flex min-h-14 items-center gap-4 px-5">
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          title={`${statusLabel} · ${actionLabel}`}
          aria-label={`${statusLabel}. ${actionLabel}`}
          className={`flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-raised ${statusColor}`}
        >
          <Icon name={status === "paid" ? "check" : status === "late" ? "alert" : "clock"} size={22} stroke={2} />
        </button>
        <span className="w-11 shrink-0 text-[13px] font-semibold text-muted">{t.date}</span>
        <span className="flex min-w-0 flex-1 items-center gap-2.5">
          <b className="truncate text-sm">{t.description}</b>
          {t.tag && (
            <span className="shrink-0 rounded-full bg-accent-bg px-2.5 py-0.5 text-[11px] font-bold text-accent-soft">
              {t.tag}
            </span>
          )}
        </span>
        <span className="hidden w-36 shrink-0 md:block">
          {t.category && (
            <span className="rounded-full bg-raised px-3 py-1.5 text-xs font-semibold text-soft">{t.category}</span>
          )}
        </span>
        <span className="hidden w-24 shrink-0 truncate text-[13px] text-muted lg:block">{t.account}</span>
        <b className={`w-28 shrink-0 text-right text-sm ${t.kind === "income" ? "text-income-text" : "text-expense-text"}`}>
          {t.kind === "income" ? "+" : "−"}
          {brl(t.amount).replace("−", "")}
        </b>
        <button
          type="button"
          onClick={() => setConfirming((v) => !v)}
          aria-label="Apagar lançamento"
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-raised hover:text-expense-text"
        >
          <Icon name="trash" size={18} />
        </button>
      </div>

      {confirming && (
        <div className="flex flex-wrap items-center justify-end gap-2 bg-side px-5 py-3 text-[13px]">
          <span className="mr-auto text-soft">Apagar “{t.description}”?</span>
          <button type="button" onClick={() => setConfirming(false)} className="min-h-10 cursor-pointer rounded-lg px-3 font-bold text-muted hover:text-text">
            Cancelar
          </button>
          <button type="button" onClick={() => remove("one")} disabled={pending} className="min-h-10 cursor-pointer rounded-lg bg-expense-bg px-3.5 font-bold text-expense-text">
            Só este
          </button>
          {t.inSeries && (
            <button type="button" onClick={() => remove("future")} disabled={pending} className="min-h-10 cursor-pointer rounded-lg bg-expense-bg px-3.5 font-bold text-expense-text">
              Este e os próximos
            </button>
          )}
        </div>
      )}
      {error && <p className="bg-expense-bg px-5 py-2 text-xs font-semibold text-expense-text">{error}</p>}
    </div>
  );
}
