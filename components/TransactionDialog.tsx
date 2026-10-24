"use client";

import { useMemo, useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { createTransaction } from "@/lib/actions";
import { addMonths } from "@/lib/dates";
import { brl, parseBRL, splitInstallments } from "@/lib/format";
import type { Account, Category, Kind, Repeat } from "@/lib/types";

const field =
  "min-h-12 w-full rounded-xl border border-edge bg-side px-3.5 text-sm font-semibold text-text outline-none focus:border-accent";
const label = "text-xs font-bold text-muted";

export function NewTransactionButton({
  accounts,
  categories,
  today,
}: {
  accounts: Account[];
  categories: Category[];
  today: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-[14px] bg-accent px-5.5 text-sm font-extrabold text-ink hover:brightness-110"
      >
        <Icon name="plus" size={18} stroke={2.6} />
        Novo lançamento
      </button>
      {open && (
        <TransactionDialog
          accounts={accounts}
          categories={categories}
          today={today}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function TransactionDialog({
  accounts,
  categories,
  today,
  onClose,
}: {
  accounts: Account[];
  categories: Category[];
  today: string;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<Kind>("expense");
  const [repeat, setRepeat] = useState<Repeat>("none");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [count, setCount] = useState("2");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const cats = categories.filter((c) => c.kind === kind);
  const total = parseBRL(amount);
  const n = Math.max(2, Math.min(120, Number(count) || 2));

  const preview = useMemo(() => {
    if (repeat !== "installment" || !Number.isFinite(total) || total <= 0) return null;
    const parts = splitInstallments(total, n);
    const shown = parts.slice(0, 6).map((v, i) => ({ no: i + 1, date: addMonths(date, i), v }));
    return { parts, shown, last: addMonths(date, n - 1) };
  }, [repeat, total, n, date]);

  function submit(fd: FormData) {
    setError(null);
    fd.set("kind", kind);
    fd.set("repeat", repeat);
    startTransition(async () => {
      const res = await createTransaction(fd);
      if (res.ok) onClose();
      else setError(res.error);
    });
  }

  const tab = (active: boolean, activeCls: string) =>
    `min-h-10 cursor-pointer rounded-[10px] px-4.5 text-[13px] ${
      active ? `font-extrabold ${activeCls}` : "font-semibold text-muted hover:text-text"
    }`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#050810]/80 px-5 py-10"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        action={submit}
        role="dialog"
        aria-label="Novo lançamento"
        className="w-full max-w-165 rounded-3xl border border-edge bg-[#141b30] shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
      >
        <div className="flex items-center justify-between px-7 pt-5.5">
          <div className="flex gap-1 rounded-[14px] border border-line bg-side p-1">
            <button type="button" onClick={() => setKind("expense")} className={tab(kind === "expense", "bg-expense-bg text-expense-text")}>
              Despesa
            </button>
            <button type="button" onClick={() => setKind("income")} className={tab(kind === "income", "bg-income-bg text-income-text")}>
              Receita
            </button>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex size-10 cursor-pointer items-center justify-center rounded-xl text-muted hover:bg-raised hover:text-text">
            <Icon name="close" stroke={2} />
          </button>
        </div>

        <div className="flex flex-col gap-5 px-7 pt-5 pb-2">
          <label className="flex flex-col gap-1.5">
            <span className={label}>{repeat === "installment" ? "Valor total (R$)" : "Valor (R$)"}</span>
            <input
              name="amount"
              inputMode="decimal"
              placeholder="0,00"
              required
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`w-full border-0 border-b-2 border-accent bg-transparent py-1 text-4xl font-extrabold tracking-tight outline-none placeholder:text-muted/40 ${
                kind === "expense" ? "text-expense-text" : "text-income-text"
              }`}
            />
          </label>

          <div className="flex flex-wrap gap-4">
            <label className="flex min-w-60 flex-2 flex-col gap-1.5">
              <span className={label}>Descrição</span>
              <input name="description" required placeholder="Ex.: Mercado" className={field} />
            </label>
            <label className="flex min-w-38 flex-1 flex-col gap-1.5">
              <span className={label}>{repeat === "none" ? "Data" : "Data da 1ª"}</span>
              <input name="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={field} />
            </label>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={label}>Repetição</span>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-1 rounded-[14px] border border-line bg-side p-1">
                <button type="button" onClick={() => setRepeat("none")} className={tab(repeat === "none", "bg-accent-bg text-accent-soft")}>
                  Única
                </button>
                <button type="button" onClick={() => setRepeat("installment")} className={tab(repeat === "installment", "bg-accent-bg text-accent-soft")}>
                  Parcelada
                </button>
                <button type="button" onClick={() => setRepeat("fixed")} className={tab(repeat === "fixed", "bg-accent-bg text-accent-soft")}>
                  Fixa mensal
                </button>
              </div>
              {repeat === "installment" && (
                <label className="flex items-center gap-2 text-[13px] font-semibold text-muted">
                  Parcelas
                  <input
                    name="count"
                    type="number"
                    min={2}
                    max={120}
                    value={count}
                    onChange={(e) => setCount(e.target.value)}
                    className="min-h-11 w-18 rounded-xl border border-edge bg-side text-center text-sm font-bold text-text outline-none focus:border-accent"
                  />
                </label>
              )}
            </div>
            {repeat === "fixed" && (
              <p className="text-xs text-muted">Cria os próximos 12 meses. Dá para apagar “este e os próximos” depois.</p>
            )}
          </div>

          {preview && (
            <div className="flex flex-col gap-2.5 rounded-[14px] border border-dashed border-edge bg-side px-4 py-3.5">
              <span className="text-[13px] text-soft">
                <b className="text-text">
                  {n} × {brl(preview.parts[0])}
                </b>
                {" · última parcela em "}
                {preview.last.split("-").reverse().join("/")}
                {preview.parts[n - 1] !== preview.parts[0] && ` (${brl(preview.parts[n - 1])})`}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {preview.shown.map((p) => (
                  <span
                    key={p.no}
                    className={`rounded-full px-2.5 py-1 text-xs ${p.no === 1 ? "bg-accent-bg font-bold text-accent-soft" : "bg-raised font-semibold text-soft"}`}
                  >
                    {p.no}/{n} · {p.date.slice(8, 10)}/{p.date.slice(5, 7)}
                  </span>
                ))}
                {n > 6 && <span className="px-1 py-1 text-xs text-muted">…</span>}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-4">
            <label className="flex min-w-50 flex-1 flex-col gap-1.5">
              <span className={label}>Conta</span>
              <select name="account_id" required defaultValue={accounts[0]?.id} className={field}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-50 flex-1 flex-col gap-1.5">
              <span className={label}>Categoria</span>
              <select name="category_id" key={kind} defaultValue="" className={field}>
                <option value="">Sem categoria</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[13px] font-semibold text-soft">
            <input name="paid" type="checkbox" className="size-5 accent-[#8c8fff]" />
            {kind === "expense" ? "Já foi pago" : "Já foi recebido"}
            {repeat !== "none" && <span className="text-xs font-normal text-muted">(vale só para a 1ª)</span>}
          </label>

          {error && (
            <p role="alert" className="rounded-xl bg-expense-bg px-4 py-3 text-sm font-semibold text-expense-text">
              {error}
            </p>
          )}
        </div>

        <div className="mt-2 flex items-center justify-end gap-2 rounded-b-3xl border-t border-line bg-[#101627] px-7 py-4">
          <button type="button" onClick={onClose} className="min-h-11 cursor-pointer rounded-xl px-4.5 text-sm font-bold text-muted hover:text-text">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending || accounts.length === 0}
            className="min-h-11 cursor-pointer rounded-xl bg-accent px-6 text-sm font-extrabold text-ink hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Salvando…" : "Salvar"}
          </button>
        </div>
        {accounts.length === 0 && (
          <p className="px-7 pb-5 text-xs text-warn-text">Crie uma conta em “Contas” antes de lançar.</p>
        )}
      </form>
    </div>
  );
}
