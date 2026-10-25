"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { TransactionDialog } from "@/components/TransactionDialog";
import type { Account, Category } from "@/lib/types";

/** Botão flutuante (celular) + atalho "N" (computador) para lançar de qualquer tela. */
export function QuickAdd({
  accounts,
  categories,
  today,
  hints,
}: {
  accounts: Account[];
  categories: Category[];
  today: string;
  hints: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      e.preventDefault();
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Novo lançamento (atalho: N)"
        title="Novo lançamento (N)"
        className="fixed right-5 bottom-5 z-40 flex size-14 cursor-pointer items-center justify-center rounded-full bg-accent text-ink shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:brightness-110 md:hidden"
      >
        <Icon name="plus" size={26} stroke={2.8} />
      </button>
      {open && (
        <TransactionDialog
          accounts={accounts}
          categories={categories}
          today={today}
          hints={hints}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
