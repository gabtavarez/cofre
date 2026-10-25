import { ActionForm, DeleteButton, Field, fieldCls } from "@/components/forms";
import { InlineMoney } from "@/components/InlineMoney";
import { addGoalMove, createGoal, deleteGoal } from "@/lib/actions";
import { getGoals } from "@/lib/data";
import { daysBetween, todayISO } from "@/lib/dates";
import { brl } from "@/lib/format";

export default async function Metas() {
  const goals = await getGoals();
  const today = todayISO();

  return (
    <>
      <header className="flex flex-col gap-1">
        <span className="text-[13px] text-muted">Guarde dinheiro com um destino</span>
        <h1 className="text-3xl font-extrabold">Metas</h1>
      </header>

      <section className="rounded-[20px] border border-line bg-surface p-5.5">
        <h2 className="mb-4 text-base font-bold">Nova meta</h2>
        <ActionForm action={createGoal} submitLabel="Criar meta">
          <Field label="Nome" className="min-w-52 flex-1">
            <input name="name" required placeholder="Ex.: Reserva de emergência" className={fieldCls} />
          </Field>
          <Field label="Valor da meta (R$)" className="min-w-40">
            <input name="target_amount" inputMode="decimal" required placeholder="10.000,00" className={fieldCls} />
          </Field>
          <Field label="Até quando (opcional)" className="min-w-44">
            <input name="target_date" type="date" className={fieldCls} />
          </Field>
        </ActionForm>
      </section>

      {goals.length === 0 && (
        <p className="rounded-[20px] border border-dashed border-edge bg-side p-8 text-center text-sm text-muted">
          Nenhuma meta ainda. Crie uma acima, como “Reserva de emergência” ou “Viagem”.
        </p>
      )}

      <section className="flex flex-wrap gap-4">
        {goals.map((g) => {
          const pct = Math.min(100, Math.max(0, (g.saved / g.target_amount) * 100));
          const left = Math.max(0, g.target_amount - g.saved);
          const done = g.saved >= g.target_amount;
          let hint: string | null = null;
          if (!done && g.target_date) {
            const days = daysBetween(today, g.target_date);
            if (days <= 0) hint = "Prazo vencido";
            else {
              const months = Math.max(1, Math.ceil(days / 30.4));
              hint = `Guarde ${brl(Math.round((left / months) * 100) / 100)} por mês para chegar a tempo`;
            }
          }
          return (
            <article
              key={g.id}
              className="flex min-w-72 flex-1 basis-96 flex-col gap-4 rounded-[20px] border border-line bg-surface p-5.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <b className="truncate text-base">{g.name}</b>
                  <span className="text-xs text-muted">
                    {g.target_date ? `Até ${g.target_date.split("-").reverse().join("/")}` : "Sem prazo"}
                  </span>
                </div>
                <DeleteButton action={deleteGoal.bind(null, g.id)} label={`Apagar a meta ${g.name}`} />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-display text-2xl font-extrabold">{brl(g.saved)}</span>
                  <span className="text-xs text-muted">de {brl(g.target_amount)}</span>
                </div>
                <div
                  className="h-3 overflow-hidden rounded-full bg-raised"
                  role="progressbar"
                  aria-valuenow={Math.round(pct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${g.name}: ${Math.round(pct)}%`}
                >
                  <div className={`h-full rounded-full ${done ? "bg-income" : "bg-accent"}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-muted">
                  {done ? "Meta batida!" : `${Math.round(pct)}% · faltam ${brl(left)}`}
                </span>
                {hint && <span className="text-xs font-semibold text-soft">{hint}</span>}
              </div>

              <div className="flex flex-wrap gap-3">
                <InlineMoney action={addGoalMove.bind(null, g.id, false)} label="Guardar" />
                <InlineMoney action={addGoalMove.bind(null, g.id, true)} label="Retirar" tone="muted" />
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}
