"use client";

import { useMemo, useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { adjustBalance } from "@/lib/actions";
import { brl, parseBRL } from "@/lib/format";
import type { Category } from "@/lib/types";

const field =
  "min-h-12 w-full rounded-xl border border-edge bg-side px-3.5 text-sm font-semibold text-text outline-none focus:border-accent";
const label = "text-xs font-bold text-muted";

export type AdjustAccount = {
  id: string;
  name: string;
  initial: number;
  paid: [string, number][]; // [data, valor com sinal] dos lançamentos pagos da conta
};

type Props = {
  accounts: AdjustAccount[];
  defaultAccountId?: string;
  categories: Category[];
  today: string;
  variant?: "row" | "primary";
};

export function AdjustBalanceButton({ variant = "row", ...props }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {variant === "primary" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-[14px] border border-edge bg-raised px-5 text-sm font-extrabold text-text hover:brightness-125"
        >
          <Icon name="edit" size={18} />
          Ajustar saldo
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Ajustar saldo"
          aria-label="Ajustar saldo"
          className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold text-muted hover:bg-raised hover:text-text"
        >
          <Icon name="edit" size={16} />
          <span className="hidden sm:inline">Ajustar saldo</span>
        </button>
      )}
      {open && <Dialog {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function Dialog({
  accounts,
  defaultAccountId,
  categories,
  today,
  onClose,
}: Props & { onClose: () => void }) {
  const [accountId, setAccountId] = useState(defaultAccountId ?? accounts[0]?.id ?? "");
  const acc = accounts.find((a) => a.id === accountId) ?? accounts[0];
  const accountName = acc?.name ?? "";
  const initial = acc?.initial ?? 0;
  const paid = acc?.paid ?? [];
  const [date, setDate] = useState(today);
  const [balance, setBalance] = useState("");
  const [debtor, setDebtor] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const current = useMemo(
    () => Math.round(paid.reduce((s, [d, v]) => (d <= date ? s + v : s), initial) * 100) / 100,
    [paid, initial, date],
  );
  const raw = parseBRL(balance);
  const target = Number.isFinite(raw) ? (debtor ? -raw : raw) : null;
  const diff = target === null ? null : Math.round((target - current) * 100) / 100;
  const kind = diff !== null && diff < 0 ? "expense" : "income";
  const cats = categories.filter((c) => c.kind === kind);
  const selected = cats.some((c) => c.id === categoryId) ? categoryId : "";

  function submit(fd: FormData) {
    setError(null);
    fd.set("account_id", accountId);
    fd.set("sign", debtor ? "debtor" : "creditor");
    fd.set("category_id", selected);
    startTransition(async () => {
      const res = await adjustBalance(fd);
      if (res.ok) onClose();
      else setError(res.error);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#050810]/80 px-5 py-10"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        action={submit}
        role="dialog"
        aria-label={`Ajustar saldo: ${accountName}`}
        className="w-full max-w-120 rounded-3xl border border-edge bg-[#141b30] shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
      >
        <div className="flex items-center justify-between px-7 pt-6">
          <h2 className="text-lg font-bold">Ajustar saldo: {accountName}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex size-10 cursor-pointer items-center justify-center rounded-xl text-muted hover:bg-raised hover:text-text">
            <Icon name="close" stroke={2} />
          </button>
        </div>

        <div className="flex flex-col gap-5 px-7 py-5">
          {accounts.length > 1 && (
            <label className="flex flex-col gap-1.5">
              <span className={label}>Conta</span>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={field}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1.5">
            <span className={label}>Atualizar saldo em</span>
            <input name="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={field} />
          </label>

          <div className="flex flex-wrap items-end gap-4">
            <label className="flex min-w-44 flex-1 flex-col gap-1.5">
              <span className={label}>Novo saldo na data (R$)</span>
              <input
                name="balance"
                inputMode="decimal"
                required
                autoFocus
                placeholder="0,00"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                className={field}
              />
            </label>
            <div className="flex min-h-12 items-center gap-5 text-sm font-semibold text-soft">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="radio" checked={!debtor} onChange={() => setDebtor(false)} className="size-4 accent-[#c8f169]" />
                Credor
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="radio" checked={debtor} onChange={() => setDebtor(true)} className="size-4 accent-[#c8f169]" />
                Devedor
              </label>
            </div>
          </div>

          <p className="rounded-xl bg-raised px-4 py-3 text-sm text-soft">
            Saldo nessa data: <b className="text-text">{brl(current)}</b>
            {diff !== null && diff !== 0 && (
              <>
                <br />
                Será criada {diff > 0 ? "uma receita" : "uma despesa"} no valor de{" "}
                <b className={diff > 0 ? "text-income-text" : "text-expense-text"}>{brl(Math.abs(diff))}</b>
              </>
            )}
            {diff === 0 && <> · nada a ajustar</>}
          </p>

          <label className="flex flex-col gap-1.5">
            <span className={label}>Categoria</span>
            <select value={selected} onChange={(e) => setCategoryId(e.target.value)} className={field}>
              <option value="">Sem categoria</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          {error && (
            <p role="alert" className="rounded-xl bg-expense-bg px-4 py-3 text-sm font-semibold text-expense-text">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 rounded-b-3xl border-t border-line bg-[#101627] px-7 py-4">
          <button type="button" onClick={onClose} className="min-h-11 cursor-pointer rounded-xl px-4.5 text-sm font-bold text-muted hover:text-text">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending || diff === null || diff === 0}
            className="min-h-11 cursor-pointer rounded-xl bg-accent px-6 text-sm font-extrabold text-ink hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
