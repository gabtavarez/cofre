"use client";

import { useState, useTransition } from "react";
import { Logo } from "@/components/Logo";
import { signIn, signUp } from "@/lib/actions";

const field =
  "min-h-12 w-full rounded-xl border border-edge bg-side px-3.5 text-sm font-semibold text-text outline-none focus:border-accent";

export default function LoginPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
      </form>
    </div>
  );
}
