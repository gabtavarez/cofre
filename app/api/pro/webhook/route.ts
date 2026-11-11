import { isPlan, PLANS } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Aviso do Mercado Pago. Não confiamos no corpo recebido: só usamos o id do pagamento e
 * consultamos o pagamento direto na API do Mercado Pago com o nosso token.
 */
export async function POST(request: Request) {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) return new Response("not configured", { status: 503 });

  const url = new URL(request.url);
  const body = (await request.json().catch(() => ({}))) as { type?: string; topic?: string; data?: { id?: string | number } };
  const kind = body.type ?? body.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const id = String(body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");
  if (kind !== "payment" || !/^\d{1,20}$/.test(id)) return new Response("ignored", { status: 200 });

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
  if (!res) return new Response("retry", { status: 502 }); // o MP reenvia
  if (!res.ok) return new Response("not found", { status: res.status === 404 ? 200 : 502 });
  const mp = (await res.json()) as { status?: string; external_reference?: string; transaction_amount?: number; currency_id?: string };

  if (mp.status !== "approved" || !mp.external_reference) return new Response("ok", { status: 200 });

  const admin = createAdminClient();
  const { data: pay } = await admin.from("payments").select("id,user_id,plan,status").eq("id", mp.external_reference).maybeSingle();
  if (!pay || !isPlan(pay.plan)) return new Response("ok", { status: 200 });
  if (pay.status === "approved") return new Response("ok", { status: 200 }); // já processado

  const plan = PLANS[pay.plan];
  if (mp.currency_id !== "BRL" || Number(mp.transaction_amount) + 0.001 < plan.price) return new Response("amount mismatch", { status: 200 });

  // marca como aprovado só se ainda estava pendente (evita conceder duas vezes se o aviso chegar repetido)
  const { data: claimed } = await admin
    .from("payments")
    .update({ status: "approved", mp_payment_id: id })
    .eq("id", pay.id)
    .eq("status", "pending")
    .select("id");
  if (!claimed || claimed.length === 0) return new Response("ok", { status: 200 });

  const { data: cur } = await admin.from("pro_access").select("lifetime,expires_at").eq("user_id", pay.user_id).maybeSingle();
  if (plan.days === null) {
    await admin.from("pro_access").upsert({ user_id: pay.user_id, lifetime: true, expires_at: null, updated_at: new Date().toISOString() });
  } else {
    const base = cur?.expires_at && new Date(cur.expires_at).getTime() > Date.now() ? new Date(cur.expires_at).getTime() : Date.now();
    const expires = new Date(base + plan.days * 86400000).toISOString();
    await admin.from("pro_access").upsert({ user_id: pay.user_id, lifetime: cur?.lifetime ?? false, expires_at: expires, updated_at: new Date().toISOString() });
  }
  return new Response("ok", { status: 200 });
}
