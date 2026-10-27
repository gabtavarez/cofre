import { LearnClient, type Facts } from "@/components/LearnClient";
import { getBalanceRows, getBase, getDebts, getInvestments, getTransactionsBetween } from "@/lib/data";
import { addMonths, monthBounds, resolveMonth, todayISO } from "@/lib/dates";
import { round2 } from "@/lib/finance";

export default async function Aprender() {
  const today = todayISO();
  const month = resolveMonth(undefined);
  const from = monthBounds(addMonths(`${month}-01`, -3).slice(0, 7)).start;
  const to = monthBounds(addMonths(`${month}-01`, 6).slice(0, 7)).end;

  const [{ accounts }, rows, txs, debts, invs] = await Promise.all([
    getBase(),
    getBalanceRows(today),
    getTransactionsBetween(from, to),
    getDebts(),
    getInvestments(),
  ]);

  const initial = accounts.reduce((s, a) => s + a.initial_balance, 0);
  const balance = rows.reduce((s, r) => (r.paid ? s + (r.kind === "income" ? r.amount : -r.amount) : s), initial);
  // média por mês, considerando passado e meses futuros já cadastrados (só meses com lançamentos)
  const byMonth = new Map<string, { inc: number; exp: number }>();
  for (const t of txs) {
    const k = t.date.slice(0, 7);
    const m = byMonth.get(k) ?? { inc: 0, exp: 0 };
    if (t.kind === "income") m.inc += t.amount;
    else m.exp += t.amount;
    byMonth.set(k, m);
  }
  const n = Math.max(1, byMonth.size);
  const inc = [...byMonth.values()].reduce((s, m) => s + m.inc, 0) / n;
  const exp = [...byMonth.values()].reduce((s, m) => s + m.exp, 0) / n;

  const facts: Facts = {
    balance: round2(balance),
    avgExpense: round2(exp),
    avgIncome: round2(inc),
    months: byMonth.size,
    liquidInvested: round2(invs.filter((i) => i.kind === "renda_fixa" || i.kind === "tesouro").reduce((s, i) => s + i.current_value, 0)),
    totalInvested: round2(invs.reduce((s, i) => s + i.current_value, 0)),
    debts: debts
      .filter((d) => d.current_balance > 0)
      .map((d) => ({ name: d.name, balance: d.current_balance, rate: d.monthly_rate })),
  };

  return (
    <>
      <header className="flex flex-col gap-1">
        <span className="text-[13px] text-muted">Do zero, no seu ritmo, com os seus números</span>
        <h1 className="text-3xl font-extrabold">Aprender a investir</h1>
      </header>
      <LearnClient facts={facts} />
    </>
  );
}
