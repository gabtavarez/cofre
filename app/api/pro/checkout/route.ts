import { isPlan, PLANS } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return Response.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token || !process.env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ error: "not_configured" }, { status: 503 });

  const { plan } = (await request.json().catch(() => ({}))) as { plan?: string };
  if (!isPlan(plan)) return Response.json({ error: "Plano inválido." }, { status: 400 });
  const p = PLANS[plan];

  const { data: owner } = await supabase.rpc("data_owner");
  if (!owner) return Response.json({ error: "Não foi possível identificar a conta." }, { status: 500 });

  const admin = createAdminClient();
  const { data: pay, error: payErr } = await admin.from("payments").insert({ user_id: owner, plan, amount: p.price }).select("id").single();
  if (payErr || !pay) return Response.json({ error: "Não foi possível iniciar o pagamento." }, { status: 500 });

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const origin = `https://${host}`;

  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json", "X-Idempotency-Key": pay.id },
    body: JSON.stringify({
      items: [{ id: plan, title: `Mymony Pro — ${p.label}`, quantity: 1, currency_id: "BRL", unit_price: p.price }],
      external_reference: pay.id,
      notification_url: `${origin}/api/pro/webhook`,
      back_urls: { success: `${origin}/planos?pago=1`, pending: `${origin}/planos?pago=pendente`, failure: `${origin}/planos?pago=falhou` },
      auto_return: "approved",
      statement_descriptor: "MYMONY",
    }),
  }).catch(() => null);

  if (!res?.ok) return Response.json({ error: "O Mercado Pago não respondeu. Tente de novo." }, { status: 502 });
  const pref = (await res.json()) as { init_point?: string };
  if (!pref.init_point) return Response.json({ error: "O Mercado Pago não respondeu. Tente de novo." }, { status: 502 });
  return Response.json({ url: pref.init_point });
}
