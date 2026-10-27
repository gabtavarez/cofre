"use client";

import { useState, useTransition } from "react";
import { Logo } from "@/components/Logo";
import { signIn, signUp } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";

const field =
  "min-h-12 w-full rounded-xl border border-edge bg-side px-3.5 text-sm font-semibold text-text outline-none focus:border-accent";

export default function LoginPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function oauth() {
    setError(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-10">
      <form
        action={(fd) => {
          setError(null);
          startTransition(async () => {
            const res = await (mode === "in" ? signIn(fd) : signUp(fd));
            if (res && !res.ok) setError(res.error);
          });
        }}
        className="flex w-full max-w-sm flex-col gap-5 rounded-3xl border border-line bg-surface p-8"
      >
        <Logo size={40} textClass="text-2xl" />

        <h1 className="text-lg font-bold">{mode === "in" ? "Entrar" : "Criar conta"}</h1>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-muted">E-mail</span>
          <input name="email" type="email" required autoComplete="email" className={field} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-muted">Senha</span>
          <input
            name="password"
            type="password"
            required
            minLength={mode === "up" ? 8 : undefined}
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            className={field}
          />
        </label>

        {error && (
          <p role="alert" className="rounded-xl bg-expense-bg px-4 py-3 text-sm font-semibold text-expense-text">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="min-h-12 cursor-pointer rounded-xl bg-accent text-sm font-extrabold text-ink hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "Aguarde…" : mode === "in" ? "Entrar" : "Criar conta"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "in" ? "up" : "in");
            setError(null);
          }}
          className="min-h-10 cursor-pointer text-[13px] font-semibold text-muted hover:text-text"
        >
          {mode === "in" ? "Primeira vez? Criar conta" : "Já tenho conta"}
        </button>

        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-line" /> ou <span className="h-px flex-1 bg-line" />
        </div>
        <button
          type="button"
          onClick={() => oauth()}
          className="flex min-h-10 cursor-pointer items-center justify-center gap-2.5 rounded-xl text-[13px] font-semibold text-muted transition-colors hover:bg-side hover:text-text"
        >
          <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/>
            <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/>
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
          </svg>
          Entrar com Google
        </button>
      </form>
    </div>
  );
}
