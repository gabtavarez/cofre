import Link from "next/link";
import { CashflowChart, CategoryDonut, MonthlyBars, type BarMonth } from "@/components/charts";
import { MonthNav } from "@/components/MonthNav";
import { NewTransactionButton } from "@/components/TransactionDialog";
import {
  addDays,
  daysBetween,
  dm,
  monthBounds,
  monthShort,
  resolveMonth,
  shiftMonth,
  todayISO,
} from "@/lib/dates";
import { getBalanceRows, getBase, getCategoryHints, getTransactionsBetween, getUpcoming } from "@/lib/data";
import { getFreeBudget } from "@/lib/free";
import { brl } from "@/lib/format";
import { dailySeries, expenseByCategory, round2, signed, summarize } from "@/lib/finance";

const card = "min-w-0 rounded-[20px] border border-line bg-surface p-5.5";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const today = todayISO();
  const month = resolveMonth(m);
  const { start, end } = monthBounds(month);
  const firstMonth = shiftMonth(month, -5);

  const isCurrentMonth = month === today.slice(0, 7);
  const [base, txs6, balanceRows, upcoming, hints, free] = await Promise.all([
    getBase(),
    getTransactionsBetween(monthBounds(firstMonth).start, end),
    getBalanceRows(end > today ? end : today),
    getUpcoming(addDays(today, 60), 5),
    getCategoryHints(),
    isCurrentMonth ? getFreeBudget(month) : Promise.resolve(null),
  ]);

  const { accounts, categories } = base;
  const monthTxs = txs6.filter((t) => t.date >= start);
  const sum = summarize(monthTxs);
  const initialTotal = accounts.reduce((s, a) => s + a.initial_balance, 0);
  const series = dailySeries(balanceRows, initialTotal, month, today);

  // categorias
  const slices = expenseByCategory(monthTxs);
  const sliceTotal = slices.reduce((s, x) => s + x.value, 0);

  // barras dos últimos 6 meses
  const bars: BarMonth[] = Array.from({ length: 6 }, (_, i) => {
    const mo = shiftMonth(month, i - 5);
    const rows = txs6.filter((t) => t.date.startsWith(mo));
    const s = summarize(rows);
    return { label: monthShort(mo), income: s.income, expense: s.expense, current: mo === month };
  });

  // saldo por conta (pagos até hoje)
  const balances = new Map<string, number>(accounts.map((a) => [a.id, a.initial_balance]));
  for (const r of balanceRows) {
    if (r.paid && r.date <= today) balances.set(r.account_id, (balances.get(r.account_id) ?? 0) + signed(r));
  }
  const totalAccounts = [...balances.values()].reduce((s, v) => s + v, 0);

  // limites
  const spentByCat = new Map<string, number>();
  for (const t of monthTxs) {
    if (t.kind === "expense" && t.category_id) {
      spentByCat.set(t.category_id, (spentByCat.get(t.category_id) ?? 0) + t.amount);
    }
  }
  const limits = categories
    .filter((c) => c.kind === "expense" && c.monthly_limit)
    .map((c) => {
      const spent = round2(spentByCat.get(c.id) ?? 0);
      return { name: c.name, spent, limit: c.monthly_limit as number, pct: spent / (c.monthly_limit as number) };
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5);

  const saved = sum.income > 0 ? Math.round((sum.result / sum.income) * 100) : null;
  const monthIsCurrent = month === today.slice(0, 7);
  // verba "sem remorso" por dia: o que sobra depois de compromissos, poupança e colchão
  const freePerDay = free && free.daysLeft > 0 && free.left > 0 ? round2(free.left / free.daysLeft) : 0;

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-muted">
            {monthIsCurrent ? "Hoje, " + dm(today) : "Visualizando outro mês"}
          </span>
          <h1 className="font-display text-3xl font-extrabold">Visão geral</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MonthNav month={month} basePath="/" />
          <NewTransactionButton accounts={accounts} categories={categories} today={today} hints={hints} />
        </div>
      </header>

      {accounts.length === 0 && (
        <div className="rounded-[20px] border border-dashed border-edge bg-side p-6 text-sm text-soft">
          Comece criando sua primeira conta em{" "}
          <Link href="/contas" className="font-bold text-accent-soft underline">
            Contas
          </Link>{" "}
          (por exemplo, seu banco com o saldo de hoje). Depois é só lançar receitas e despesas.
        </div>
      )}

      {/* KPIs */}
      <section className="flex flex-wrap gap-4">
        <div className="flex min-w-55 flex-1 flex-col gap-2.5 rounded-[20px] bg-accent p-5.5 text-ink">
          <span className="text-[13px] font-bold">Saldo atual</span>
          <span className="font-display text-3xl font-extrabold">{brl(series.currentBalance)}</span>
          <span className="text-xs font-semibold">
            Projetado p/ fim do mês: <b>{brl(series.endBalance)}</b>
          </span>
          {monthIsCurrent && free && (
            <Link href="/sem-remorso" className="mt-1 flex flex-col gap-1 rounded-xl bg-ink/10 px-3 py-2 text-xs font-bold hover:bg-ink/15">
              {free.income + free.opening === 0 ? (
                <span>Cadastre as receitas do mês para calcular quanto você pode gastar sem remorso</span>
              ) : free.left <= 0 ? (
                <span>
                  {free.budget === 0 ? "Sem verba livre neste mês" : `Verba sem remorso estourada em ${brl(Math.abs(free.left))}`}
                </span>
              ) : (
                <span>
                  Sem remorso: {brl(freePerDay)} por dia · {brl(free.left)} no mês
                </span>
              )}
              {free.income + free.opening > 0 && (
                <span className="font-semibold opacity-80">
                  Já separado: {brl(free.reserved)} de poupança e colchão
                </span>
              )}
            </Link>
          )}
        </div>
        <div className={`${card} flex min-w-55 flex-1 flex-col gap-2.5`}>
          <span className="text-[13px] font-semibold text-muted">Receitas do mês</span>
          <span className="font-display text-3xl font-extrabold text-income-text">{brl(sum.income)}</span>
          <span className="text-xs text-muted">
            Recebido {brl(sum.incomePaid)} · a receber {brl(round2(sum.income - sum.incomePaid))}
          </span>
        </div>
        <div className={`${card} flex min-w-55 flex-1 flex-col gap-2.5`}>
          <span className="text-[13px] font-semibold text-muted">Despesas do mês</span>
          <span className="font-display text-3xl font-extrabold text-expense-text">{brl(sum.expense)}</span>
          <span className="text-xs text-muted">
            Pago {brl(sum.expensePaid)} · a pagar <b className="text-expense-text">{brl(sum.expenseOpen)}</b>
          </span>
        </div>
        <div className={`${card} flex min-w-55 flex-1 flex-col gap-2.5`}>
          <span className="text-[13px] font-semibold text-muted">Resultado</span>
          <span className="font-display text-3xl font-extrabold">{brl(sum.result)}</span>
          {saved !== null ? (
            <span
              className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-bold ${
                saved >= 0 ? "bg-income-bg text-income-text" : "bg-expense-bg text-expense-text"
              }`}
            >
              {saved >= 0 ? `${saved}% da receita guardada` : `gastou ${Math.abs(saved)}% além da receita`}
            </span>
          ) : (
            <span className="text-xs text-muted">Sem receitas lançadas</span>
          )}
        </div>
      </section>

      {/* Fluxo + categorias */}
      <section className="flex flex-wrap gap-4">
        <div className={`${card} flex min-w-80 flex-[2_1_520px] flex-col gap-4`}>
          <div className="flex flex-wrap justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-bold">Fluxo de caixa</h2>
              <span className="text-xs text-muted">Saldo diário, com projeção até o fim do mês</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted">
              <span className="inline-flex items-center gap-2">
                <span className="h-0.75 w-4.5 rounded-sm bg-accent" />
                Realizado
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-0 w-4.5 border-t-3 border-dashed border-accent" />
                Projetado
              </span>
            </div>
          </div>
          <CashflowChart series={series} />
        </div>

        <div className={`${card} flex min-w-75 flex-[1_1_320px] flex-col gap-4`}>
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-bold">Despesas por categoria</h2>
            <span className="text-xs text-muted">Pagas e a pagar no mês</span>
          </div>
          {slices.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">Nenhuma despesa neste mês.</p>
          ) : (
            <>
              <CategoryDonut slices={slices} total={sliceTotal} />
            </>
          )}
        </div>
      </section>

      {/* Barras + vencimentos + contas */}
      <section className="flex flex-wrap gap-4">
        <div className={`${card} flex min-w-80 flex-[1_1_340px] flex-col gap-4`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-bold">Receitas × despesas</h2>
              <span className="text-xs text-muted">Últimos 6 meses</span>
            </div>
            <div className="flex flex-col gap-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-xs bg-income" />
                Receitas
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-xs bg-expense" />
                Despesas
              </span>
            </div>
          </div>
          <MonthlyBars data={bars} />
        </div>

        <div className={`${card} flex min-w-80 flex-[1_1_340px] flex-col`}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-bold">Próximos vencimentos</h2>
            <Link href="/lancamentos" className="text-[13px] font-bold text-accent-soft hover:underline">
              Ver todos
            </Link>
          </div>
          {upcoming.length === 0 && <p className="py-8 text-center text-sm text-muted">Nada pendente. 🎉</p>}
          {upcoming.map((t) => {
            const late = t.date < today;
            const diff = daysBetween(today, t.date);
            const [, mo, da] = t.date.split("-");
            return (
              <div key={t.id} className="flex items-center gap-3.5 border-t border-line py-3">
                <div
                  className={`flex h-12.5 w-11.5 flex-col items-center justify-center rounded-xl leading-tight ${
                    late ? "bg-expense-bg text-expense-text" : "bg-raised text-text"
                  }`}
                >
                  <b className="text-[17px]">{da}</b>
                  <span className={`text-[11px] font-bold ${late ? "" : "text-muted"}`}>
                    {monthShort(`2000-${mo}`).toUpperCase()}
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <b className="truncate text-sm">
                    {t.description}
                    {t.installments_total ? ` ${t.installment_no}/${t.installments_total}` : ""}
                  </b>
                  <span className={`text-xs ${late ? "text-expense-text" : "text-muted"}`}>
                    {late ? `Vencida há ${-diff} ${-diff === 1 ? "dia" : "dias"}` : diff === 0 ? "Vence hoje" : `em ${diff} ${diff === 1 ? "dia" : "dias"}`}
                    {t.category ? ` · ${t.category.name}` : ""}
                  </span>
                </div>
                <b className={`text-sm ${t.kind === "income" ? "text-income-text" : ""}`}>
                  {t.kind === "income" ? "+" : ""}
                  {brl(t.amount)}
                </b>
              </div>
            );
          })}
        </div>

        <div className={`${card} flex min-w-75 flex-[1_1_300px] flex-col`}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-bold">Contas</h2>
            <span className="text-[13px] text-muted">
              Total <b className="text-text">{brl(totalAccounts)}</b>
            </span>
          </div>
          {accounts.map((a) => (
            <div key={a.id} className="flex items-center gap-3.5 border-t border-line py-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-edge font-extrabold text-accent-soft">
                {a.name.slice(0, 1).toUpperCase()}
              </span>
              <b className="flex-1 truncate text-sm">{a.name}</b>
              <b className="text-sm">{brl(balances.get(a.id) ?? 0)}</b>
            </div>
          ))}
          <Link
            href="/contas"
            className="mt-2 flex min-h-11 items-center justify-center rounded-xl border border-dashed border-edge text-[13px] font-bold text-accent-soft hover:bg-raised"
          >
            + Adicionar conta
          </Link>
        </div>
      </section>

      {/* Limites + investimentos */}
      <section className="flex flex-wrap gap-4">
        <div className={`${card} flex min-w-80 flex-[1_1_420px] flex-col gap-4.5`}>
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-bold">Limites de gastos</h2>
              <span className="text-xs text-muted">Quanto já usou de cada categoria no mês</span>
            </div>
            <Link href="/categorias" className="text-[13px] font-bold text-accent-soft hover:underline">
              Editar
            </Link>
          </div>
          {limits.length === 0 && (
            <p className="text-sm text-muted">
              Defina um limite mensal nas categorias para acompanhar aqui.
            </p>
          )}
          {limits.map((l) => {
            const color = l.pct > 1 ? "bg-expense" : l.pct >= 0.85 ? "bg-warn" : "bg-accent";
            const text = l.pct > 1 ? "text-expense-text" : l.pct >= 0.85 ? "text-warn-text" : "text-muted";
            return (
              <div key={l.name} className="flex flex-col gap-2">
                <div className="flex justify-between text-[13px]">
                  <b>{l.name}</b>
                  <span className={text}>
                    {brl(l.spent)} / {brl(l.limit)} · {Math.round(l.pct * 100)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-raised">
                  <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(l.pct, 1) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex min-w-80 flex-[1_1_420px] flex-col gap-4 rounded-[20px] border-[1.5px] border-dashed border-edge bg-side p-5.5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Investimentos</h2>
            <span className="rounded-full bg-accent-bg px-2.5 py-0.5 text-[11px] font-bold text-accent-soft">Em breve</span>
          </div>
          <p className="text-[13px] leading-relaxed text-muted">
            Aportes mensais, rentabilidade e alocação por classe de ativo, lado a lado com as suas contas.
          </p>
          <div className="flex flex-wrap gap-2">
            {["Renda fixa", "Ações e FIIs", "Cripto", "Aportes"].map((c) => (
              <span key={c} className="rounded-full bg-invest-bg px-3 py-1.5 text-xs font-bold text-invest-text">
                {c}
              </span>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
