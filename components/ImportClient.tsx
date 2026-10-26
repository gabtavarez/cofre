"use client";

import { useMemo, useState, useTransition } from "react";
import { checkImport, importTransactions } from "@/lib/actions";
import { parseStatement, type ParsedRow } from "@/lib/import";
import { brl, suggestCategory } from "@/lib/format";
import { fieldCls } from "@/components/forms";

type Acc = { id: string; name: string };
type Cat = { id: string; name: string; kind: string };
type Hint = Parameters<typeof suggestCategory>[1];

type Line = ParsedRow & { categoryId: string; status?: "dup" | "maybe"; on: boolean };

export function ImportClient({ accounts, categories, hints }: { accounts: Acc[]; categories: Cat[]; hints: Hint }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [lines, setLines] = useState<Line[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const chosen = useMemo(() => lines.filter((l) => l.on), [lines]);

  async function onFile(file: File | undefined, acc = accountId) {
    setMsg(null);
    if (!file) return;
    const text = await file.text();
    const rows = parseStatement(text, file.name);
    if (rows.length === 0) {
      setLines([]);
      setMsg({ ok: false, text: "Não encontrei lançamentos nesse arquivo. Use OFX ou CSV com colunas de data, descrição e valor." });
      return;
    }
    start(async () => {
      const status = await checkImport(acc, rows);
      setLines(
        rows.map((r) => {
          const s = status[r.externalId];
          return {
            ...r,
            categoryId: (() => {
              const id = suggestCategory(r.description, hints);
              const c = categories.find((x) => x.id === id);
              return c && c.kind === (r.amount > 0 ? "income" : "expense") ? c.id : "";
            })(),
            status: s,
            on: s !== "dup" && s !== "maybe",
          };
        }),
      );
    });
  }

  function submit() {
    start(async () => {
      const res = await importTransactions(
        accountId,
        chosen.map((l) => ({
          date: l.date,
          description: l.description,
          amount: l.amount,
          externalId: l.externalId,
          categoryId: l.categoryId || null,
        })),
      );
      if (res.ok) {
        setMsg({ ok: true, text: `${res.imported} lançamentos importados${res.skipped ? ` (${res.skipped} já existiam)` : ""}.` });
        setLines([]);
      } else setMsg({ ok: false, text: res.error });
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-wrap items-end gap-4 rounded-[20px] border border-line bg-surface p-5">
        <label className="flex min-w-48 flex-col gap-1.5">
          <span className="text-xs font-bold text-muted">Importar para a conta</span>
          <select className={fieldCls} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
        <label className="flex min-w-64 flex-1 flex-col gap-1.5">
          <span className="text-xs font-bold text-muted">Arquivo do extrato (.ofx ou .csv)</span>
          <input
            type="file"
            accept=".ofx,.csv,.txt"
            onChange={(e) => onFile(e.target.files?.[0])}
            className="min-h-12 w-full cursor-pointer rounded-xl border border-dashed border-edge bg-side px-3 py-3 text-sm text-soft file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-1.5 file:font-extrabold file:text-ink"
          />
        </label>
        <p className="w-full text-xs text-muted">
          No app ou site do seu banco procure “Exportar extrato” (OFX é o mais completo). Lançamentos já importados antes são ignorados automaticamente.
        </p>
      </section>

      {msg && (
        <p role="status" className={`rounded-xl px-4 py-3 text-sm font-semibold ${msg.ok ? "bg-income-bg text-income-text" : "bg-expense-bg text-expense-text"}`}>
          {msg.text}
        </p>
      )}

      {lines.length > 0 && (
        <section className="overflow-hidden rounded-[20px] border border-line bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <b>{lines.length} lançamentos no arquivo · {chosen.length} selecionados</b>
            <button
              onClick={submit}
              disabled={pending || chosen.length === 0}
              className="min-h-11 cursor-pointer rounded-xl bg-accent px-5 text-sm font-extrabold text-ink hover:brightness-110 disabled:opacity-50"
            >
              {pending ? "Importando…" : `Importar ${chosen.length}`}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-160 text-sm">
              <thead>
                <tr className="border-t border-line bg-side text-left text-xs text-muted">
                  <th className="w-10 px-5 py-2.5" />
                  <th className="px-2 py-2.5">Data</th>
                  <th className="px-2 py-2.5">Descrição</th>
                  <th className="px-2 py-2.5">Categoria</th>
                  <th className="px-5 py-2.5 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={l.externalId} className="border-t border-line">
                    <td className="px-5 py-2">
                      <input
                        type="checkbox"
                        checked={l.on}
                        onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))}
                        className="size-4 accent-[#c8f169]"
                      />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-soft">{l.date.split("-").reverse().join("/")}</td>
                    <td className="px-2 py-2 font-semibold">
                      {l.description}
                      {l.status === "dup" && <span className="ml-2 rounded-full bg-raised px-2 py-0.5 text-[11px] text-muted">já importado</span>}
                      {l.status === "maybe" && <span className="ml-2 rounded-full bg-warn-bg px-2 py-0.5 text-[11px] text-warn-text">talvez já lançado</span>}
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={l.categoryId}
                        onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, categoryId: e.target.value } : x)))}
                        className="min-h-9 rounded-lg border border-edge bg-side px-2 text-xs font-semibold text-text"
                      >
                        <option value="">Sem categoria</option>
                        {categories
                          .filter((c) => c.kind === (l.amount > 0 ? "income" : "expense"))
                          .map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                      </select>
                    </td>
                    <td className={`px-5 py-2 text-right font-bold whitespace-nowrap ${l.amount > 0 ? "text-income-text" : "text-expense-text"}`}>
                      {l.amount > 0 ? "+" : "−"}{brl(Math.abs(l.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
