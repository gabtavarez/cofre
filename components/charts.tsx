"use client";

import { useState } from "react";
import { ChartHover, type HoverPoint } from "@/components/ChartHover";
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

  const hoverPts: HoverPoint[] = [];
  for (let d = 1; d <= days; d++) {
    const isReal = d <= realized.length;
    const v = isReal ? realized[d - 1] : projected[d - projectedStart];
    if (v === undefined || (!isReal && d < projectedStart)) continue;
    hoverPts.push({ x: x(d), title: `Dia ${d}`, rows: [{ name: isReal ? "Realizado" : "Projetado", value: brl(v), y: y(v), color: "var(--color-accent)" }] });
  }

  const idle = (
    <>
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
    </>
  );

  return (
    <ChartHover
      W={W}
      H={H}
      pts={hoverPts}
      top={Y_TOP}
      bottom={Y_BOT}
      idle={idle}
      label={`Saldo diário. Realizado até agora: ${lastR !== null ? brl(lastR) : "sem dados"}. Projeção para o fim do mês: ${lastP !== null ? brl(lastP) : "sem projeção"}.`}
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
        <polyline points={realizedPts.join(" ")} fill="none" stroke="var(--color-accent)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
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
    </ChartHover>
  );
}

const SLICE_COLORS = ["#c8f169", "#b9a7ff", "#38bdf8", "#ffc857", "#64748b"];
export const sliceColor = (i: number) => SLICE_COLORS[i % SLICE_COLORS.length];

export function CategoryDonut({ slices, total }: { slices: CategorySlice[]; total: number }) {
  const [hi, setHi] = useState<number | null>(null);
  const R = 64;
  const C = 2 * Math.PI * R;
  const GAP = 4;
  let offset = 0;
  const cur = hi !== null ? slices[hi] : null;

  return (
    <>
      <div className="flex justify-center">
        <svg
          width="180"
          height="180"
          viewBox="0 0 180 180"
          role="img"
          aria-label={`Despesas por categoria: ${slices.map((s) => `${s.name} ${brl(s.value)}`).join(", ") || "sem dados"}`}
          onPointerLeave={() => setHi(null)}
        >
          <circle cx="90" cy="90" r={R} fill="none" stroke="var(--color-raised)" strokeWidth="20" />
          <g fill="none" transform="rotate(-90 90 90)">
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
                    strokeWidth={hi === i ? 26 : 20}
                    strokeOpacity={hi === null || hi === i ? 1 : 0.35}
                    strokeDasharray={`${dash.toFixed(1)} ${C.toFixed(1)}`}
                    strokeDashoffset={(-offset).toFixed(1)}
                    style={{ transition: "stroke-width 0.2s ease, stroke-opacity 0.2s ease", cursor: "pointer" }}
                    onPointerEnter={() => setHi(i)}
                    onPointerDown={() => setHi(i)}
                  />
                );
                offset += len;
                return el;
              })}
          </g>
          <text x="90" y={cur ? 80 : 86} textAnchor="middle" fill="var(--color-muted)" fontSize="12">
            {cur ? (cur.name.length > 16 ? `${cur.name.slice(0, 15)}…` : cur.name) : "Despesas"}
          </text>
          <text x="90" y={cur ? 102 : 108} textAnchor="middle" fill="var(--color-text)" fontSize="19" fontWeight="800">
            {`R$ ${Math.round(cur ? cur.value : total).toLocaleString("pt-BR")}`}
          </text>
          {cur && (
            <text x="90" y="120" textAnchor="middle" fill="var(--color-muted)" fontSize="12">
              {((cur.value / total) * 100).toFixed(1).replace(".", ",")}%
            </text>
          )}
        </svg>
      </div>
      <ul className="flex flex-col gap-1 text-[13px]" onPointerLeave={() => setHi(null)}>
        {slices.map((s, i) => (
          <li
            key={s.name}
            onPointerEnter={() => setHi(i)}
            className={`flex cursor-default items-center gap-2.5 rounded-lg px-2 py-1 transition-[background-color,opacity] duration-150 ${hi === i ? "bg-raised" : ""} ${hi !== null && hi !== i ? "opacity-55" : ""}`}
          >
            <span className="size-2.5 rounded-xs" style={{ background: sliceColor(i) }} />
            <span className="flex-1 truncate">{s.name}</span>
            <span className="text-muted">{((s.value / total) * 100).toFixed(1).replace(".", ",")}%</span>
            <b className="min-w-22 text-right">{brl(s.value)}</b>
          </li>
        ))}
      </ul>
    </>
  );
}

export type BarMonth = { label: string; income: number; expense: number; current: boolean };

export function MonthlyBars({ data }: { data: BarMonth[] }) {
  const [hi, setHi] = useState<number | null>(null);
  const max = Math.max(...data.flatMap((d) => [d.income, d.expense]), 1);
  const h = (v: number) => Math.max(Math.round((v / max) * 130), v > 0 ? 3 : 0);
  const last = data.length - 1;

  return (
    <div role="img" aria-label="Receitas e despesas por mês" onPointerLeave={() => setHi(null)}>
      <div className="flex h-37.5 items-end justify-between gap-2 border-b border-line">
        {data.map((d, i) => {
          const net = d.income - d.expense;
          return (
            <div
              key={d.label}
              className="relative flex h-full cursor-default items-end gap-1 px-1"
              onPointerEnter={() => setHi(i)}
              onPointerDown={() => setHi(i)}
            >
              <div
                className="w-3.5 rounded-t-md rounded-b-xs bg-income transition-[filter,opacity] duration-150"
                style={{ height: h(d.income), opacity: hi === null || hi === i ? 1 : 0.4, filter: hi === i ? "brightness(1.15)" : undefined }}
              />
              <div
                className="w-3.5 rounded-t-md rounded-b-xs bg-expense transition-[filter,opacity] duration-150"
                style={{ height: h(d.expense), opacity: hi === null || hi === i ? 1 : 0.4, filter: hi === i ? "brightness(1.15)" : undefined }}
              />
              {hi === i && (
                <div
                  className="pointer-events-none absolute bottom-full z-10 mb-2 flex min-w-36 flex-col gap-1 rounded-xl border border-edge bg-raised px-3 py-2 text-xs shadow-lg"
                  style={{ [i === 0 ? "left" : i === last ? "right" : "left"]: i === 0 || i === last ? 0 : "50%", transform: i === 0 || i === last ? undefined : "translateX(-50%)" }}
                >
                  <span className="font-bold text-muted">{d.label}</span>
                  <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-income" />Receitas<b className="ml-auto pl-3">{brl(d.income)}</b></span>
                  <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-expense" />Despesas<b className="ml-auto pl-3">{brl(d.expense)}</b></span>
                  <span className="flex items-center gap-2 border-t border-line pt-1 text-soft">Resultado<b className={`ml-auto pl-3 ${net < 0 ? "text-expense-text" : "text-income-text"}`}>{brl(net)}</b></span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex justify-between gap-2 text-xs text-muted">
        {data.map((d, i) => (
          <span key={d.label} className={`w-8 text-center transition-colors ${d.current || hi === i ? "font-bold text-text" : ""}`}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
