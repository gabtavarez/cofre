"use client";

import { useState, useTransition } from "react";
import { acceptInvite, removeMember } from "@/lib/actions";

export function ShareButton({ id, kind, label, danger }: { id: string; kind: "accept" | "remove"; label: string; danger?: boolean }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        disabled={pending}
        onClick={() => {
          if (kind === "remove" && !confirm("Tem certeza?")) return;
          start(async () => {
            const r = kind === "accept" ? await acceptInvite(id) : await removeMember(id);
            if (!r.ok) setErr(r.error);
          });
        }}
        className={`min-h-10 cursor-pointer rounded-xl px-4 text-[13px] font-extrabold disabled:opacity-60 ${
          danger ? "bg-expense-bg text-expense-text" : "bg-accent text-ink"
        }`}
      >
        {label}
      </button>
      {err && <span className="text-xs text-expense-text">{err}</span>}
    </span>
  );
}
