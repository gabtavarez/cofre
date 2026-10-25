import type { Series, CategorySlice } from "@/lib/finance";
import { niceCeil } from "@/lib/finance";
import { brl } from "@/lib/format";

const W = 660;
const H = 226;
const X0 = 50;
const X1 = 628;
const Y_TOP = 30;
const Y_BOT = 190;

function kLabel(v: number): string {
  if (v === 0) return "0";
  const abs = Math.abs(v);
  const s = abs >= 1000 ? `${abs / 1000 === Math.round(abs / 1000) ? abs / 1000 : (abs / 1000).toFixed(1).replace(".", ",")} mil` : String(abs);
  return v < 0 ? `−${s}` : s;
}

export function CashflowChart({ series }: { series: Series }) {
  const { days, realized, projected, projectedStart } = series;
  const all = [...realized, ...projected];
  const maxV = niceCeil(Math.max(...all, 1));
  const minV = Math.min(...all, 0) < 0 ? -niceCeil(-Math.min(...all)) : 0;
  const span = maxV - minV || 1;

  const x = (day: number) => X0 + ((day - 1) / Math.max(days - 1, 1)) * (X1 - X0);
  const y = (v: number) => Y_BOT - ((v - minV) / span) * (Y_BOT - Y_TOP);

  const ticks = [0, 1, 2, 3].map((i) => minV + (span / 3) * i);
  const xTicks = [1, 8, 15, 22, 29].filter((d) => d <= days);

  const realizedPts = realized.map((v, i) => `${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`);
  const projectedPts = projected.map((v, i) => `${x(projectedStart + i).toFixed(1)},${y(v).toFixed(1)}`);

  const lastR = realized.length ? realized[realized.length - 1] : null;
  const lastRDay = realized.length;
  const lastP = projected.length ? projected[projected.length - 1] : null;

  const area =
    realizedPts.length > 1
      ? `M${realizedPts.join(" L")} L${x(lastRDay).toFixed(1)},${Y_BOT} L${x(1).toFixed(1)},${Y_BOT} Z`
      : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full"
      role="img"
      aria-label={`Saldo diário. Realizado até agora: ${lastR !== null ? brl(lastR) : "sem dados"}. Projeção para o fim do mês: ${lastP !== null ? brl(lastP) : "sem projeção"}.`}
    >
      <g stroke="var(--color-line)" strokeWidth="1">
        {ticks.map((t) => (
          <line key={t} x1="40" x2="640" y1={y(t)} y2={y(t)} />
        ))}
      </g>
      <g fill="var(--color-muted)" fontSize="11">
        {ticks.map((t) => (
          <text key={t} x="0" y={y(t) + 4}>
            {kLabel(Math.round(t))}
          </text>
        ))}
        {xTicks.map((d) => (
          <text key={d} x={x(d)} y="214" textAnchor="middle">
            {d}
          </text>
        ))}
      </g>

      {area && <path d={area} fill="var(--color-accent)" fillOpacity="0.14" />}
      {realizedPts.length > 0 && (
        <polyline
          points={realizedPts.join(" ")}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {projectedPts.length > 1 && (
        <polyline
          points={projectedPts.join(" ")}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="3"
          strokeDasharray="7 7"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {lastR !== null && series.todayDay !== null && (
        <g>
          <line
            x1={x(lastRDay)}
            x2={x(lastRDay)}
            y1={Math.max(y(lastR) - 8, Y_TOP + 34)}
            y2={Y_BOT}
            stroke="#3a4670"
            strokeDasharray="4 4"
          />
          <rect
            x={Math.min(Math.max(x(lastRDay) - 48, 40), W - 100)}
            y={Math.max(y(lastR) - 48, 4)}
            width="96"
            height="30"
            rx="8"
            fill="var(--color-raised)"
            stroke="var(--color-edge)"
          />
          <text
            x={Math.min(Math.max(x(lastRDay), 88), W - 52)}
            y={Math.max(y(lastR) - 48, 4) + 19}
            textAnchor="middle"
            fill="var(--color-text)"
            fontSize="12"
            fontWeight="700"
          >
            {brl(lastR)}
          </text>
          <circle cx={x(lastRDay)} cy={y(lastR)} r="6" fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth="3" />
        </g>
      )}

      {lastP !== null && projectedPts.length > 1 && (
        <g>
          <circle cx={x(days)} cy={y(lastP)} r="4" fill="var(--color-surface)" stroke="var(--color-accent)" strokeWidth="2" />
          <text x={Math.min(x(days), W - 36)} y={y(lastP) - 12} textAnchor="middle" fill="var(--color-muted)" fontSize="11">
            {brl(lastP)}
          </text>
        </g>
      )}
    </svg>
  );
}

const SLICE_COLORS = ["#c8f169", "#b9a7ff", "#38bdf8", "#ffc857", "#64748b"];
export const sliceColor = (i: number) => SLICE_COLORS[i % SLICE_COLORS.length];

export function Donut({ slices, total }: { slices: CategorySlice[]; total: number }) {
  const R = 64;
  const C = 2 * Math.PI * R;
  const GAP = 4;
  let offset = 0;

  return (
    <svg
      width="180"
      height="180"
      viewBox="0 0 180 180"
      role="img"
      aria-label={`Despesas por categoria: ${slices.map((s) => `${s.name} ${brl(s.value)}`).join(", ") || "sem dados"}`}
    >
      <circle cx="90" cy="90" r={R} fill="none" stroke="var(--color-raised)" strokeWidth="20" />
      <g fill="none" strokeWidth="20" transform="rotate(-90 90 90)">
        {total > 0 &&
          slices.map((s, i) => {
            const len = (s.value / total) * C;
            const dash = Math.max(len - (slices.length > 1 ? GAP : 0), 0.5);
            const el = (
              <circle
                key={s.name}
                cx="90"
                cy="90"
                r={R}
                stroke={sliceColor(i)}
                strokeDasharray={`${dash.toFixed(1)} ${C.toFixed(1)}`}
                strokeDashoffset={(-offset).toFixed(1)}
              />
            );
            offset += len;
            return el;
          })}
      </g>
      <text x="90" y="86" textAnchor="middle" fill="var(--color-muted)" fontSize="12">
        Despesas
      </text>
      <text x="90" y="108" textAnchor="middle" fill="var(--color-text)" fontSize="19" fontWeight="800">
        {`R$ ${Math.round(total).toLocaleString("pt-BR")}`}
      </text>
    </svg>
  );
}

export type BarMonth = { label: string; income: number; expense: number; current: boolean };

export function MonthlyBars({ data }: { data: BarMonth[] }) {
  const max = Math.max(...data.flatMap((d) => [d.income, d.expense]), 1);
  const h = (v: number) => Math.max(Math.round((v / max) * 130), v > 0 ? 3 : 0);

  return (
    <div role="img" aria-label="Receitas e despesas por mês">
      <div className="flex h-37.5 items-end justify-between gap-2 border-b border-line">
        {data.map((d) => (
          <div key={d.label} className="flex items-end gap-1">
            <div className="w-3.5 rounded-t-md rounded-b-xs bg-income" style={{ height: h(d.income) }} title={`Receitas ${brl(d.income)}`} />
            <div className="w-3.5 rounded-t-md rounded-b-xs bg-expense" style={{ height: h(d.expense) }} title={`Despesas ${brl(d.expense)}`} />
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between gap-2 text-xs text-muted">
        {data.map((d) => (
          <span key={d.label} className={`w-8 text-center ${d.current ? "font-bold text-text" : ""}`}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
