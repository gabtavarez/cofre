"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { signOut } from "@/lib/actions";

const NAV = [
  { href: "/", label: "Visão geral", icon: "home" },
  { href: "/lancamentos", label: "Lançamentos", icon: "list" },
  { href: "/contas", label: "Contas", icon: "wallet" },
  { href: "/categorias", label: "Categorias e limites", icon: "pie" },
  { href: "/relatorios", label: "Relatórios", icon: "bars" },
  { href: "/metas", label: "Metas", icon: "target" },
  { href: "/investimentos", label: "Investimentos", icon: "trend" },
] as const;

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-full shrink-0 flex-col gap-6 border-b border-line bg-side px-4 py-5 md:sticky md:top-0 md:h-screen md:w-62 md:border-r md:border-b-0 md:px-5 md:py-7 md:gap-8">
      <div className="px-2">
        <Logo />
      </div>

      <nav className="flex gap-1 overflow-x-auto md:flex-col">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3.5 text-sm whitespace-nowrap transition-colors ${
                active
                  ? "bg-accent font-extrabold text-ink"
                  : "font-semibold text-muted hover:bg-surface hover:text-text"
              }`}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="hidden flex-col gap-2 md:mt-auto md:flex">
        <div className="rounded-2xl border border-line bg-surface p-3">
          <p className="truncate text-xs text-muted" title={email}>
            {email}
          </p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3.5 text-sm font-semibold text-muted hover:bg-surface hover:text-text"
          >
            <Icon name="logout" />
            Sair
          </button>
        </form>
      </div>
    </aside>
  );
}
