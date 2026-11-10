import { buildContext, SYSTEM_PROMPT } from "@/lib/assistant";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

type Msg = { role: "user" | "assistant"; content: string };

// limite simples por usuário (por instância do servidor): 20 mensagens a cada 10 minutos
const hits = new Map<string, number[]>();
function limited(id: string): boolean {
  const now = Date.now();
  const list = (hits.get(id) ?? []).filter((t) => now - t < 10 * 60 * 1000);
  if (list.length >= 20) {
    hits.set(id, list);
    return true;
  }
  list.push(now);
  hits.set(id, list);
  return false;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (!uid) return Response.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: "not_configured" }, { status: 503 });

  let body: { messages?: Msg[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const msgs = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (msgs.length === 0 || msgs[msgs.length - 1].role !== "user") return Response.json({ error: "Escreva uma pergunta." }, { status: 400 });

  if (limited(uid)) return Response.json({ error: "Muitas mensagens seguidas. Aguarde alguns minutos." }, { status: 429 });

  let context: string;
  try {
    context = await buildContext();
  } catch {
    return Response.json({ error: "Não consegui ler seus dados agora." }, { status: 500 });
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: `${SYSTEM_PROMPT}\n\n=== DADOS DA CONTA ===\n${context}\n=== FIM DOS DADOS ===` }] },
      contents: msgs.map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.content }] })),
      generationConfig: { temperature: 0.4, maxOutputTokens: 1200 },
    }),
    signal: AbortSignal.timeout(50000),
  }).catch(() => null);

  if (!res) return Response.json({ error: "O assistente demorou demais. Tente de novo." }, { status: 504 });
  if (res.status === 429) return Response.json({ error: "Limite gratuito do assistente atingido. Tente mais tarde." }, { status: 429 });
  if (!res.ok) return Response.json({ error: "O assistente está indisponível no momento." }, { status: 502 });

  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const reply = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
  if (!reply) return Response.json({ error: "Não consegui gerar uma resposta. Reformule a pergunta." }, { status: 502 });
  return Response.json({ reply });
}
