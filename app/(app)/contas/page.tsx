import { AdjustBalanceButton } from "@/components/AdjustBalanceButton";
import { ActionForm, DeleteButton, Field, fieldCls } from "@/components/forms";
import { createAccount, deleteAccount } from "@/lib/actions";
import { getBalanceRows, getBase } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { brl } from "@/lib/format";
import { signed } from "@/lib/finance";
import { ACCOUNT_KIND_LABEL } from "@/lib/types";

export default async function Contas() {
  const today = todayISO();
  const [{ accounts, categories }, rows] = await Promise.all([getBase(), getBalanceRows(today)]);

  const balances = new Map<string, number>(accounts.map((a) => [a.id, a.initial_balance]));
  for (const r of rows) {
    if (r.paid) balances.set(r.account_id, (balances.get(r.account_id) ?? 0) + signed(r));
  }
  const total = [...balances.values()].reduce((s, v) => s + v, 0);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight">Contas</h1>
        <span className="text-sm text-muted">
          Total <b className="text-text">{brl(total)}</b>
        </span>
      </header>

      <section className="rounded-[20px] border border-line bg-surface p-5.5">
        <h2 className="mb-4 text-base font-bold">Nova conta</h2>
        <ActionForm action={createAccount} submitLabel="Adicionar">
          <Field label="Nome" className="min-w-52 flex-1">
            <input name="name" required placeholder="Ex.: Nubank" className={fieldCls} />
          </Field>
          <Field label="Tipo" className="min-w-48">
            <select name="kind" defaultValue="checking" className={fieldCls}>
              {Object.entries(ACCOUNT_KIND_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Saldo hoje (R$)" className="min-w-40">
            <input name="initial_balance" inputMode="decimal" placeholder="0,00" className={fieldCls} />
          </Field>
        </ActionForm>
        <p className="mt-3 text-xs text-muted">
          O saldo informado é o ponto de partida: os lançamentos pagos somam e subtraem a partir dele.
        </p>
      </section>

      <section className="overflow-hidden rounded-[20px] border border-line bg-surface">
        {accounts.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted">Nenhuma conta ainda.</p>}
        {accounts.map((a, i) => (
          <div key={a.id} className={`flex items-center gap-4 px-5 py-3.5 ${i > 0 ? "border-t border-line" : ""}`}>
            <span className="flex size-10 items-center justify-center rounded-xl bg-edge font-extrabold text-accent-soft">
              {a.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <b className="truncate text-sm">{a.name}</b>
              <span className="text-xs text-muted">{ACCOUNT_KIND_LABEL[a.kind]}</span>
            </div>
            <b className="text-sm">{brl(balances.get(a.id) ?? 0)}</b>
            <AdjustBalanceButton
              accountId={a.id}
              accountName={a.name}
              initial={a.initial_balance}
              paid={rows.filter((r) => r.paid && r.account_id === a.id).map((r) => [r.date, signed(r)])}
              categories={categories}
              today={today}
            />
            <DeleteButton action={deleteAccount.bind(null, a.id)} label={`Apagar a conta ${a.name}`} />
          </div>
        ))}
      </section>
    </>
  );
}
