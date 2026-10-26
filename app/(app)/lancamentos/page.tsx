import { AdjustBalanceButton } from "@/components/AdjustBalanceButton";
import { MonthNav } from "@/components/MonthNav";
import { NewTransactionButton } from "@/components/TransactionDialog";
import { TxRow, type TxRowData } from "@/components/TxRow";
import { getBase, getBalanceRows, getCategoryHints, getTransactionsBetween } from "@/lib/data";
import { dayHeading, dm, monthBounds, resolveMonth, todayISO } from "@/lib/dates";
import { brl, normalizeDesc } from "@/lib/format";
import { round2, signed, summarize } from "@/lib/finance";

export default async function Lancamentos({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; q?: string; cat?: string; acc?: string; st?: string; k?: string; all?: string }>;
}) {
  const { m, q = "", cat = "", acc = "", st = "", k = "", all = "" } = await searchParams;
  const today = todayISO();
  const month = resolveMonth(m);
  const { start, end } = monthBounds(month);

  const [{ accounts, categories }, txs, rows, hints] = await Promise.all([
    getBase(),
    getTransactionsBetween(start, end),
    getBalanceRows(end > today ? end : today),
    getCategoryHints(),
  ]);

  const searchAll = all === "1";
  const filtered = searchAll || !!(q || cat || acc || st || k);
  const source = searchAll ? await getTransactionsBetween("2000-01-01", "2100-12-31") : txs;
  const needle = normalizeDesc(q);
  const listTxs = source.filter((t) => {
    if (needle && !normalizeDesc(t.description).includes(needle)) return false;
    if (cat && (cat === "none" ? t.category_id !== null : t.category_id !== cat)) return false;
    if (acc && t.account_id !== acc) return false;
    if (k && t.kind !== k) return false;
    if (st === "paid" && !t.paid) return false;
    if (st === "late" && !(!t.paid && t.date < today)) return false;
    if (st === "sched" && !(!t.paid && t.date >= today)) return false;
    return true;
  });
  const listSum = summarize(listTxs);

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
  for (const t of listTxs) {
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
          <AdjustBalanceButton
            variant="primary"
            accounts={accounts.map((a) => ({
              id: a.id,
              name: a.name,
              initial: a.initial_balance,
              paid: rows.filter((r) => r.paid && r.account_id === a.id).map((r): [string, number] => [r.date, signed(r)]),
            }))}
            categories={categories}
            today={today}
          />
          <NewTransactionButton accounts={accounts} categories={categories} today={today} hints={hints} />
        </div>
      </header>

      <form method="get" action="/lancamentos" className="flex flex-wrap items-end gap-3 rounded-[20px] border border-line bg-surface p-4">
        <input type="hidden" name="m" value={month} />
        <label className="flex min-w-48 flex-[2_1_0] flex-col gap-1.5">
          <span className="text-xs font-bold text-muted">Buscar</span>
          <input name="q" defaultValue={q} placeholder="Descrição…" className="min-h-11 w-full rounded-xl border border-edge bg-side px-3.5 text-sm font-semibold text-text outline-none focus:border-accent" />
        </label>
        <label className="flex min-w-36 flex-1 flex-col gap-1.5">
          <span className="text-xs font-bold text-muted">Categoria</span>
          <select name="cat" defaultValue={cat} className="min-h-11 w-full rounded-xl border border-edge bg-side px-3 text-sm font-semibold text-text outline-none focus:border-accent">
            <option value="">Todas</option>
            <option value="none">Sem categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="flex min-w-32 flex-1 flex-col gap-1.5">
          <span className="text-xs font-bold text-muted">Conta</span>
          <select name="acc" defaultValue={acc} className="min-h-11 w-full rounded-xl border border-edge bg-side px-3 text-sm font-semibold text-text outline-none focus:border-accent">
            <option value="">Todas</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
        <label className="flex min-w-32 flex-1 flex-col gap-1.5">
          <span className="text-xs font-bold text-muted">Tipo</span>
          <select name="k" defaultValue={k} className="min-h-11 w-full rounded-xl border border-edge bg-side px-3 text-sm font-semibold text-text outline-none focus:border-accent">
            <option value="">Todos</option>
            <option value="expense">Despesas</option>
            <option value="income">Receitas</option>
          </select>
        </label>
        <label className="flex min-w-32 flex-1 flex-col gap-1.5">
          <span className="text-xs font-bold text-muted">Status</span>
          <select name="st" defaultValue={st} className="min-h-11 w-full rounded-xl border border-edge bg-side px-3 text-sm font-semibold text-text outline-none focus:border-accent">
            <option value="">Todos</option>
            <option value="paid">Pagos / recebidos</option>
            <option value="sched">Agendados</option>
            <option value="late">Atrasados</option>
          </select>
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[13px] font-semibold text-soft">
          <input type="checkbox" name="all" value="1" defaultChecked={searchAll} className="size-4 accent-[#c8f169]" />
          Todos os meses
        </label>
        <div className="flex gap-2">
          <button type="submit" className="min-h-11 cursor-pointer rounded-xl bg-accent px-5 text-sm font-extrabold text-ink hover:brightness-110">
            Filtrar
          </button>
          {filtered && (
            <a href={`/lancamentos?m=${month}`} className="flex min-h-11 items-center rounded-xl px-4 text-sm font-bold text-muted hover:text-text">
              Limpar
            </a>
          )}
        </div>
        <div className="flex w-full flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted">
          <span>Exportar para Excel:</span>
          <a className="font-bold text-accent-soft hover:underline" href={`/api/export?m=${month}`} download>Este mês (CSV)</a>
          <a className="font-bold text-accent-soft hover:underline" href="/api/export" download>Tudo (CSV)</a>
        </div>
      </form>

      {filtered && (
        <p className="rounded-xl bg-raised px-4 py-3 text-sm text-soft">
          {listTxs.length} {listTxs.length === 1 ? "lançamento" : "lançamentos"}
          {searchAll ? " em todos os meses" : ` em ${month.split("-").reverse().join("/")}`} · receitas{" "}
          <b className="text-income-text">{brl(listSum.income)}</b> · despesas{" "}
          <b className="text-expense-text">{brl(listSum.expense)}</b>
        </p>
      )}

      <section className={`flex flex-wrap rounded-[20px] border border-line bg-surface py-2 ${filtered ? "hidden" : ""}`}>
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
            {filtered ? "Nenhum lançamento encontrado com esses filtros." : "Nenhum lançamento neste mês. Use “Novo lançamento” para começar."}
          </p>
        )}

        <div className="overflow-x-auto">
          <div className="min-w-160">
            {groups.map((g) => (
              <div key={g.date}>
                <div className="flex items-center justify-between border-t border-line bg-side px-5 py-2.5 text-xs font-bold">
                  <span className={g.date === today ? "text-accent-soft" : g.date < today ? "text-muted" : "text-soft"}>
                    {searchAll ? g.date.split("-").reverse().join("/") + " · " : ""}{dayHeading(g.date)}
                    {g.date === today ? " · hoje" : ""}
                  </span>
                  {!filtered && (
                    <span className="font-semibold text-muted">
                      Saldo do dia <b className="ml-1.5 text-text">{brl(g.balance)}</b>
                    </span>
                  )}
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
