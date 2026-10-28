"use client";

import { useState, useTransition } from "react";
import { saveFreeSettings } from "@/lib/actions";
import { fieldCls } from "@/components/forms";

export function FreeSettings({
  savings,
  buffer,
  categories,
  selected,
}: {
  savings: number;
  buffer: number;
  categories: { id: string; name: string }[];
  selected: string[];
}) {
  const [s, setS] = useState(String(savings));
  const [b, setB] = useState(String(buffer));
  const [ids, setIds] = useState<string[]>(selected);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setMsg(null);
    start(async () => {
      const res = await saveFreeSettings(Number(s.replace(",", ".")), Number(b.replace(",", ".")), ids);
      setMsg(res.ok ? { ok: true, text: "Salvo." } : { ok: false, text: res.error });
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-4">
        <label className="flex min-w-44 flex-1 flex-col gap-1.5">
          <span className="text-xs font-bold text-muted">Guardar da renda (%)</span>
          <input inputMode="decimal" value={s} onChange={(e) => setS(e.target.value)} className={fieldCls} />
        </label>
        <label className="flex min-w-44 flex-1 flex-col gap-1.5">
          <span className="text-xs font-bold text-muted">Colchão para imprevistos (%)</span>
          <input inputMode="decimal" value={b} onChange={(e) => setB(e.target.value)} className={fieldCls} />
        </label>
      </div>
      <div>
        <span className="text-xs font-bold text-muted">Quais categorias são “gasto comigo”?</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {categories.map((c) => {
            const on = ids.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => setIds((x) => (on ? x.filter((i) => i !== c.id) : [...x, c.id]))}
                className={`min-h-10 cursor-pointer rounded-full border px-4 text-[13px] font-bold ${
                  on ? "border-accent bg-accent text-ink" : "border-edge bg-side text-soft hover:border-accent"
                }`}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className="min-h-11 cursor-pointer rounded-xl bg-accent px-5 text-sm font-extrabold text-ink hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "Salvando…" : "Salvar regras"}
        </button>
        {msg && <span className={`text-sm font-semibold ${msg.ok ? "text-income-text" : "text-expense-text"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
