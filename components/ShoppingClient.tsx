"use client";

import { useState, useTransition } from "react";
import { ActionForm, Field, fieldCls } from "@/components/forms";
import type { ActionResult } from "@/lib/actions";
import { addShopItem, deleteShopItem, finishShopping, toggleShopItem } from "@/lib/actions";
import { brl, parseBRL } from "@/lib/format";

export type ShopItem = { id: string; name: string; qty: number; price: number; checked: boolean };

const line = (i: ShopItem) => Math.round(i.qty * i.price * 100) / 100;

export function ShoppingClient({
  items,
  frequent,
  accounts,
  categories,
  marketId,
  marketName,
  limit,
  spent,
}: {
  items: ShopItem[];
  frequent: ShopItem[];
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  marketId: string;
  marketName: string | null;
  limit: number | null;
  spent: number;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [acc, setAcc] = useState(accounts[0]?.id ?? "");
  const [cat, setCat] = useState(marketId);
  const [total, setTotal] = useState("");

  const estimated = items.reduce((s, i) => s + line(i), 0);
  const inCart = items.filter((i) => i.checked);
  const cartTotal = inCart.reduce((s, i) => s + line(i), 0);
  const noPrice = items.filter((i) => i.price === 0).length;

  const room = limit !== null ? Math.round((limit - spent) * 100) / 100 : null;
  const after = room !== null ? Math.round((room - estimated) * 100) / 100 : null;

  function run(fn: () => Promise<ActionResult>, onOk?: () => void) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (r.ok) onOk?.();
      else setError(r.error);
    });
  }

  function addFrequent(f: ShopItem) {
    const fd = new FormData();
    fd.set("name", f.name);
    fd.set("qty", String(f.qty).replace(".", ","));
    fd.set("price", f.price ? f.price.toFixed(2).replace(".", ",") : "");
    run(() => addShopItem(fd));
  }

  return (
    <>
      <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-6">
        <div className="flex flex-wrap items-end gap-x-10 gap-y-3">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-muted">Total estimado da lista</span>
            <b className="font-display text-3xl">{brl(estimated)}</b>
          </div>
          {room !== null && (
            <div className="flex flex-col">
              <span className="text-xs font-bold text-muted">Ainda cabe em {marketName} este mês</span>
              <b className={`font-display text-3xl ${after !== null && after < 0 ? "text-expense-text" : "text-accent-soft"}`}>{brl(Math.max(0, room))}</b>
            </div>
          )}
        </div>
        {after !== null && (
          <p className={`rounded-xl px-4 py-3 text-sm font-semibold ${after < 0 ? "bg-expense-bg text-expense-text" : "bg-income-bg text-income-text"}`}>
            {after < 0
              ? `A lista passa ${brl(Math.abs(after))} do limite de ${marketName}. Tire itens ou aumente o limite em Categorias.`
              : `Cabe no limite de ${marketName}, e ainda sobram ${brl(after)}.`}
          </p>
        )}
        {limit === null && (
          <p className="text-xs text-muted">
            {marketName
              ? `Defina um limite mensal para ${marketName} em Categorias e limites para eu avisar se a lista cabe.`
              : "Crie uma categoria “Mercado” com limite mensal em Categorias e limites para eu avisar se a lista cabe."}
          </p>
        )}
        {noPrice > 0 && <p className="text-xs text-muted">{noPrice} {noPrice === 1 ? "item está" : "itens estão"} sem preço, então o total pode estar subestimado.</p>}
      </section>

      <section className="rounded-[20px] border border-line bg-surface p-5.5">
        <h2 className="mb-4 text-base font-bold">Adicionar item</h2>
        <ActionForm action={addShopItem} submitLabel="Adicionar">
          <Field label="Item" className="min-w-52 flex-[2_1_0]">
            <input name="name" required maxLength={120} placeholder="Arroz 5kg" className={fieldCls} />
          </Field>
          <Field label="Qtde" className="w-24">
            <input name="qty" inputMode="decimal" defaultValue="1" className={fieldCls} />
          </Field>
          <Field label="Preço unit. (opcional)" className="min-w-36 flex-1">
            <input name="price" inputMode="decimal" placeholder="28,90" className={fieldCls} />
          </Field>
        </ActionForm>
        {frequent.length > 0 && (
          <div className="mt-4">
            <span className="text-xs font-bold text-muted">Itens que você já comprou antes</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {frequent.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  disabled={pending}
                  onClick={() => addFrequent(f)}
                  className="min-h-9 cursor-pointer rounded-full border border-edge bg-side px-3.5 text-[13px] font-semibold text-soft hover:border-accent"
                >
                  + {f.name}
                  {f.price > 0 ? ` · ${brl(f.price)}` : ""}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-[20px] border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <h2 className="text-base font-bold">
            Lista ({items.length}) · no carrinho {inCart.length}
          </h2>
          <button
            type="button"
            disabled={inCart.length === 0}
            onClick={() => {
              setTotal(cartTotal > 0 ? cartTotal.toFixed(2).replace(".", ",") : "");
              setFinishing((v) => !v);
            }}
            className="min-h-10 cursor-pointer rounded-xl bg-accent px-4 text-[13px] font-extrabold text-ink hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Finalizar compra
          </button>
        </div>

        {finishing && (
          <div className="flex flex-wrap items-end gap-3 border-t border-line bg-side px-5 py-4">
            <Field label="Total pago (R$)" className="min-w-32 flex-1">
              <input inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} className={fieldCls} />
            </Field>
            <Field label="Conta" className="min-w-36 flex-1">
              <select value={acc} onChange={(e) => setAcc(e.target.value)} className={fieldCls}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Categoria" className="min-w-36 flex-1">
              <select value={cat} onChange={(e) => setCat(e.target.value)} className={fieldCls}>
                <option value="">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => finishShopping(acc, cat || null, parseBRL(total)), () => setFinishing(false))}
              className="min-h-12 cursor-pointer rounded-xl bg-accent px-5 text-sm font-extrabold text-ink hover:brightness-110 disabled:opacity-60"
            >
              {pending ? "Lançando…" : "Lançar compra"}
            </button>
          </div>
        )}

        {items.length === 0 && <p className="border-t border-line px-5 py-10 text-center text-sm text-muted">A lista está vazia.</p>}
        {items.map((i) => (
          <div key={i.id} className="flex items-center gap-3 border-t border-line px-5 py-3">
            <input
              type="checkbox"
              checked={i.checked}
              disabled={pending}
              onChange={(e) => run(() => toggleShopItem(i.id, e.target.checked))}
              aria-label={`Marcar ${i.name} no carrinho`}
              className="size-5 shrink-0 cursor-pointer accent-[#c8f169]"
            />
            <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${i.checked ? "text-muted line-through" : ""}`}>
              {i.name}
              {i.qty !== 1 && <span className="ml-2 text-xs text-muted">× {String(i.qty).replace(".", ",")}</span>}
            </span>
            <b className="w-24 shrink-0 text-right text-sm">{i.price > 0 ? brl(line(i)) : "—"}</b>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => deleteShopItem(i.id))}
              aria-label={`Remover ${i.name}`}
              className="min-h-9 cursor-pointer rounded-lg px-2.5 text-[13px] font-bold text-muted hover:text-expense-text"
            >
              Remover
            </button>
          </div>
        ))}
        {error && <p className="bg-expense-bg px-5 py-2 text-xs font-semibold text-expense-text">{error}</p>}
      </section>
    </>
  );
}
