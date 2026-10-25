import { MonthNav } from "@/components/MonthNav";
import { NewTransactionButton } from "@/components/TransactionDialog";
import { TxRow, type TxRowData } from "@/components/TxRow";
import { getBase, getBalanceRows, getCategoryHints, getTransactionsBetween } from "@/lib/data";
import { dayHeading, dm, monthBounds, resolveMonth, todayISO } from "@/lib/dates";
import { brl } from "@/lib/format";
import { round2, signed, summarize } from "@/lib/finance";

export default async function Lancamentos({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const today = todayISO();
  const month = resolveMonth(m);
  const { start, end } = monthBounds(month);

  const [{ accounts, categories }, txs, rows, hints] = await Promise.all([
    getBase(),
    getTransactionsBetween(start, end),
    getBalanceRows(end),
    getCategoryHints(),
  ]);

  const initial = accounts.reduce((s, a) => s + a.initial_balance, 0);
  const opening = round2(rows.filter((r) => r.date < start).reduce((s, r) => s + signed(r), initial));
  const sum = summarize(txs);
  const closing = round2(opening + sum.income - sum.expense);

  const late = txs.filter((t) => !t.paid && t.date < today).length;
  const scheduled = txs.filter((t) => !t.paid && t.date >= today).length;
  const done = txs.filter((t) => t.paid).length;

  // agrupa por dia com saldo corrente (previsto)
  const groups: { date: string; balance: number; items: TxRowData[] }[] = [];
  let running = opening;
  for (const t of txs) {
    running = round2(running + signed(t));
    let g = groups[groups.length - 1];
    if (!g || g.date !== t.date) {
      g = { date: t.date, balance: running, items: [] };
      groups.push(g);
    }
    g.balance = running;
    g.items.push({
      id: t.id,
      date: dm(t.date),
      description: t.description,
      category: t.category?.name ?? null,
      account: t.account?.name ?? null,
      kind: t.kind,
      amount: t.amount,
      paid: t.paid,
      late: !t.paid && t.date < today,
      tag:
        t.repeat === "installment"
          ? `Parcela ${t.installment_no}/${t.installments_total}`
          : t.repeat === "fixed"
            ? "Fixa"
            : t.repeat === "yearly"
              ? "Anual"
              : null,
      inSeries: !!t.series_id,
      edit: {
        id: t.id,
        kind: t.kind,
        description: t.description,
        amount: t.amount,
        date: t.date,
        accountId: t.account_id,
        categoryId: t.category_id,
        paid: t.paid,
        repeat: t.repeat,
        inSeries: !!t.series_id,
        tag:
          t.repeat === "installment"
            ? `Parcela ${t.installment_no}/${t.installments_total}`
            : t.repeat === "fixed"
              ? "Fixa"
              : t.repeat === "yearly"
                ? "Anual"
                : null,
      },
    });
  }

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight">Lançamentos</h1>
        <div className="flex flex-wrap items-center gap-3">
          <MonthNav month={month} basePath="/lancamentos" />
          <NewTransactionButton accounts={accounts} categories={categories} today={today} hints={hints} />
        </div>
      </header>

      <section className="flex flex-wrap rounded-[20px] border border-line bg-surface py-2">
        {[
          { l: "Saldo anterior", v: brl(opening), c: "" },
          { l: "Receitas", v: brl(sum.income), c: "text-income-text" },
          { l: "Despesas", v: brl(sum.expense), c: "text-expense-text" },
          { l: "Saldo final projetado", v: brl(closing), c: "" },
        ].map((s) => (
          <div key={s.l} className="flex min-w-44 flex-1 flex-col gap-1 px-6 py-3.5">
            <span className="text-xs font-semibold text-muted">{s.l}</span>
            <b className={`text-xl ${s.c}`}>{s.v}</b>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-[20px] border border-line bg-surface">
        <div className="flex flex-wrap gap-2 px-5 py-4">
          <span className="inline-flex items-center gap-2 rounded-full bg-expense-bg px-3.5 py-2 text-[13px] font-bold text-expense-text">
            <span className="size-2 rounded-full bg-expense" />
            Atrasados · {late}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-warn-bg px-3.5 py-2 text-[13px] font-bold text-warn-text">
            <span className="size-2 rounded-full bg-warn" />
            Agendados · {scheduled}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-income-bg px-3.5 py-2 text-[13px] font-bold text-income-text">
            <span className="size-2 rounded-full bg-income" />
            Confirmados · {done}
          </span>
        </div>

        {groups.length === 0 && (
          <p className="border-t border-line px-5 py-12 text-center text-sm text-muted">
            Nenhum lançamento neste mês. Use “Novo lançamento” para começar.
          </p>
        )}

        <div className="overflow-x-auto">
          <div className="min-w-160">
            {groups.map((g) => (
              <div key={g.date}>
                <div className="flex items-center justify-between border-t border-line bg-side px-5 py-2.5 text-xs font-bold">
                  <span className={g.date === today ? "text-accent-soft" : g.date < today ? "text-muted" : "text-soft"}>
                    {dayHeading(g.date)}
                    {g.date === today ? " · hoje" : ""}
                  </span>
                  <span className="font-semibold text-muted">
                    Saldo do dia <b className="ml-1.5 text-text">{brl(g.balance)}</b>
                  </span>
                </div>
                {g.items.map((it) => (
                  <TxRow key={it.id} t={it} accounts={accounts} categories={categories} today={today} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
