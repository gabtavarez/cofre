"use client";

import { useRef, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/actions";
import { fieldCls } from "@/components/forms";

/** Campo de valor + botão que chama uma server action já ligada ao item. */
export function InlineMoney({
  action,
  label,
  placeholder = "0,00",
  tone = "accent",
}: {
  action: (fd: FormData) => Promise<ActionResult>;
  label: string;
  placeholder?: string;
  tone?: "accent" | "muted";
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
      className="flex flex-col gap-1"
    >
      <div className="flex gap-2">
        <input
          name="amount"
          inputMode="decimal"
          required
          placeholder={placeholder}
          aria-label={label}
          className={`${fieldCls} min-h-11 w-28`}
        />
        <button
          type="submit"
          disabled={pending}
          className={`min-h-11 cursor-pointer rounded-xl px-4 text-[13px] font-extrabold whitespace-nowrap disabled:opacity-60 ${
            tone === "accent" ? "bg-accent text-ink hover:brightness-110" : "bg-raised text-soft hover:text-text"
          }`}
        >
          {pending ? "…" : label}
        </button>
      </div>
      {error && <span className="text-xs font-semibold text-expense-text">{error}</span>}
    </form>
  );
}
