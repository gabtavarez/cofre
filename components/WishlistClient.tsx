"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { ActionForm, Field, fieldCls } from "@/components/forms";
import { addWish, buyWish, deleteWish } from "@/lib/actions";
import { brl, parseBRL } from "@/lib/format";

export type Wish = {
  id: string;
  name: string;
  price: number;
  priority: 1 | 2 | 3;
  url: string | null;
  waitUntil: string | null;
  boughtAt: string | null;
};

const PRIO: Record<number, { label: string; cls: string }> = {
  3: { label: "Alta", cls: "bg-accent-bg text-accent-soft" },
  2: { label: "Média", cls: "bg-raised text-soft" },
  1: { label: "Baixa", cls: "bg-raised text-muted" },
};

const dmy = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

export function WishlistClient({
  wishes,
  today,
  left,
  budget,
  accounts,
  categories,
}: {
  wishes: Wish[];
  today: string;
  left: number;
  budget: number;
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string }[];
}) {
  const [buying, setBuying] = useState<string | null>(null);

  const { active, bought, suggestion, suggestedIds, remaining } = useMemo(() => {
    const act = wishes.filter((w) => !w.boughtAt);
    const ready = act
      .filter((w) => !w.waitUntil || w.waitUntil <= today)
      .sort((a, b) => b.priority - a.priority || a.price - b.price);
    let room = Math.max(0, left);
    const picked: Wish[] = [];
    for (const w of ready) {
      if (w.price <= room) {
        picked.push(w);
        room = Math.round((room - w.price) * 100) / 100;
      }
    }
    return {
      active: act.sort((a, b) => b.priority - a.priority || a.price - b.price),
      bought: wishes.filter((w) => w.boughtAt),
      suggestion: picked,
      suggestedIds: new Set(picked.map((p) => p.id)),
      remaining: room,
    };
  }, [wishes, today, left]);

  function statusOf(w: Wish): { text: string; tone: "ok" | "wait" | "later" } {
    if (w.waitUntil && w.waitUntil > today) return { text: `Esperando até ${dmy(w.waitUntil)}`, tone: "wait" };
    if (w.price <= left) return { text: suggestedIds.has(w.id) ? "Cabe agora · sugerido" : "Cabe agora", tone: "ok" };
    if (budget <= 0) return { text: "Sem verba neste mês", tone: "later" };
    if (w.price <= budget) return { text: "Cabe na verba do mês que vem", tone: "later" };
    const months = Math.ceil(w.price / budget);
    return { text: `Juntando a verba de ${months} meses`, tone: "later" };
  }

  return (
    <>
      <section className="flex flex-col gap-3 rounded-[20px] bg-accent p-6 text-ink">
        <span className="text-xs font-bold">Verba sem remorso que ainda sobra neste mês</span>
        <b className="font-display text-4xl">{brl(Math.max(0, left))}</b>
        {suggestion.length > 0 ? (
          <p className="text-sm font-semibold">
            Sugestão para agora: {suggestion.map((s) => `${s.name} (${brl(s.price)})`).join(" + ")}
            {remaining > 0 ? ` · sobram ${brl(remaining)}` : ""}.
          </p>
        ) : (
          <p className="text-sm font-semibold">
            {budget <= 0
              ? "Ainda não há verba calculada. Cadastre as receitas do mês e ajuste as regras em Gasto sem remorso."
              : active.length === 0
                ? "Adicione itens abaixo e eu digo o que cabe."
                : "Nenhum item pronto cabe na verba que sobrou agora."}
          </p>
        )}
        <Link href="/sem-remorso" className="text-xs font-bold underline">
          Ver como essa verba é calculada
        </Link>
      </section>

      <section className="rounded-[20px] border border-line bg-surface p-5.5">
        <h2 className="mb-4 text-base font-bold">Novo desejo</h2>
        <ActionForm action={addWish} submitLabel="Adicionar">
          <Field label="O que você quer?" className="min-w-52 flex-[2_1_0]">
            <input name="name" required maxLength={120} placeholder="Fone bluetooth" className={fieldCls} />
          </Field>
          <Field label="Preço (R$)" className="min-w-32 flex-1">
            <input name="price" required inputMode="decimal" placeholder="180,00" className={fieldCls} />
          </Field>
          <Field label="Prioridade" className="min-w-32 flex-1">
            <select name="priority" defaultValue="2" className={fieldCls}>
              <option value="3">Alta</option>
              <option value="2">Média</option>
              <option value="1">Baixa</option>
            </select>
          </Field>
          <Field label="Link (opcional)" className="min-w-52 flex-[2_1_0]">
            <input name="url" type="url" placeholder="https://" className={fieldCls} />
          </Field>
          <label className="flex min-h-12 cursor-pointer items-center gap-2 text-[13px] font-semibold text-soft">
            <input type="checkbox" name="wait" className="size-4 accent-[#c8f169]" />
            Esperar 7 dias antes de comprar
          </label>
        </ActionForm>
      </section>

      <section className="overflow-hidden rounded-[20px] border border-line bg-surface">
        <h2 className="px-5 py-4 text-base font-bold">Quero comprar ({active.length})</h2>
        {active.length === 0 && <p className="border-t border-line px-5 py-10 text-center text-sm text-muted">Nada na lista ainda.</p>}
        {active.map((w) => {
          const st = statusOf(w);
          return (
            <WishRow
              key={w.id}
              w={w}
              status={st}
              open={buying === w.id}
              onBuy={() => setBuying(buying === w.id ? null : w.id)}
              onDone={() => setBuying(null)}
              accounts={accounts}
              categories={categories}
              canBuyNow={!(w.waitUntil && w.waitUntil > today)}
            />
          );
        })}
      </section>

      {bought.length > 0 && (
        <section className="overflow-hidden rounded-[20px] border border-line bg-surface">
          <h2 className="px-5 py-4 text-base font-bold">Já comprei ({bought.length})</h2>
          {bought.map((w) => (
            <div key={w.id} className="flex items-center gap-3 border-t border-line px-5 py-3 text-sm">
              <span className="text-income">✓</span>
              <span className="min-w-0 flex-1 truncate font-semibold text-soft">{w.name}</span>
              <span className="text-xs text-muted">{w.boughtAt && dmy(w.boughtAt)}</span>
              <b>{brl(w.price)}</b>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

function WishRow({
  w,
  status,
  open,
  onBuy,
  onDone,
  accounts,
  categories,
  canBuyNow,
}: {
  w: Wish;
  status: { text: string; tone: "ok" | "wait" | "later" };
  open: boolean;
  onBuy: () => void;
  onDone: () => void;
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  canBuyNow: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [acc, setAcc] = useState(accounts[0]?.id ?? "");
  const [cat, setCat] = useState(categories[0]?.id ?? "");
  const [amount, setAmount] = useState(w.price.toFixed(2).replace(".", ","));

  const tone = { ok: "bg-income-bg text-income-text", wait: "bg-warn-bg text-warn-text", later: "bg-raised text-muted" }[status.tone];

  return (
    <div className="border-t border-line">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
        <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-1">
          <span className="flex items-center gap-2">
            <b className="truncate text-sm">{w.name}</b>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${PRIO[w.priority].cls}`}>{PRIO[w.priority].label}</span>
          </span>
          <span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-bold ${tone}`}>{status.text}</span>
        </div>
        {w.url && (
          <a href={w.url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-accent-soft hover:underline">
            Abrir link
          </a>
        )}
        <b className="w-28 text-right text-sm">{brl(w.price)}</b>
        <button
          type="button"
          onClick={onBuy}
          disabled={!canBuyNow}
          title={canBuyNow ? "Marcar como comprado" : "Ainda dentro do prazo de espera"}
          className="min-h-10 cursor-pointer rounded-xl bg-accent px-4 text-[13px] font-extrabold text-ink hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Comprei
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm(`Remover "${w.name}" da lista?`)) return;
            start(async () => {
              const r = await deleteWish(w.id);
              if (!r.ok) setError(r.error);
            });
          }}
          aria-label={`Remover ${w.name}`}
          className="min-h-10 cursor-pointer rounded-xl px-3 text-[13px] font-bold text-muted hover:text-expense-text"
        >
          Remover
        </button>
      </div>

      {open && (
        <div className="flex flex-wrap items-end gap-3 bg-side px-5 py-4">
          <Field label="Valor pago (R$)" className="min-w-32 flex-1">
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={fieldCls} />
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
            onClick={() => {
              setError(null);
              start(async () => {
                const r = await buyWish(w.id, acc, cat || null, parseBRL(amount));
                if (r.ok) onDone();
                else setError(r.error);
              });
            }}
            className="min-h-12 cursor-pointer rounded-xl bg-accent px-5 text-sm font-extrabold text-ink hover:brightness-110 disabled:opacity-60"
          >
            {pending ? "Lançando…" : "Confirmar e lançar"}
          </button>
        </div>
      )}
      {error && <p className="bg-expense-bg px-5 py-2 text-xs font-semibold text-expense-text">{error}</p>}
    </div>
  );
}
