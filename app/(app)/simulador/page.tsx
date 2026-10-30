"use client";

import { useMemo, useState } from "react";
import { ChartHover } from "@/components/ChartHover";
import { fieldCls } from "@/components/forms";
import { brl, parseBRL } from "@/lib/format";

const num = (s: string, fallback = 0) => {
  const n = parseBRL(s);
  return Number.isFinite(n) ? n : fallback;
};

export default function Simulador() {
  const [initial, setInitial] = useState("1.000,00");
  const [monthly, setMonthly] = useState("300,00");
  const [rate, setRate] = useState("12");
  const [per, setPer] = useState<"year" | "month">("year");
  const [years, setYears] = useState("10");
  const [goal, setGoal] = useState("");
  const [income, setIncome] = useState("10.000,00");
  const [incomeRate, setIncomeRate] = useState("8");

  const sim = useMemo(() => {
    const p0 = num(initial);
    const pm = num(monthly);
    const rr = Number(rate.replace(",", ".")) / 100;
    const n = Math.max(1, Math.min(60, Math.round(Number(years) || 0))) * 12;
    const i = !Number.isFinite(rr) || rr < 0 ? 0 : per === "year" ? Math.pow(1 + rr, 1 / 12) - 1 : rr;

    const points: { m: number; total: number; invested: number }[] = [{ m: 0, total: p0, invested: p0 }];
    let bal = p0;
    for (let m = 1; m <= n; m++) {
      bal = bal * (1 + i) + pm;
      points.push({ m, total: bal, invested: p0 + pm * m });
    }
    const last = points[points.length - 1];

    // aporte mensal necessário para chegar ao objetivo
    const g = goal ? num(goal, NaN) : NaN;
    let need: number | null = null;
    if (Number.isFinite(g) && g > 0) {
      const growth = Math.pow(1 + i, n);
      const fvInitial = p0 * growth;
      const factor = i === 0 ? n : (growth - 1) / i;
      need = Math.max(0, (g - fvInitial) / factor);
    }

    // renda mensal desejada: patrimônio que rende X por mês sem gastar o principal
    const inc = num(income, NaN);
    const ir = Number(incomeRate.replace(",", ".")) / 100;
    const im = Number.isFinite(ir) && ir > 0 ? Math.pow(1 + ir, 1 / 12) - 1 : 0;
    let rent: { capital: number; monthly: number; fromInitial: number } | null = null;
    if (Number.isFinite(inc) && inc > 0 && im > 0) {
      const capital = inc / im;
      const growth = Math.pow(1 + i, n);
      const fromInitial = p0 * growth;
      const factor = i === 0 ? n : (growth - 1) / i;
      rent = { capital, fromInitial, monthly: Math.max(0, (capital - fromInitial) / factor) };
    }
    return { points, last, n, i, need, rent };
  }, [initial, monthly, rate, per, years, goal, income, incomeRate]);

  const { points, last } = sim;
  const profit = last.total - last.invested;
  const years12 = points.filter((p) => p.m > 0 && p.m % 12 === 0);

  // gráfico
  const W = 640, H = 220, pad = 8;
  const max = Math.max(...points.map((p) => p.total), 1);
  const x = (m: number) => pad + (m / sim.n) * (W - pad * 2);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const line = (key: "total" | "invested") => points.map((p, k) => `${k ? "L" : "M"}${x(p.m).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(" ");

  return (
    <>
      <header className="flex flex-col gap-1">
        <span className="text-[13px] text-muted">Veja o que os juros compostos fazem pelo seu dinheiro</span>
        <h1 className="text-3xl font-extrabold">Simulador de juros compostos</h1>
      </header>

      <section className="grid gap-4 rounded-[20px] border border-line bg-surface p-5.5 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-muted">Valor inicial (R$)</span>
          <input inputMode="decimal" value={initial} onChange={(e) => setInitial(e.target.value)} className={fieldCls} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-muted">Aporte mensal (R$)</span>
          <input inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} className={fieldCls} />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-muted">Rentabilidade (%)</span>
          <div className="flex gap-2">
            <input inputMode="decimal" aria-label="Rentabilidade" value={rate} onChange={(e) => setRate(e.target.value)} className={`${fieldCls} w-24`} />
            <select value={per} onChange={(e) => setPer(e.target.value as "year" | "month")} className={fieldCls} aria-label="Período da taxa">
              <option value="year">ao ano</option>
              <option value="month">ao mês</option>
            </select>
          </div>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-muted">Prazo (anos)</span>
          <input type="number" min={1} max={60} value={years} onChange={(e) => setYears(e.target.value)} className={fieldCls} />
        </label>
      </section>

      <section className="flex flex-wrap gap-4">
        <div className="flex min-w-55 flex-1 flex-col gap-2.5 rounded-[20px] bg-accent p-5.5 text-ink">
          <span className="text-[13px] font-bold">Valor final</span>
          <span className="font-display text-3xl font-extrabold">{brl(Math.round(last.total * 100) / 100)}</span>
          <span className="text-xs font-semibold">em {sim.n / 12} {sim.n / 12 === 1 ? "ano" : "anos"}</span>
        </div>
        <div className="flex min-w-55 flex-1 flex-col gap-2.5 rounded-[20px] border border-line bg-surface p-5.5">
          <span className="text-[13px] font-bold text-muted">Total investido</span>
          <span className="font-display text-3xl font-extrabold">{brl(Math.round(last.invested * 100) / 100)}</span>
        </div>
        <div className="flex min-w-55 flex-1 flex-col gap-2.5 rounded-[20px] border border-line bg-surface p-5.5">
          <span className="text-[13px] font-bold text-muted">Ganho com juros</span>
          <span className="font-display text-3xl font-extrabold text-income-text">{brl(Math.round(profit * 100) / 100)}</span>
          <span className="text-xs text-muted">
            {last.invested > 0 ? `${Math.round((profit / last.invested) * 100)}% sobre o investido` : ""}
          </span>
        </div>
      </section>

      <section className="min-w-0 rounded-[20px] border border-line bg-surface p-5.5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold">Evolução</h2>
          <span className="flex items-center gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-accent" /> Com juros</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed border-muted" /> Só o que você guardou</span>
          </span>
        </div>
        <ChartHover
          W={W}
          H={H}
          top={pad}
          bottom={H - pad}
          label="Gráfico da evolução do patrimônio ao longo do prazo"
          pts={points.map((p) => ({
            x: x(p.m),
            title: p.m === 0 ? "Início" : `${Math.floor(p.m / 12) ? `${Math.floor(p.m / 12)} ${Math.floor(p.m / 12) === 1 ? "ano" : "anos"}` : ""}${p.m % 12 && Math.floor(p.m / 12) ? " e " : ""}${p.m % 12 ? `${p.m % 12} ${p.m % 12 === 1 ? "mês" : "meses"}` : ""}`,
            rows: [
              { name: "Com juros", value: brl(Math.round(p.total * 100) / 100), y: y(p.total), color: "var(--color-accent)" },
              { name: "Guardado", value: brl(Math.round(p.invested * 100) / 100), y: y(p.invested), color: "var(--color-muted)" },
            ],
          }))}
        >
          <path d={`${line("total")} L${x(sim.n)} ${H - pad} L${x(0)} ${H - pad} Z`} fill="var(--color-accent)" fillOpacity="0.12" />
          <path d={line("invested")} fill="none" stroke="var(--color-muted)" strokeWidth="2" strokeDasharray="5 6" />
          <path d={line("total")} fill="none" stroke="var(--color-accent)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </ChartHover>
      </section>

      <section className="rounded-[20px] border border-line bg-surface p-5.5">
        <h2 className="mb-1 text-base font-bold">Quanto guardar para chegar lá?</h2>
        <p className="mb-4 text-xs text-muted">Informe um objetivo e veja o aporte mensal necessário com os dados acima.</p>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex min-w-48 flex-col gap-1.5">
            <span className="text-xs font-bold text-muted">Objetivo (R$)</span>
            <input inputMode="decimal" placeholder="100.000,00" value={goal} onChange={(e) => setGoal(e.target.value)} className={fieldCls} />
          </label>
          {sim.need !== null && (
            <p className="pb-3 text-sm text-soft">
              Para chegar a <b className="text-text">{brl(num(goal))}</b> em {sim.n / 12} anos, guarde{" "}
              <b className="text-accent-soft">{brl(Math.ceil(sim.need * 100) / 100)}</b> por mês.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-[20px] border border-line bg-surface p-5.5">
        <h2 className="mb-1 text-base font-bold">Quanto investir para viver de renda?</h2>
        <p className="mb-4 text-xs text-muted">
          Informe a renda mensal que você quer receber só com os rendimentos (sem gastar o patrimônio). Usa o valor inicial, a rentabilidade e o prazo acima para a fase de acumulação.
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex min-w-48 flex-col gap-1.5">
            <span className="text-xs font-bold text-muted">Renda mensal desejada (R$)</span>
            <input inputMode="decimal" value={income} onChange={(e) => setIncome(e.target.value)} className={fieldCls} />
          </label>
          <label className="flex min-w-48 flex-col gap-1.5">
            <span className="text-xs font-bold text-muted">Rentabilidade depois (% ao ano)</span>
            <input inputMode="decimal" value={incomeRate} onChange={(e) => setIncomeRate(e.target.value)} className={fieldCls} />
          </label>
        </div>
        {sim.rent && (
          <div className="mt-5 flex flex-wrap gap-4">
            <div className="flex min-w-55 flex-1 flex-col gap-1.5 rounded-2xl bg-accent-bg p-4">
              <span className="text-xs font-bold text-muted">Patrimônio necessário</span>
              <b className="font-display text-2xl text-accent-soft">{brl(Math.ceil(sim.rent.capital))}</b>
              <span className="text-xs text-muted">rendendo {incomeRate}% ao ano</span>
            </div>
            <div className="flex min-w-55 flex-1 flex-col gap-1.5 rounded-2xl bg-raised p-4">
              <span className="text-xs font-bold text-muted">Aporte mensal necessário</span>
              <b className="font-display text-2xl">{brl(Math.ceil(sim.rent.monthly * 100) / 100)}</b>
              <span className="text-xs text-muted">por {sim.n / 12} {sim.n / 12 === 1 ? "ano" : "anos"}</span>
            </div>
            <p className="w-full text-xs text-muted">
              {sim.rent.monthly === 0
                ? "Seu valor inicial já chega lá no prazo, sem novos aportes. "
                : ""}
              Dica: use uma rentabilidade perto do que passa a inflação (rendimento “real”) para o valor de hoje não perder poder de compra.
            </p>
          </div>
        )}
      </section>

      <section className="overflow-x-auto rounded-[20px] border border-line bg-surface p-5.5">
        <h2 className="mb-3 text-base font-bold">Ano a ano</h2>
        <table className="w-full min-w-120 text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-2 font-bold">Ano</th>
              <th className="py-2 text-right font-bold">Investido</th>
              <th className="py-2 text-right font-bold">Juros</th>
              <th className="py-2 text-right font-bold">Total</th>
            </tr>
          </thead>
          <tbody>
            {years12.map((p) => (
              <tr key={p.m} className="border-t border-line">
                <td className="py-2.5 font-bold">{p.m / 12}</td>
                <td className="py-2.5 text-right">{brl(Math.round(p.invested * 100) / 100)}</td>
                <td className="py-2.5 text-right text-income-text">{brl(Math.round((p.total - p.invested) * 100) / 100)}</td>
                <td className="py-2.5 text-right font-extrabold">{brl(Math.round(p.total * 100) / 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted">
          Simulação simples: aportes no fim de cada mês, taxa constante, sem imposto nem inflação. O resultado real varia.
        </p>
      </section>
    </>
  );
}
