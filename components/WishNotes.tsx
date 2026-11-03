"use client";

import { useEffect, useRef, useState } from "react";
import { saveWishNotes } from "@/lib/actions";

/** Bloco de notas livre (aceita várias linhas), salvo automaticamente. */
export function WishNotes({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);
  const [state, setState] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const last = useRef(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);

  function fit() {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 120), 480)}px`;
  }
  useEffect(fit, [text]);

  async function save(value: string) {
    if (value === last.current) return setState("idle");
    setState("saving");
    const r = await saveWishNotes(value);
    if (r.ok) {
      last.current = value;
      setState("saved");
      setError(null);
    } else {
      setState("error");
      setError(r.error);
    }
  }

  function change(v: string) {
    setText(v);
    setState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(v), 900);
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const status = { idle: "", dirty: "Alterações não salvas…", saving: "Salvando…", saved: "Salvo", error: error ?? "Erro ao salvar" }[state];

  return (
    <section className="rounded-[20px] border border-line bg-surface p-5.5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-bold">Anotações</h2>
        <span className={`text-xs font-semibold ${state === "error" ? "text-expense-text" : state === "saved" ? "text-income-text" : "text-muted"}`} aria-live="polite">
          {status}
        </span>
      </div>
      <textarea
        ref={ta}
        value={text}
        onChange={(e) => change(e.target.value)}
        onBlur={() => {
          if (timer.current) clearTimeout(timer.current);
          if (text !== last.current) save(text);
        }}
        maxLength={20000}
        rows={4}
        placeholder="Escreva livremente: ideias, modelos que gostou, onde achou mais barato, lembretes…"
        className="block min-h-30 w-full resize-y rounded-xl border border-edge bg-side px-3.5 py-3 text-sm leading-relaxed text-text outline-none focus:border-accent"
      />
    </section>
  );
}
