import { MonthlyBars, type BarMonth } from "@/components/charts";
import { getTransactionsBetween } from "@/lib/data";
import { monthBounds, monthLabel, monthShort, resolveMonth, shiftMonth } from "@/lib/dates";
import { MonthNav } from "@/components/MonthNav";
import { brl, normalizeDesc } from "@/lib/format";
import { round2, summarize } from "@/lib/finance";

const card = "min-w-0 rounded-[20px] border border-line bg-surface p-5.5";

function Delta({ cur, prev, goodWhenUp }: { cur: number; prev: number | null; goodWhenUp: boolean }) {
  if (prev === null || prev === 0) return <span className="text-xs text-muted">—</span>;
  const d = ((cur - prev) / Math.abs(prev)) * 100;
  const up = d >= 0;
  const good = up === goodWhenUp;
  return (
    <span className={`text-xs font-bold ${Math.abs(d) < 0.5 ? "text-muted" : good ? "text-income-text" : "text-expense-text"}`}>
      {up ? "▲" : "▼"} {Math.abs(d).toFixed(0)}%
    </span>
  );
}

export default async function Relatorios({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const month = resolveMonth(m); // último mês do período
  const first = shiftMonth(month, -11);
  const txs = await getTransactionsBetween(monthBounds(first).start, monthBounds(month).end);

  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(first, i));
  const perMonth = months.map((mo) => {
    const rows = txs.filter((t) => t.date.startsWith(mo));
    return { mo, ...summarize(rows) };
  });

  const bars: BarMonth[] = perMonth.map((p) => ({
    label: monthShort(p.mo),
    income: p.income,
    expense: p.expense,
    current: p.mo === month,
  }));

  const totalIncome = round2(perMonth.reduce((s, p) => s + p.income, 0));
  const totalExpense = round2(perMonth.reduce((s, p) => s + p.expense, 0));
  const result = round2(totalIncome - totalExpense);
  const avgExpense = round2(totalExpense / 12);
  const withData = perMonth.filter((p) => p.income > 0 || p.expense > 0);
  const worst = withData.length ? withData.reduce((a, b) => (b.expense > a.expense ? b : a)) : null;
  const best = withData.length ? withData.reduce((a, b) => (b.result > a.result ? b : a)) : null;

  // categorias: top 6 por gasto total, últimos 6 meses
  const last6 = months.slice(-6);
  const catTotals = new Map<string, Map<string, number>>();
  for (const t of txs) {
    if (t.kind !== "expense") continue;
    const mo = t.date.slice(0, 7);
    if (!last6.includes(mo)) continue;
    const name = t.category?.name ?? "Sem categoria";
    const row = catTotals.get(name) ?? new Map<string, number>();
    row.set(mo, (row.get(mo) ?? 0) + t.amount);
    catTotals.set(name, row);
  }
  const cats = [...catTotals.entries()]
    .map(([name, row]) => ({
      name,
      row,
      total: round2([...row.values()].reduce((s, v) => s + v, 0)),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
  const catMax = Math.max(1, ...cats.flatMap((c) => [...c.row.values()]));

  // assinaturas / gastos recorrentes: fixas, ou a mesma despesa em 3+ meses com valor parecido
  const groups = new Map<string, { name: string; months: Set<string>; amounts: number[]; fixed: boolean; lastDate: string }>();
  for (const t of txs) {
    if (t.kind !== "expense" || t.repeat === "installment" || t.description === "Ajuste de saldo") continue;
    const key = normalizeDesc(t.description);
    if (!key) continue;
    const g = groups.get(key) ?? { name: t.description, months: new Set<string>(), amounts: [], fixed: false, lastDate: "" };
    g.months.add(t.date.slice(0, 7));
    g.amounts.push(t.amount);
    if (t.repeat === "fixed" || t.repeat === "yearly") g.fixed = true;
    if (t.date >= g.lastDate) {
      g.lastDate = t.date;
      g.name = t.description;
    }
    groups.set(key, g);
  }
  const subs = [...groups.values()]
    .filter((g) => {
      if (g.fixed) return true;
      if (g.months.size < 3) return false;
      const min = Math.min(...g.amounts);
      const max = Math.max(...g.amounts);
      return max <= min * 1.15;
    })
    .map((g) => {
      const monthly = round2(g.amounts.reduce((s, v) => s + v, 0) / g.amounts.length);
      return { name: g.name, monthly, yearly: round2(monthly * 12), fixed: g.fixed };
    })
    .sort((a, b) => b.monthly - a.monthly);
  const subsMonthly = round2(subs.reduce((s, x) => s + x.monthly, 0));

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-muted">
            12 meses até {monthLabel(month)}
          </span>
          <h1 className="text-3xl font-extrabold">Relatórios</h1>
        </div>
        <MonthNav month={month} basePath="/relatorios" />
      </header>

      <section className="flex flex-wrap gap-4">
        <div className={`${card} flex min-w-55 flex-1 flex-col gap-2.5`}>
          <span className="text-[13px] font-semibold text-muted">Receitas no período</span>
          <span className="font-display text-3xl font-extrabold text-income-text">{brl(totalIncome)}</span>
        </div>
        <div className={`${card} flex min-w-55 flex-1 flex-col gap-2.5`}>
          <span className="text-[13px] font-semibold text-muted">Despesas no período</span>
          <span className="font-display text-3xl font-extrabold text-expense-text">{brl(totalExpense)}</span>
          <span className="text-xs text-muted">Média {brl(avgExpense)} por mês</span>
        </div>
        <div className={`${card} flex min-w-55 flex-1 flex-col gap-2.5`}>
          <span className="text-[13px] font-semibold text-muted">Resultado</span>
          <span className={`font-display text-3xl font-extrabold ${result >= 0 ? "text-income-text" : "text-expense-text"}`}>
            {brl(result)}
          </span>
          {best && worst && (
            <span className="text-xs text-muted">
              Melhor mês {monthShort(best.mo)} · mais gasto {monthShort(worst.mo)}
            </span>
          )}
        </div>
      </section>

      <section className={`${card} flex flex-col gap-4 overflow-x-auto`}>
        <h2 className="text-base font-bold">Mês a mês</h2>
        <div className="min-w-130">
          <MonthlyBars data={bars} />
        </div>
      </section>

      <section className={`${card} overflow-x-auto`}>
        <h2 className="mb-3 text-base font-bold">Comparativo mensal</h2>
        <table className="w-full min-w-150 text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-2 font-bold">Mês</th>
              <th className="py-2 text-right font-bold">Receitas</th>
              <th className="py-2 text-right font-bold">Despesas</th>
              <th className="py-2 text-right font-bold">vs mês anterior</th>
              <th className="py-2 text-right font-bold">Resultado</th>
              <th className="py-2 text-right font-bold">Guardado</th>
            </tr>
          </thead>
          <tbody>
            {[...perMonth].reverse().map((p, idx, arr) => {
              const prev = arr[idx + 1] ?? null;
              const saved = p.income > 0 ? Math.round((p.result / p.income) * 100) : null;
              return (
                <tr key={p.mo} className="border-t border-line">
                  <td className="py-3 font-bold">{monthLabel(p.mo)}</td>
                  <td className="py-3 text-right text-income-text">{brl(p.income)}</td>
                  <td className="py-3 text-right text-expense-text">{brl(p.expense)}</td>
                  <td className="py-3 text-right">
                    <Delta cur={p.expense} prev={prev ? prev.expense : null} goodWhenUp={false} />
                  </td>
                  <td className={`py-3 text-right font-bold ${p.result >= 0 ? "" : "text-expense-text"}`}>{brl(p.result)}</td>
                  <td className="py-3 text-right text-muted">{saved === null ? "—" : `${saved}%`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className={card}>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-bold">Assinaturas e gastos recorrentes</h2>
          {subs.length > 0 && (
            <span className="text-xs text-muted">
              Total <b className="text-text">{brl(subsMonthly)}</b> por mês · <b className="text-text">{brl(round2(subsMonthly * 12))}</b> por ano
            </span>
          )}
        </div>
        {subs.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">
            Nada recorrente detectado ainda. Lançamentos fixos e despesas que se repetem todo mês aparecem aqui.
          </p>
        ) : (
          subs.map((x, i) => (
            <div key={x.name} className={`flex items-center gap-4 py-3 ${i > 0 ? "border-t border-line" : ""}`}>
              <b className="min-w-0 flex-1 truncate text-sm">{x.name}</b>
              <span className="hidden text-xs text-muted sm:block">{x.fixed ? "Fixa" : "Detectada"}</span>
              <span className="w-28 text-right text-sm text-expense-text">{brl(x.monthly)}<span className="text-xs text-muted">/mês</span></span>
              <span className="hidden w-32 text-right text-xs text-muted md:block">{brl(x.yearly)} por ano</span>
            </div>
          ))
        )}
      </section>

      <section className={`${card} overflow-x-auto`}>
        <h2 className="mb-1 text-base font-bold">Gastos por categoria</h2>
        <p className="mb-4 text-xs text-muted">Últimos 6 meses, as {cats.length || 0} categorias que mais pesaram</p>
        {cats.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Sem despesas no período.</p>
        ) : (
          <table className="w-full min-w-150 text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-2 font-bold">Categoria</th>
                {last6.map((mo) => (
                  <th key={mo} className="py-2 text-right font-bold">
                    {monthShort(mo)}
                  </th>
                ))}
                <th className="py-2 text-right font-bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {cats.map((c) => (
                <tr key={c.name} className="border-t border-line">
                  <td className="py-3 font-bold">{c.name}</td>
                  {last6.map((mo) => {
                    const v = c.row.get(mo) ?? 0;
                    const a = v / catMax;
                    return (
                      <td key={mo} className="py-3 text-right">
                        <span
                          className="inline-block rounded-md px-2 py-0.5"
                          style={{ background: v > 0 ? `rgba(255,122,138,${(0.08 + a * 0.3).toFixed(2)})` : "transparent" }}
                        >
                          {v > 0 ? brl(round2(v)) : "—"}
                        </span>
                      </td>
                    );
                  })}
                  <td className="py-3 text-right font-extrabold">{brl(c.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
