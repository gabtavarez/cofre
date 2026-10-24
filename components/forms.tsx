"use client";

import { useRef, useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import type { ActionResult } from "@/lib/actions";

export const fieldCls =
  "min-h-12 w-full rounded-xl border border-edge bg-side px-3.5 text-sm font-semibold text-text outline-none focus:border-accent";

/** Formulário que chama uma server action, mostra erro e limpa ao salvar. */
export function ActionForm({
  action,
  children,
  submitLabel,
}: {
  action: (fd: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  submitLabel: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={ref}
      action={(fd) => {
        setError(null);
        startTransition(async () => {
          const res = await action(fd);
          if (res.ok) ref.current?.reset();
          else setError(res.error);
        });
      }}
      className="flex flex-wrap items-end gap-3"
    >
      {children}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 cursor-pointer rounded-xl bg-accent px-5 text-sm font-extrabold text-ink hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Salvando…" : submitLabel}
      </button>
      {error && (
        <p role="alert" className="w-full rounded-xl bg-expense-bg px-4 py-3 text-sm font-semibold text-expense-text">
          {error}
        </p>
      )}
    </form>
  );
}

export function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-bold text-muted">{label}</span>
      {children}
    </label>
  );
}

export function DeleteButton({
  action,
  label,
}: {
  action: () => Promise<ActionResult>;
  label: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        aria-label={label}
        title={label}
        onClick={() => {
          if (!window.confirm(`${label}?`)) return;
          setError(null);
          startTransition(async () => {
            const res = await action();
            if (!res.ok) setError(res.error);
          });
        }}
        className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-raised hover:text-expense-text disabled:opacity-50"
      >
        <Icon name="trash" size={18} />
      </button>
      {error && <span className="max-w-60 text-right text-xs font-semibold text-expense-text">{error}</span>}
    </span>
  );
}

export function LimitInput({
  initial,
  action,
}: {
  initial: number | null;
  action: (raw: string) => Promise<ActionResult>;
}) {
  const [value, setValue] = useState(initial !== null ? String(initial).replace(".", ",") : "");
  const [state, setState] = useState<"idle" | "saved" | string>("idle");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <input
        inputMode="decimal"
        placeholder="sem limite"
        aria-label="Limite mensal"
        value={value}
        disabled={pending}
        onChange={(e) => {
          setValue(e.target.value);
          setState("idle");
        }}
        onBlur={() => {
          const current = initial !== null ? String(initial).replace(".", ",") : "";
          if (value === current) return;
          startTransition(async () => {
            const res = await action(value);
            setState(res.ok ? "saved" : res.error);
          });
        }}
        className="min-h-10 w-32 rounded-lg border border-edge bg-side px-3 text-right text-sm font-semibold text-text outline-none placeholder:text-muted/60 focus:border-accent"
      />
      {state === "saved" && <span className="text-xs text-income-text">Salvo</span>}
      {state !== "idle" && state !== "saved" && <span className="text-xs text-expense-text">{state}</span>}
    </div>
  );
}
