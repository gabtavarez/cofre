"use client";

import { useState } from "react";
import { PLAN_IDS, PLANS, PRO_FEATURES, type PlanId } from "@/lib/plans";
import { brl } from "@/lib/format";
import type { ProState } from "@/lib/pro";

export function PlansClient({ pro, configured, paid }: { pro: ProState; configured: boolean; paid: string | null }) {
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(plan: PlanId) {
    setBusy(plan);
    setError(null);
    try {
      const res = await fetch("/api/pro/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan }) });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (data.url) window.location.href = data.url;
      else {
        setError(data.error === "not_configured" ? "Os pagamentos ainda não foram ativados." : (data.error ?? "Não foi possível iniciar o pagamento."));
        setBusy(null);
      }
    } catch {
      setError("Sem conexão. Tente de novo.");
      setBusy(null);
    }
  }

  const status = pro.lifetime
    ? "Você tem o Pro vitalício."
    : pro.active && pro.expiresAt
      ? `Seu Pro vai até ${new Date(pro.expiresAt).toLocaleDateString("pt-BR")}. Comprar de novo soma ao tempo que sobrou.`
      : null;

  return (
    <>
      {paid === "1" && !pro.active && (
        <p className="rounded-xl bg-side px-4 py-3 text-sm text-soft">Pagamento recebido! A liberação pode levar alguns instantes (no Pix, é quase imediata). Recarregue a página em seguida.</p>
      )}
      {paid === "pendente" && <p className="rounded-xl bg-side px-4 py-3 text-sm text-soft">Pagamento pendente. Assim que o Mercado Pago confirmar, o Pro é liberado sozinho.</p>}
      {paid === "falhou" && <p className="rounded-xl bg-expense-bg px-4 py-3 text-sm font-semibold text-expense-text">O pagamento não foi concluído. Você pode tentar de novo.</p>}
      {status && <p className="rounded-xl bg-accent-bg px-4 py-3 text-sm font-bold text-accent-soft">{status}</p>}

      <section className="grid gap-4 sm:grid-cols-3">
        {PLAN_IDS.map((id) => {
          const p = PLANS[id];
          return (
            <div key={id} className={`flex flex-col gap-3 rounded-[20px] border bg-surface p-5.5 ${id === "1y" ? "border-accent" : "border-line"}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold">{p.label}</h2>
                {id === "1y" && <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-extrabold text-ink">Melhor custo</span>}
              </div>
              <b className="font-display text-3xl">{brl(p.price)}</b>
              <span className="text-xs text-muted">{p.blurb}</span>
              <button
                type="button"
                disabled={!configured || busy !== null}
                onClick={() => buy(id)}
                className="mt-auto min-h-12 cursor-pointer rounded-xl bg-accent px-4 text-sm font-extrabold text-ink hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy === id ? "Abrindo…" : "Pagar com Pix ou cartão"}
              </button>
            </div>
          );
        })}
      </section>
      {!configured && <p className="text-xs text-muted">Os pagamentos ainda não foram ativados neste app.</p>}
      {error && <p className="rounded-xl bg-expense-bg px-4 py-2.5 text-sm font-semibold text-expense-text">{error}</p>}

      <section className="rounded-[20px] border border-line bg-surface p-5.5">
        <h2 className="mb-3 text-base font-bold">O que o Pro libera</h2>
        <ul className="grid gap-2 text-sm text-soft sm:grid-cols-2">
          {PRO_FEATURES.map((f) => (
            <li key={f} className="flex gap-2"><span className="text-accent-soft">✓</span>{f}</li>
          ))}
        </ul>
        <p className="mt-4 text-[11px] text-muted">Todo o controle financeiro do dia a dia (lançamentos, contas, metas, dívidas, Gasto sem remorso e desejos) continua grátis. Pagamento processado pelo Mercado Pago; o app não vê nem guarda dados do seu cartão.</p>
      </section>
    </>
  );
}
