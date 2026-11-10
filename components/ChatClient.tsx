"use client";

import { Fragment, useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };
const KEY = "mymony-chat-v1";

const SUGGESTIONS = [
  "Como está meu mês até agora?",
  "Posso gastar R$ 300 em algo hoje?",
  "Onde estou gastando mais?",
  "Quanto tempo para juntar minhas metas?",
  "Qual dívida devo pagar primeiro?",
  "Como melhorar minha organização financeira?",
];

/** **negrito** e listas com "- " ou "1." — o suficiente para as respostas do assistente. */
function inline(s: string) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <Fragment key={i}>{p}</Fragment>));
}
function Rich({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = (k: number) => {
    if (list.length) {
      out.push(
        <ul key={`l${k}`} className="ml-5 list-disc space-y-1">
          {list.map((it, i) => <li key={i}>{inline(it)}</li>)}
        </ul>,
      );
      list = [];
    }
  };
  text.split("\n").forEach((line, k) => {
    const m = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (m) list.push(m[1]);
    else {
      flush(k);
      if (line.trim()) out.push(<p key={k}>{inline(line)}</p>);
    }
  });
  flush(9999);
  return <div className="flex flex-col gap-2">{out}</div>;
}

export function ChatClient() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) setMsgs(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(msgs.slice(-30)));
    } catch {}
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [msgs, busy]);

  async function send(q: string) {
    const content = q.trim();
    if (!content || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content }];
    setMsgs(next);
    setText("");
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
      if (res.ok && data.reply) setMsgs([...next, { role: "assistant", content: data.reply }]);
      else if (data.error === "not_configured") setError("O assistente ainda não foi ativado neste app (falta a chave da IA).");
      else setError(data.error ?? "Não foi possível responder agora.");
    } catch {
      setError("Sem conexão. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex min-h-[60vh] flex-col gap-4 rounded-[20px] border border-line bg-surface p-4 sm:p-5.5">
      <div className="flex flex-1 flex-col gap-3" aria-live="polite">
        {msgs.length === 0 && (
          <div className="flex flex-col gap-3 py-4">
            <p className="text-sm text-soft">Oi! Eu vejo os seus saldos, lançamentos, metas, dívidas e investimentos e respondo com base neles. Experimente:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="min-h-10 cursor-pointer rounded-full border border-edge bg-side px-4 text-[13px] font-semibold text-soft hover:border-accent hover:text-text">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[80%] ${m.role === "user" ? "self-end bg-accent text-ink" : "self-start bg-raised text-text"}`}>
            {m.role === "user" ? <span className="whitespace-pre-wrap">{m.content}</span> : <Rich text={m.content} />}
          </div>
        ))}
        {busy && (
          <div className="self-start rounded-2xl bg-raised px-4 py-3 text-sm text-muted" role="status">
            Pensando…
          </div>
        )}
        {error && <p className="self-start rounded-xl bg-expense-bg px-4 py-2.5 text-sm font-semibold text-expense-text">{error}</p>}
        <div ref={end} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="flex items-end gap-2"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(text);
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder="Pergunte algo… (Enter envia, Shift+Enter quebra a linha)"
          className="max-h-40 min-h-12 flex-1 resize-none rounded-xl border border-edge bg-side px-3.5 py-3 text-sm text-text outline-none focus:border-accent"
        />
        <button type="submit" disabled={busy || !text.trim()} className="min-h-12 cursor-pointer rounded-xl bg-accent px-5 text-sm font-extrabold text-ink hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
          Enviar
        </button>
        {msgs.length > 0 && (
          <button type="button" onClick={() => { setMsgs([]); setError(null); }} className="min-h-12 cursor-pointer rounded-xl px-3 text-[13px] font-bold text-muted hover:text-text">
            Nova conversa
          </button>
        )}
      </form>
      <p className="text-[11px] text-muted">
        Para responder, um resumo dos seus dados financeiros é enviado ao Google Gemini. As respostas são orientação educativa, não consultoria financeira.
      </p>
    </section>
  );
}
