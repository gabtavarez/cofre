import { ActionForm, DeleteButton, Field, fieldCls } from "@/components/forms";
import { InlineMoney } from "@/components/InlineMoney";
import { createDebt, deleteDebt, payDebt, setDebtBalance } from "@/lib/actions";
import { getDebts } from "@/lib/data";
import { addMonths, todayISO } from "@/lib/dates";
import { brl } from "@/lib/format";

/** Meses para quitar com parcela fixa e juros compostos; null = nunca quita só com essa parcela. */
function monthsToPayoff(balance: number, ratePct: number, payment: number): number | null {
  if (balance <= 0) return 0;
  if (payment <= 0) return null;
  const r = ratePct / 100;
  if (r === 0) return Math.ceil(balance / payment);
  if (payment <= balance * r) return null;
  return Math.ceil(-Math.log(1 - (balance * r) / payment) / Math.log(1 + r));
}

export default async function Dividas() {
  const debts = await getDebts();
  const today = todayISO();

  const totalOwed = debts.reduce((s, d) => s + d.current_balance, 0);
  const totalMonthly = debts.reduce((s, d) => s + (d.current_balance > 0 ? d.monthly_payment : 0), 0);
  const totalOriginal = debts.reduce((s, d) => s + d.original_amount, 0);
  const paidPct = totalOriginal > 0 ? Math.max(0, Math.min(100, ((totalOriginal - totalOwed) / totalOriginal) * 100)) : 0;

  return (
    <>
      <header className="flex flex-col gap-1">
        <span className="text-[13px] text-muted">Saiba quanto deve e quando termina</span>
        <h1 className="text-3xl font-extrabold">Dívidas e empréstimos</h1>
      </header>

      <section className="flex flex-wrap gap-4">
        <div className="flex min-w-55 flex-1 flex-col gap-2.5 rounded-[20px] border border-line bg-surface p-5.5">
          <span className="text-[13px] font-bold text-muted">Total devido</span>
          <span className="font-display text-3xl font-extrabold text-expense-text">{brl(totalOwed)}</span>
          <span className="text-xs text-muted">{debts.length} {debts.length === 1 ? "dívida" : "dívidas"}</span>
        </div>
        <div className="flex min-w-55 flex-1 flex-col gap-2.5 rounded-[20px] border border-line bg-surface p-5.5">
          <span className="text-[13px] font-bold text-muted">Parcelas por mês</span>
          <span className="font-display text-3xl font-extrabold">{brl(totalMonthly)}</span>
          <span className="text-xs text-muted">Soma das parcelas das dívidas em aberto</span>
        </div>
        <div className="flex min-w-55 flex-1 flex-col gap-2.5 rounded-[20px] border border-line bg-surface p-5.5">
          <span className="text-[13px] font-bold text-muted">Já abatido</span>
          <span className="font-display text-3xl font-extrabold text-income-text">{Math.round(paidPct)}%</span>
          <div className="h-2 overflow-hidden rounded-full bg-raised">
            <div className="h-full rounded-full bg-income" style={{ width: `${paidPct}%` }} />
          </div>
        </div>
      </section>

      <section className="rounded-[20px] border border-line bg-surface p-5.5">
        <h2 className="mb-4 text-base font-bold">Nova dívida</h2>
        <ActionForm action={createDebt} submitLabel="Adicionar">
          <Field label="Nome" className="min-w-48 flex-1">
            <input name="name" required placeholder="Ex.: Financiamento do notebook" className={fieldCls} />
          </Field>
          <Field label="Credor (opcional)" className="min-w-40">
            <input name="creditor" placeholder="Ex.: Nubank" className={fieldCls} />
          </Field>
          <Field label="Quanto deve hoje (R$)" className="min-w-44">
            <input name="balance" inputMode="decimal" required placeholder="0,00" className={fieldCls} />
          </Field>
          <Field label="Juros ao mês (%)" className="min-w-32">
            <input name="monthly_rate" inputMode="decimal" placeholder="0" className={fieldCls} />
          </Field>
          <Field label="Parcela mensal (R$)" className="min-w-40">
            <input name="monthly_payment" inputMode="decimal" placeholder="0,00" className={fieldCls} />
          </Field>
        </ActionForm>
        <p className="mt-3 text-xs text-muted">
          Com os juros e a parcela, o app estima em quantos meses a dívida acaba. É uma estimativa: confira o saldo no credor de vez em quando e corrija aqui.
        </p>
      </section>

      {debts.length === 0 && (
        <p className="rounded-[20px] border border-dashed border-edge bg-side p-8 text-center text-sm text-muted">
          Nenhuma dívida cadastrada. Bom sinal, ou é só falta de cadastro.
        </p>
      )}

      <section className="flex flex-col gap-4">
        {debts.map((d) => {
          const n = monthsToPayoff(d.current_balance, d.monthly_rate, d.monthly_payment);
          const done = d.current_balance <= 0;
          const pct = Math.max(0, Math.min(100, ((d.original_amount - d.current_balance) / d.original_amount) * 100));
          const totalPay = n !== null && d.monthly_payment > 0 ? d.monthly_payment * n : null;
          const interest = totalPay !== null ? Math.max(0, totalPay - d.current_balance) : null;
          return (
            <article key={d.id} className="flex flex-col gap-4 rounded-[20px] border border-line bg-surface p-5.5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <b className="truncate text-base">{d.name}</b>
                  <span className="text-xs text-muted">
                    {d.creditor ? `${d.creditor} · ` : ""}
                    {d.monthly_rate > 0 ? `${String(d.monthly_rate).replace(".", ",")}% ao mês` : "sem juros"}
                    {d.monthly_payment > 0 && ` · parcela ${brl(d.monthly_payment)}`}
                  </span>
                </div>
                <div className="flex items-center gap-5">
                  <div className="flex flex-col items-end">
                    <span className={`font-display text-xl font-extrabold ${done ? "text-income-text" : "text-expense-text"}`}>
                      {brl(d.current_balance)}
                    </span>
                    <span className="text-xs text-muted">de {brl(d.original_amount)}</span>
                  </div>
                  <DeleteButton action={deleteDebt.bind(null, d.id)} label={`Apagar ${d.name}`} />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="h-2.5 overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${d.name}: ${Math.round(pct)}% abatido`}>
                  <div className={`h-full rounded-full ${done ? "bg-income" : "bg-accent"}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs font-semibold text-soft">
                  {done
                    ? "Quitada"
                    : n === null
                      ? d.monthly_payment > 0
                        ? "A parcela não cobre nem os juros: a dívida só cresce. Aumente a parcela."
                        : "Informe uma parcela mensal para ver a previsão de quitação."
                      : `Quita em ${n} ${n === 1 ? "mês" : "meses"} (${addMonths(today, n).slice(5, 7)}/${addMonths(today, n).slice(0, 4)})${
                          interest !== null && interest > 0 ? ` · juros estimados ${brl(Math.round(interest * 100) / 100)}` : ""
                        }`}
                </span>
              </div>

              {!done && (
                <div className="flex flex-wrap gap-x-6 gap-y-3 border-t border-line pt-4">
                  <InlineMoney action={payDebt.bind(null, d.id)} label="Registrar pagamento" />
                  <InlineMoney action={setDebtBalance.bind(null, d.id)} label="Corrigir saldo" tone="muted" />
                </div>
              )}
            </article>
          );
        })}
      </section>
    </>
  );
}
