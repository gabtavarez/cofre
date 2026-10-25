import { ActionForm, DeleteButton, Field, fieldCls } from "@/components/forms";
import { InlineMoney } from "@/components/InlineMoney";
import { addInvestmentMove, createInvestment, deleteInvestment, setInvestmentValue } from "@/lib/actions";
import { getInvestments, INVESTMENT_KIND_LABEL } from "@/lib/data";
import { brl } from "@/lib/format";

const KIND_COLORS: Record<string, string> = {
  renda_fixa: "#c8f169",
  tesouro: "#38bdf8",
  acoes: "#b9a7ff",
  fiis: "#ffc857",
  cripto: "#ff7a8a",
  outro: "#64748b",
};

const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1).replace(".", ",")}%`;

export default async function Investimentos() {
  const invs = await getInvestments();

  const total = invs.reduce((s, i) => s + i.current_value, 0);
  const invested = invs.reduce((s, i) => s + i.invested, 0);
  const profit = Math.round((total - invested) * 100) / 100;
  const profitPct = invested > 0 ? (profit / invested) * 100 : 0;

  const byKind = new Map<string, number>();
  for (const i of invs) byKind.set(i.kind, (byKind.get(i.kind) ?? 0) + i.current_value);
  const alloc = [...byKind.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <>
      <header className="flex flex-col gap-1">
        <span className="text-[13px] text-muted">Acompanhe o que você tem investido</span>
        <h1 className="text-3xl font-extrabold">Investimentos</h1>
      </header>

      <section className="flex flex-wrap gap-4">
        <div className="flex min-w-55 flex-1 flex-col gap-2.5 rounded-[20px] bg-invest-bg p-5.5">
          <span className="text-[13px] font-bold text-invest-text">Patrimônio investido</span>
          <span className="font-display text-3xl font-extrabold">{brl(total)}</span>
          <span className="text-xs text-muted">Soma do valor atual de tudo</span>
        </div>
        <div className="flex min-w-55 flex-1 flex-col gap-2.5 rounded-[20px] border border-line bg-surface p-5.5">
          <span className="text-[13px] font-bold text-muted">Total aportado</span>
          <span className="font-display text-3xl font-extrabold">{brl(invested)}</span>
          <span className="text-xs text-muted">Aportes menos resgates</span>
        </div>
        <div className="flex min-w-55 flex-1 flex-col gap-2.5 rounded-[20px] border border-line bg-surface p-5.5">
          <span className="text-[13px] font-bold text-muted">Rentabilidade</span>
          <span
            className={`font-display text-3xl font-extrabold ${profit >= 0 ? "text-income-text" : "text-expense-text"}`}
          >
            {brl(profit)}
          </span>
          <span className="text-xs text-muted">{invested > 0 ? pct(profitPct) + " sobre o aportado" : "Sem aportes ainda"}</span>
        </div>
      </section>

      {alloc.length > 0 && total > 0 && (
        <section className="rounded-[20px] border border-line bg-surface p-5.5">
          <h2 className="mb-4 text-base font-bold">Distribuição</h2>
          <div className="flex h-4 overflow-hidden rounded-full bg-raised" role="img" aria-label="Distribuição por tipo">
            {alloc.map(([k, v]) => (
              <div key={k} style={{ width: `${(v / total) * 100}%`, background: KIND_COLORS[k] }} title={`${INVESTMENT_KIND_LABEL[k as keyof typeof INVESTMENT_KIND_LABEL]} ${brl(v)}`} />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
            {alloc.map(([k, v]) => (
              <span key={k} className="flex items-center gap-2 text-soft">
                <span className="size-2.5 rounded-full" style={{ background: KIND_COLORS[k] }} />
                {INVESTMENT_KIND_LABEL[k as keyof typeof INVESTMENT_KIND_LABEL]}{" "}
                <b className="text-text">{Math.round((v / total) * 100)}%</b>
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-[20px] border border-line bg-surface p-5.5">
        <h2 className="mb-4 text-base font-bold">Novo investimento</h2>
        <ActionForm action={createInvestment} submitLabel="Adicionar">
          <Field label="Nome" className="min-w-52 flex-1">
            <input name="name" required placeholder="Ex.: CDB Nubank 110% CDI" className={fieldCls} />
          </Field>
          <Field label="Tipo" className="min-w-48">
            <select name="kind" defaultValue="renda_fixa" className={fieldCls}>
              {Object.entries(INVESTMENT_KIND_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Valor atual (R$)" className="min-w-40">
            <input name="amount" inputMode="decimal" placeholder="0,00" className={fieldCls} />
          </Field>
        </ActionForm>
        <p className="mt-3 text-xs text-muted">
          O valor informado conta como o primeiro aporte. Depois use “Aportar” e “Resgatar”, e atualize o valor atual de tempos em tempos para ver a rentabilidade.
        </p>
      </section>

      {invs.length === 0 && (
        <p className="rounded-[20px] border border-dashed border-edge bg-side p-8 text-center text-sm text-muted">
          Nenhum investimento ainda.
        </p>
      )}

      <section className="flex flex-col gap-4">
        {invs.map((i) => {
          const p = Math.round((i.current_value - i.invested) * 100) / 100;
          const pp = i.invested > 0 ? (p / i.invested) * 100 : 0;
          return (
            <article key={i.id} className="flex flex-col gap-4 rounded-[20px] border border-line bg-surface p-5.5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <b className="truncate text-base">{i.name}</b>
                  <span
                    className="w-fit rounded-full bg-invest-bg px-2.5 py-0.5 text-[11px] font-bold text-invest-text"
                  >
                    {INVESTMENT_KIND_LABEL[i.kind]}
                  </span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex flex-col items-end">
                    <span className="font-display text-xl font-extrabold">{brl(i.current_value)}</span>
                    <span className={`text-xs font-bold ${p >= 0 ? "text-income-text" : "text-expense-text"}`}>
                      {brl(p)} {i.invested > 0 && `(${pct(pp)})`}
                    </span>
                    <span className="text-xs text-muted">aportado {brl(i.invested)}</span>
                  </div>
                  <DeleteButton action={deleteInvestment.bind(null, i.id)} label={`Apagar ${i.name}`} />
                </div>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-3 border-t border-line pt-4">
                <InlineMoney action={addInvestmentMove.bind(null, i.id, false)} label="Aportar" />
                <InlineMoney action={addInvestmentMove.bind(null, i.id, true)} label="Resgatar" tone="muted" />
                <InlineMoney action={setInvestmentValue.bind(null, i.id)} label="Atualizar valor" tone="muted" />
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}
