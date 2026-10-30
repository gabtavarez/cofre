"use client";

import { useRef, useState, type ReactNode } from "react";

export type HoverRow = { name: string; value: string; y: number; color: string; dashed?: boolean };
export type HoverPoint = { x: number; title: string; rows: HoverRow[] };

/** Envolve um gráfico SVG de linha: ao passar o mouse/dedo mostra guia vertical, pontos e um balão com os valores. */
export function ChartHover({
  W,
  H,
  pts,
  label,
  children,
  idle,
  top = 0,
  bottom = H,
}: {
  W: number;
  H: number;
  pts: HoverPoint[]; // ordenados por x
  label: string;
  children: ReactNode;
  idle?: ReactNode; // desenhado só quando não há hover
  top?: number;
  bottom?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [i, setI] = useState<number | null>(null);

  function move(e: React.PointerEvent) {
    const el = box.current;
    if (!el || pts.length === 0) return;
    const r = el.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let lo = 0;
    let hi = pts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].x < px) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0 && Math.abs(pts[lo - 1].x - px) <= Math.abs(pts[lo].x - px)) lo -= 1;
    setI((prev) => (prev === lo ? prev : lo));
  }

  const pt = i !== null ? pts[i] : null;
  const minY = pt ? Math.min(...pt.rows.map((r) => r.y)) : 0;
  const fx = pt ? pt.x / W : 0;
  const below = pt ? minY / H < 0.3 : false;

  return (
    <div
      ref={box}
      className="relative touch-pan-y"
      onPointerMove={move}
      onPointerDown={move}
      onPointerLeave={() => setI(null)}
      onPointerCancel={() => setI(null)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={label}>
        {children}
        {!pt && idle}
        {pt && (
          <g pointerEvents="none">
            <line x1={pt.x} x2={pt.x} y1={top} y2={bottom} stroke="var(--color-edge)" strokeWidth="1.5" strokeDasharray="4 4" />
            {pt.rows.map((r) => (
              <circle key={r.name} cx={pt.x} cy={r.y} r="5.5" fill={r.color} stroke="var(--color-surface)" strokeWidth="3" />
            ))}
          </g>
        )}
      </svg>
      {pt && (
        <div
          className="pointer-events-none absolute z-10 flex min-w-32 flex-col gap-1 rounded-xl border border-edge bg-raised px-3 py-2 text-xs shadow-lg"
          style={{
            left: `${fx * 100}%`,
            top: `${(minY / H) * 100}%`,
            transform: `translate(${fx < 0.2 ? "-8%" : fx > 0.8 ? "-92%" : "-50%"}, ${below ? "14px" : "calc(-100% - 12px)"})`,
          }}
        >
          <span className="font-bold text-muted">{pt.title}</span>
          {pt.rows.map((r) => (
            <span key={r.name} className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ background: r.color }} />
              <span className="text-soft">{r.name}</span>
              <b className="ml-auto pl-3 text-text">{r.value}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
