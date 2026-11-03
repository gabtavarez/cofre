"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { ChartHover, type HoverPoint } from "@/components/ChartHover";
import { fieldCls } from "@/components/forms";
import { createGoal } from "@/lib/actions";
import { brl } from "@/lib/format";
import { buildSchedule, rentVsBuy, upfrontCosts, type Method } from "@/lib/mortgage";

const card = "min-w-0 rounded-[20px] border border-line bg-surface p-5.5";

/** "500.000", "500000" e "500.000,50" viram número. */
function money(s: string): number {
  const t = s.replace(/[R$\s]/g, "");
  if (!t) return 0;
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : /^\d{1,3}(\.\d{3})+$/.test(t) ? Number(t.replace(/\./g, "")) : Number(t);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
const pct = (s: string) => {
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const r0 = (n: number) => Math.round(n);

function Num({ label, value, set, hint, suffix }: { label: string; value: string; set: (v: string) => void; hint?: string; suffix?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold text-muted">{label}</span>
      <div className="relative">
        <input inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} className={`${fieldCls} ${suffix ? "pr-14" : ""}`} />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-xs font-bold text-muted">{suffix}</span>}
      </div>
      {hint && <span className="text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

export function MortgageClient({ income, surplus }: { income: number; surplus: number }) {
  const [price, setPrice] = useState("500000");
  const [down, setDown] = useState("100000");
  const [fgts, setFgts] = useState("0");
  const [years, setYears] = useState("30");
  const [rate, setRate] = useState("10,5");
  const [ins, setIns] = useState("0,03");
  const [fee, setFee] = useState("25");
  const [itbi, setItbi] = useState("3");
  const [registry, setRegistry] = useState("1,5");
  const [other, setOther] = useState("3000");

  const [method, setMethod] = useState<Method>("price");
  const [rent, setRent] = useState("2500");
  const [hold, setHold] = useState("600");
  const [apprec, setApprec] = useState("5");
  const [adjust, setAdjust] = useState("5");
  const [invest, setInvest] = useState("9");
  const [sell, setSell] = useState("6");
  const [horizon, setHorizon] = useState("15");

  const [goalMsg, setGoalMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const m = useMemo(() => {
    const P = money(price);
    const D = Math.min(money(down), P);
    const financed = Math.max(0, P - D);
    const n = Math.max(1, Math.min(35, Math.round(pct(years) || 0))) * 12;
    const base = { principal: financed, annualRate: pct(rate), months: n, insuranceRate: pct(ins), adminFee: money(fee) };
    const sac = buildSchedule("sac", base);
    const price_ = buildSchedule("price", base);
    const up = upfrontCosts({ price: P, down: D, fgtsOnDown: money(fgts), itbiPct: pct(itbi), registryPct: pct(registry), otherFees: money(other) });
    const sched = method === "sac" ? sac : price_;
    const hz = Math.max(1, Math.min(35, Math.round(pct(horizon) || 0)));
    const rvb = rentVsBuy({
      price: P, upfrontCash: up.totalCash, schedule: sched, holdCostMonthly: money(hold), appreciationPct: pct(apprec),
      sellingCostPct: pct(sell), rent: money(rent), rentAdjustPct: pct(adjust), investPct: pct(invest), years: hz,
    });
    return { P, D, financed, n, sac, price: price_, up, rvb, hz };
  }, [price, down, fgts, years, rate, ins, fee, itbi, registry, other, method, rent, hold, apprec, adjust, invest, sell, horizon]);

  // gráfico das parcelas
  const W = 640, H = 220, pad = 10;
  const maxPay = Math.max(m.sac.first, m.price.first, 1);
  const xm = (k: number) => pad + ((k - 1) / Math.max(m.n - 1, 1)) * (W - pad * 2);
  const ym = (v: number) => H - pad - (v / maxPay) * (H - pad * 2);
  const linePath = (rows: { payment: number }[]) => rows.map((r, k) => `${k ? "L" : "M"}${xm(k + 1).toFixed(1)} ${ym(r.payment).toFixed(1)}`).join(" ");
  const payPts: HoverPoint[] = m.sac.rows.map((r, k) => ({
    x: xm(r.n),
    title: `Parcela ${r.n} (ano ${Math.ceil(r.n / 12)})`,
    rows: [
      { name: "SAC", value: brl(r.payment), y: ym(r.payment), color: "var(--color-accent)" },
      { name: "Price", value: brl(m.price.rows[k].payment), y: ym(m.price.rows[k].payment), color: "#b9a7ff" },
    ],
  }));

  // gráfico aluguel x compra
  const pts = m.rvb.points;
  const maxW = Math.max(...pts.flatMap((p) => [p.buy, p.rent]), 1);
  const minW = Math.min(...pts.flatMap((p) => [p.buy, p.rent]), 0);
  const xr = (i: number) => pad + (pts.length <= 1 ? 0.5 : i / (pts.length - 1)) * (W - pad * 2);
  const yr = (v: number) => H - pad - ((v - minW) / (maxW - minW || 1)) * (H - pad * 2);
  const wPath = (key: "buy" | "rent") => pts.map((p, i) => `${i ? "L" : "M"}${xr(i).toFixed(1)} ${yr(p[key]).toFixed(1)}`).join(" ");
  const wPts: HoverPoint[] = pts.map((p, i) => ({
    x: xr(i),
    title: `Ano ${p.year}`,
    rows: [
      { name: "Comprar", value: brl(p.buy), y: yr(p.buy), color: "var(--color-accent)" },
      { name: "Alugar", value: brl(p.rent), y: yr(p.rent), color: "#38bdf8" },
    ],
  }));

  const sel = method === "sac" ? m.sac : m.price;
  const downPct = m.P > 0 ? (m.D / m.P) * 100 : 0;
  const diffInterest = m.price.totalInterest - m.sac.totalInterest;
  const limit30 = income * 0.3;
  const last = pts[pts.length - 1];

  return (
    <>
      <section className="grid gap-4 rounded-[20px] border border-line bg-surface p-5.5 sm:grid-cols-2 lg:grid-cols-4">
        <Num label="Valor do imóvel (R$)" value={price} set={setPrice} />
        <Num label="Entrada (R$)" value={down} set={setDown} hint={`${downPct.toFixed(0)}% do valor`} />
        <Num label="FGTS usado na entrada (R$)" value={fgts} set={setFgts} hint="Reduz o dinheiro que sai do bolso" />
        <Num label="Prazo (anos)" value={years} set={setYears} hint="Até 35 anos" />
        <Num label="Juros (% ao ano)" value={rate} set={setRate} hint="Taxa nominal, como o banco anuncia" suffix="% a.a." />
        <Num label="Seguros (% ao mês)" value={ins} set={setIns} hint="MIP + DFI, sobre o saldo devedor" suffix="% a.m." />
        <Num label="Tarifa mensal (R$)" value={fee} set={setFee} />
        <Num label="ITBI (%)" value={itbi} set={setItbi} hint="Varia por município (em geral 2% a 3%)" suffix="%" />
        <Num label="Escritura e registro (%)" value={registry} set={setRegistry} suffix="%" />
        <Num label="Avaliação e tarifas (R$)" value={other} set={setOther} />
      </section>

      {(downPct < 20 || m.financed <= 0) && (
        <p className="rounded-xl bg-warn-bg px-4 py-3 text-sm font-semibold text-warn-text">
          {m.financed <= 0 ? "A entrada cobre o valor todo: não há financiamento." : "Entrada abaixo de 20%: os bancos costumam financiar no máximo 80% do imóvel."}
        </p>
      )}

      <section className="flex flex-wrap gap-4">
        {([["SAC", m.sac, "Parcela começa maior e cai todo mês"], ["Price", m.price, "Parcela fixa, mais baixa no começo"]] as const).map(([name, s, desc]) => (
          <div key={name} className={`${card} flex min-w-72 flex-[1_1_320px] flex-col gap-3 ${name === "SAC" ? "" : ""}`}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-base font-bold">{name}</h2>
              <span className="text-xs text-muted">{desc}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col"><span className="text-xs text-muted">Primeira parcela</span><b className="font-display text-xl">{brl(s.first)}</b></div>
              <div className="flex flex-col"><span className="text-xs text-muted">Última parcela</span><b className="font-display text-xl">{brl(s.last)}</b></div>
              <div className="flex flex-col"><span className="text-xs text-muted">Juros totais</span><b className="font-display text-xl text-expense-text">{brl(s.totalInterest)}</b></div>
              <div className="flex flex-col"><span className="text-xs text-muted">Total pago no financiamento</span><b className="font-display text-xl">{brl(s.totalPaid)}</b></div>
            </div>
          </div>
        ))}
      </section>

      {m.financed > 0 && (
        <p className="rounded-xl bg-side px-4 py-3 text-sm text-soft">
          Com a mesma taxa e prazo, o <b className="text-text">SAC</b> paga <b className="text-accent-soft">{brl(diffInterest)}</b> a menos em juros que a Price, mas exige uma parcela inicial{" "}
          <b className="text-text">{brl(m.sac.first - m.price.first)}</b> maior. Se a parcela inicial couber no seu orçamento, o SAC sai mais barato.
        </p>
      )}

      <section className={card}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold">Como a parcela evolui</h2>
          <span className="flex items-center gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-accent" /> SAC</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ background: "#b9a7ff" }} /> Price</span>
          </span>
        </div>
        <ChartHover W={W} H={H} pts={payPts} top={pad} bottom={H - pad} label="Evolução da parcela do financiamento no SAC e na Price">
          <path d={linePath(m.price.rows)} fill="none" stroke="#b9a7ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d={linePath(m.sac.rows)} fill="none" stroke="var(--color-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </ChartHover>
      </section>

      <section className="flex flex-wrap gap-4">
        <div className={`${card} flex min-w-72 flex-[1_1_320px] flex-col gap-2.5`}>
          <h2 className="text-base font-bold">Dinheiro necessário no dia da compra</h2>
          <ul className="flex flex-col gap-1.5 text-sm">
            <li className="flex justify-between"><span className="text-soft">Entrada (sem FGTS)</span><b>{brl(m.up.cashDown)}</b></li>
            {m.up.fgts > 0 && <li className="flex justify-between"><span className="text-muted">Entrada paga com FGTS</span><span>{brl(m.up.fgts)}</span></li>}
            <li className="flex justify-between"><span className="text-soft">ITBI</span><b>{brl(m.up.itbi)}</b></li>
            <li className="flex justify-between"><span className="text-soft">Escritura e registro</span><b>{brl(m.up.registry)}</b></li>
            <li className="flex justify-between"><span className="text-soft">Avaliação e tarifas</span><b>{brl(m.up.other)}</b></li>
            <li className="mt-1 flex justify-between border-t border-line pt-2 text-base"><b>Total em dinheiro</b><b className="font-display text-accent-soft">{brl(m.up.totalCash)}</b></li>
          </ul>
          <p className="text-[11px] text-muted">As regras para usar o FGTS (tempo de contribuição, tipo de imóvel e outras) variam. Confirme no banco.</p>
          <button
            type="button"
            disabled={pending || m.up.totalCash <= 0}
            onClick={() => {
              setGoalMsg(null);
              const fd = new FormData();
              fd.set("name", "Entrada do imóvel");
              fd.set("target_amount", m.up.totalCash.toFixed(2).replace(".", ","));
              start(async () => {
                const r = await createGoal(fd);
                setGoalMsg(r.ok ? "ok" : r.error);
              });
            }}
            className="mt-1 min-h-11 cursor-pointer rounded-xl bg-accent px-4 text-sm font-extrabold text-ink hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Criando…" : "Criar meta com esse valor"}
          </button>
          {goalMsg === "ok" && (
            <span className="text-xs font-semibold text-income-text">
              Meta criada. <Link href="/metas" className="underline">Ver em Metas</Link> para acompanhar o prazo.
            </span>
          )}
          {goalMsg && goalMsg !== "ok" && <span className="text-xs font-semibold text-expense-text">{goalMsg}</span>}
        </div>

        <div className={`${card} flex min-w-72 flex-[1_1_320px] flex-col gap-2.5`}>
          <h2 className="text-base font-bold">Cabe no seu orçamento?</h2>
          {income > 0 ? (
            <ul className="flex flex-col gap-2 text-sm">
              <li className="flex justify-between"><span className="text-soft">Renda média cadastrada</span><b>{brl(income)}</b></li>
              <li className="flex justify-between"><span className="text-soft">Limite de 30% da renda</span><b>{brl(limit30)}</b></li>
              <li className="flex justify-between"><span className="text-soft">1ª parcela no {method === "sac" ? "SAC" : "Price"}</span><b className={sel.first > limit30 ? "text-expense-text" : "text-income-text"}>{brl(sel.first)}</b></li>
              <li className="flex justify-between"><span className="text-soft">Sua sobra média por mês</span><b>{brl(surplus)}</b></li>
            </ul>
          ) : (
            <p className="text-sm text-muted">Cadastre receitas em Lançamentos para comparar a parcela com a sua renda.</p>
          )}
          {income > 0 && (
            <p className="text-xs text-muted">
              {sel.first > limit30
                ? "A primeira parcela passa de 30% da renda, limite que os bancos costumam usar para aprovar o crédito."
                : "A primeira parcela está dentro dos 30% da renda que os bancos costumam aceitar."}
              {surplus > 0 && sel.first > surplus ? " Ela também é maior que a sua sobra média de hoje, então algum gasto precisaria diminuir." : ""}
            </p>
          )}
        </div>
      </section>

      <section className={`${card} flex flex-col gap-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-bold">Aluguel × compra</h2>
            <span className="text-xs text-muted">Patrimônio de quem compra contra o de quem aluga e investe a entrada e a diferença de custo.</span>
          </div>
          <div className="flex rounded-xl border border-line bg-side p-1 text-[13px]">
            {(["price", "sac"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setMethod(k)}
                className={`min-h-9 cursor-pointer rounded-lg px-4 font-bold ${method === k ? "bg-accent text-ink" : "text-muted hover:text-text"}`}
              >
                {k === "sac" ? "SAC" : "Price"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Num label="Aluguel hoje (R$)" value={rent} set={setRent} hint="Imóvel equivalente" />
          <Num label="Condomínio, IPTU e manutenção (R$)" value={hold} set={setHold} hint="Por mês, de quem compra" />
          <Num label="Valorização do imóvel (% ao ano)" value={apprec} set={setApprec} suffix="% a.a." />
          <Num label="Reajuste do aluguel (% ao ano)" value={adjust} set={setAdjust} suffix="% a.a." />
          <Num label="Rendimento do investimento (% ao ano)" value={invest} set={setInvest} hint="Líquido de imposto" suffix="% a.a." />
          <Num label="Custo de venda (%)" value={sell} set={setSell} hint="Corretagem e taxas" suffix="%" />
          <Num label="Horizonte (anos)" value={horizon} set={setHorizon} />
        </div>

        {last && (
          <p className="rounded-xl bg-side px-4 py-3 text-sm text-soft">
            Em <b className="text-text">{last.year} anos</b>: comprando você teria <b className="text-accent-soft">{brl(last.buy)}</b> de patrimônio; alugando e investindo,{" "}
            <b style={{ color: "#38bdf8" }}>{brl(last.rent)}</b>.{" "}
            {m.rvb.breakEvenYear
              ? `Comprar passa a valer mais a partir do ano ${m.rvb.breakEvenYear}.`
              : "Nesse horizonte e com essas premissas, alugar e investir leva vantagem."}
          </p>
        )}

        <div>
          <div className="mb-2 flex items-center gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-accent" /> Comprar</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ background: "#38bdf8" }} /> Alugar e investir</span>
          </div>
          {pts.length > 0 && (
            <ChartHover W={W} H={H} pts={wPts} top={pad} bottom={H - pad} label="Patrimônio ao longo dos anos comprando ou alugando">
              <path d={wPath("rent")} fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <path d={wPath("buy")} fill="none" stroke="var(--color-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </ChartHover>
          )}
        </div>
        <p className="text-[11px] text-muted">
          É uma simulação com premissas que você controla, não uma previsão. Quem compra também paga a diferença quando o aluguel é mais barato que a parcela, e quem aluga investe essa diferença. Valores em {r0(m.hz)} anos, sem considerar TR.
        </p>
      </section>
    </>
  );
}
