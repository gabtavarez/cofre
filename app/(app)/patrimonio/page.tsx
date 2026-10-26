import { getNetWorth, recordAndGetSnapshots } from "@/lib/data";
import { monthLabel, todayISO } from "@/lib/dates";
import { brl } from "@/lib/format";

export default async function Patrimonio() {
  const today = todayISO();
  const month = today.slice(0, 7);
  const nw = await getNetWorth(today);
  const snaps = await recordAndGetSnapshots(month, nw);

  const pts = snaps.map((s) => ({ month: s.month, net: s.accounts + s.investments - s.debts }));
  const W = 640, H = 220, pad = 12;
  const vals = pts.map((p) => p.net);
  const lo = Math.min(0, ...vals);
  const hi = Math.max(1, ...vals);
  const x = (i: number) => (pts.length <= 1 ? W / 2 : pad + (i / (pts.length - 1)) * (W - pad * 2));
  const y = (v: number) => H - pad - ((v - lo) / (hi - lo || 1)) * (H - pad * 2);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.net).toFixed(1)}`).join(" ");

  const parts = [
    { label: "Em contas", value: nw.accounts, color: "var(--color-accent)" },
    { label: "Investido", value: nw.investments, color: "var(--color-invest)" },
  ];
  const assets = Math.max(1, nw.accounts + nw.investments);

  return (
    <>
      <header className="flex flex-col gap-1">
        <span className="text-[13px] text-muted">O que você tem menos o que deve</span>
        <h1 className="text-3xl font-extrabold">Patrimônio líquido</h1>
      </header>

      <section className="flex flex-wrap gap-4">
        <div className="flex min-w-55 flex-[1.4_1_0] flex-col gap-2.5 rounded-[20px] bg-accent p-5.5 text-ink">
          <span className="text-[13px] font-bold">Patrimônio líquido hoje</span>
          <span className="font-display text-4xl font-extrabold">{brl(nw.net)}</span>
          <span className="text-xs font-semibold">Contas + investimentos − dívidas</span>
        </div>
        <div className="flex min-w-48 flex-1 flex-col gap-2.5 rounded-[20px] border border-line bg-surface p-5.5">
          <span className="text-[13px] font-bold text-muted">Em contas</span>
          <span className="font-display text-2xl font-extrabold">{brl(nw.accounts)}</span>
        </div>
        <div className="flex min-w-48 flex-1 flex-col gap-2.5 rounded-[20px] border border-line bg-surface p-5.5">
          <span className="text-[13px] font-bold text-muted">Investido</span>
          <span className="font-display text-2xl font-extrabold text-invest-text">{brl(nw.investments)}</span>
        </div>
        <div className="flex min-w-48 flex-1 flex-col gap-2.5 rounded-[20px] border border-line bg-surface p-5.5">
          <span className="text-[13px] font-bold text-muted">Dívidas</span>
          <span className="font-display text-2xl font-extrabold text-expense-text">−{brl(nw.debts).replace("−", "")}</span>
        </div>
      </section>

      <section className="rounded-[20px] border border-line bg-surface p-5.5">
        <h2 className="mb-3 text-base font-bold">Onde está o seu dinheiro</h2>
        <div className="flex h-4 overflow-hidden rounded-full bg-raised" role="img" aria-label="Divisão entre contas e investimentos">
          {parts.map((p) => (
            <div key={p.label} style={{ width: `${(Math.max(0, p.value) / assets) * 100}%`, background: p.color }} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-soft">
          {parts.map((p) => (
            <span key={p.label} className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: p.color }} />
              {p.label} <b className="text-text">{Math.round((Math.max(0, p.value) / assets) * 100)}%</b>
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-[20px] border border-line bg-surface p-5.5">
        <h2 className="mb-1 text-base font-bold">Evolução</h2>
        <p className="mb-3 text-xs text-muted">
          O app guarda um retrato por mês cada vez que você abre esta página, então o histórico começa em {pts.length ? monthLabel(pts[0].month) : "hoje"} e cresce com o tempo.
        </p>
        {pts.length < 2 ? (
          <p className="rounded-xl bg-side px-4 py-8 text-center text-sm text-muted">
            Volte no mês que vem para ver a linha de evolução.
          </p>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Evolução do patrimônio líquido por mês" className="block">
            <path d={`${path} L${x(pts.length - 1)} ${H - pad} L${x(0)} ${H - pad} Z`} fill="var(--color-accent)" fillOpacity="0.12" />
            <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            {pts.map((p, i) => (
              <circle key={p.month} cx={x(i)} cy={y(p.net)} r="4" fill="var(--color-surface)" stroke="var(--color-accent)" strokeWidth="2" />
            ))}
          </svg>
        )}
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-2 font-bold">Mês</th>
              <th className="py-2 text-right font-bold">Contas</th>
              <th className="py-2 text-right font-bold">Investido</th>
              <th className="py-2 text-right font-bold">Dívidas</th>
              <th className="py-2 text-right font-bold">Líquido</th>
            </tr>
          </thead>
          <tbody>
            {[...snaps].reverse().map((s) => (
              <tr key={s.month} className="border-t border-line">
                <td className="py-2.5 font-bold">{monthLabel(s.month)}</td>
                <td className="py-2.5 text-right">{brl(s.accounts)}</td>
                <td className="py-2.5 text-right">{brl(s.investments)}</td>
                <td className="py-2.5 text-right text-expense-text">{brl(s.debts)}</td>
                <td className="py-2.5 text-right font-extrabold">{brl(Math.round((s.accounts + s.investments - s.debts) * 100) / 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
