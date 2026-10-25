"use client";

import { useMemo, useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { createTransaction, updateTransaction } from "@/lib/actions";
import { addMonths } from "@/lib/dates";
import { brl, parseBRL, splitInstallments, suggestCategory } from "@/lib/format";
import type { Account, Category, Kind, Repeat } from "@/lib/types";

const field =
  "min-h-12 w-full rounded-xl border border-edge bg-side px-3.5 text-sm font-semibold text-text outline-none focus:border-accent";
const label = "text-xs font-bold text-muted";

export function NewTransactionButton({
  accounts,
  categories,
  today,
  hints,
}: {
  accounts: Account[];
  categories: Category[];
  today: string;
  hints?: Record<string, string>;
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
          hints={hints}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

export type EditTarget = {
  id: string;
  kind: Kind;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  accountId: string;
  categoryId: string | null;
  paid: boolean;
  repeat: Repeat;
  inSeries: boolean;
  tag: string | null;
};

export function TransactionDialog({
  accounts,
  categories,
  today,
  onClose,
  edit,
  hints,
}: {
  accounts: Account[];
  categories: Category[];
  today: string;
  onClose: () => void;
  edit?: EditTarget;
  hints?: Record<string, string>;
}) {
  const [kind, setKind] = useState<Kind>(edit?.kind ?? "expense");
  const [repeat, setRepeat] = useState<Repeat>(edit?.repeat ?? "none");
  const [amount, setAmount] = useState(edit ? String(edit.amount).replace(".", ",") : "");
  const [date, setDate] = useState(edit?.date ?? today);
  const [count, setCount] = useState("2");
  const [categoryId, setCategoryId] = useState<string>(edit?.categoryId ?? "");
  const [catTouched, setCatTouched] = useState(false);
  const [suggested, setSuggested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const cats = categories.filter((c) => c.kind === kind);
  const total = parseBRL(amount);
  const n = Math.max(2, Math.min(120, Number(count) || 2));

  const preview = useMemo(() => {
    if (edit || repeat !== "installment" || !Number.isFinite(total) || total <= 0) return null;
    const parts = splitInstallments(total, n);
    const shown = parts.slice(0, 6).map((v, i) => ({ no: i + 1, date: addMonths(date, i), v }));
    return { parts, shown, last: addMonths(date, n - 1) };
  }, [edit, repeat, total, n, date]);

  function submit(fd: FormData) {
    setError(null);
    fd.set("kind", kind);
    fd.set("repeat", repeat);
    if (edit) fd.set("id", edit.id);
    startTransition(async () => {
      const res = edit ? await updateTransaction(fd) : await createTransaction(fd);
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
        aria-label={edit ? "Editar lançamento" : "Novo lançamento"}
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
            <span className={label}>{edit ? (edit.repeat === "installment" ? "Valor da parcela (R$)" : "Valor (R$)") : repeat === "installment" ? "Valor total (R$)" : "Valor (R$)"}</span>
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
              <input
                name="description"
                required
                placeholder="Ex.: Mercado"
                defaultValue={edit?.description}
                onChange={(e) => {
                  if (edit || catTouched || !hints) return;
                  const id = suggestCategory(e.target.value, hints);
                  const cat = id ? categories.find((c) => c.id === id) : undefined;
                  if (cat) {
                    setKind(cat.kind);
                    setCategoryId(cat.id);
                    setSuggested(true);
                  } else if (suggested) {
                    setCategoryId("");
                    setSuggested(false);
                  }
                }}
                className={field}
              />
            </label>
            <label className="flex min-w-38 flex-1 flex-col gap-1.5">
              <span className={label}>{edit || repeat === "none" ? "Data" : "Data da 1ª"}</span>
              <input name="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={field} />
            </label>
          </div>

          {edit && edit.inSeries && (
            <fieldset className="flex flex-col gap-2 rounded-[14px] border border-line bg-side px-4 py-3.5">
              <legend className="px-1 text-xs font-bold text-muted">
                Este lançamento faz parte de uma série{edit.tag ? ` (${edit.tag})` : ""}
              </legend>
              <label className="flex min-h-9 cursor-pointer items-center gap-2.5 text-[13px] font-semibold text-soft">
                <input type="radio" name="scope" value="one" defaultChecked className="size-4 accent-[#c8f169]" />
                Alterar só este
              </label>
              <label className="flex min-h-9 cursor-pointer items-start gap-2.5 text-[13px] font-semibold text-soft">
                <input type="radio" name="scope" value="future" className="mt-0.5 size-4 accent-[#c8f169]" />
                <span>
                  Alterar este e os próximos
                  <span className="block text-xs font-normal text-muted">
                    Propaga descrição, categoria e conta{edit.repeat === "fixed" || edit.repeat === "yearly" ? " e valor" : ""}. A data só muda neste.
                  </span>
                </span>
              </label>
            </fieldset>
          )}

          <div className={`flex flex-col gap-1.5 ${edit ? "hidden" : ""}`}>
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
                <button type="button" onClick={() => setRepeat("yearly")} className={tab(repeat === "yearly", "bg-accent-bg text-accent-soft")}>
                  Anual
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
            {repeat === "yearly" && (
              <p className="text-xs text-muted">Repete todo ano, na mesma data, pelos próximos 5 anos. Ex.: 13º em novembro e outro em dezembro.</p>
            )}
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
              <select name="account_id" required defaultValue={edit?.accountId ?? accounts[0]?.id} className={field}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-50 flex-1 flex-col gap-1.5">
              <span className={label}>
                Categoria{suggested && <span className="ml-1.5 font-semibold text-accent-soft">· sugerida pela descrição</span>}
              </span>
              <select
                name="category_id"
                value={cats.some((c) => c.id === categoryId) ? categoryId : ""}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setCatTouched(true);
                  setSuggested(false);
                }}
                className={field}
              >
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
            <input name="paid" type="checkbox" defaultChecked={edit?.paid} className="size-5 accent-[#c8f169]" />
            {kind === "expense" ? "Já foi pago" : "Já foi recebido"}
            {!edit && repeat !== "none" && <span className="text-xs font-normal text-muted">(vale só para a 1ª)</span>}
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
            {pending ? "Salvando…" : edit ? "Salvar alterações" : "Salvar"}
          </button>
        </div>
        {accounts.length === 0 && (
          <p className="px-7 pb-5 text-xs text-warn-text">Crie uma conta em “Contas” antes de lançar.</p>
        )}
      </form>
    </div>
  );
}
