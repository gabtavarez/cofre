"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { PrivacyToggle } from "@/components/PrivacyToggle";
import { signOut } from "@/lib/actions";

type IconName = Parameters<typeof Icon>[0]["name"];
type Item = { href: string; label: string; icon: IconName };

const TOP: Item[] = [
  { href: "/", label: "Visão geral", icon: "home" },
  { href: "/lancamentos", label: "Lançamentos", icon: "list" },
  { href: "/contas", label: "Contas", icon: "wallet" },
];

const GROUPS: { id: string; label: string; items: Item[] }[] = [
  {
    id: "planejar",
    label: "Planejar",
    items: [
      { href: "/sem-remorso", label: "Gasto sem remorso", icon: "tag" },
      { href: "/desejos", label: "Lista de desejos", icon: "gift" },
      { href: "/categorias", label: "Categorias e limites", icon: "pie" },
      { href: "/metas", label: "Metas", icon: "target" },
      { href: "/dividas", label: "Dívidas", icon: "debt" },
    ],
  },
  {
    id: "acompanhar",
    label: "Acompanhar",
    items: [
      { href: "/relatorios", label: "Relatórios", icon: "bars" },
      { href: "/patrimonio", label: "Patrimônio", icon: "layers" },
    ],
  },
  {
    id: "investir",
    label: "Investir",
    items: [
      { href: "/investimentos", label: "Investimentos", icon: "trend" },
      { href: "/simulador", label: "Simulador", icon: "calc" },
      { href: "/aprender", label: "Aprender a investir", icon: "book" },
    ],
  },
];

const MORE: Item[] = [
  { href: "/importar", label: "Importar extrato", icon: "upload" },
  { href: "/compartilhar", label: "Compartilhar", icon: "users" },
  { href: "/ajuda", label: "Ajuda e perguntas", icon: "help" },
];

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

function NavLink({ item, pathname, small }: { item: Item; pathname: string; small?: boolean }) {
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-xl px-3.5 whitespace-nowrap ${small ? "min-h-10 text-[13px]" : "min-h-11 text-sm"} ${
        active ? "bg-accent font-extrabold text-ink" : "font-semibold text-muted hover:bg-surface hover:text-text"
      }`}
    >
      <Icon name={item.icon} size={small ? 18 : 20} />
      {item.label}
    </Link>
  );
}

function Groups({ pathname, collapsible }: { pathname: string; collapsible: boolean }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <>
      {GROUPS.map((g) => {
        const hasActive = g.items.some((i) => isActive(pathname, i.href));
        const expanded = !collapsible || (open[g.id] ?? hasActive);
        return (
          <div key={g.id} className="flex flex-col">
            <button
              type="button"
              onClick={() => collapsible && setOpen((o) => ({ ...o, [g.id]: !expanded }))}
              aria-expanded={expanded}
              className="flex min-h-9 w-full cursor-pointer items-center justify-between rounded-lg px-3.5 text-[11px] font-extrabold tracking-[0.12em] text-muted uppercase hover:text-text"
            >
              {g.label}
              {collapsible && (
                <span className={`transition-transform duration-200 ${expanded ? "" : "-rotate-90"}`}>
                  <Icon name="chevron" size={14} stroke={2.2} />
                </span>
              )}
            </button>
            <div className={`grid transition-[grid-template-rows] duration-300 ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {g.items.map((i) => (
                  <NavLink key={i.href} item={i} pathname={pathname} />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const [sheet, setSheet] = useState(false);

  useEffect(() => setSheet(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = sheet ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sheet]);

  const moreActive = !TOP.some((i) => isActive(pathname, i.href));

  return (
    <>
      {/* Celular: barra de topo + abas inferiores + menu completo */}
      <header className="flex items-center justify-between border-b border-line bg-side px-4 py-3 md:hidden">
        <Logo />
        <PrivacyToggle />
      </header>

      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-side/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {TOP.map((i) => {
          const active = isActive(pathname, i.href);
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-bold ${active ? "text-accent" : "text-muted"}`}
            >
              <Icon name={i.icon} size={22} />
              {i.label.replace("Visão geral", "Início")}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setSheet(true)}
          aria-label="Abrir menu completo"
          className={`flex min-h-16 flex-1 cursor-pointer flex-col items-center justify-center gap-1 text-[11px] font-bold ${moreActive ? "text-accent" : "text-muted"}`}
        >
          <Icon name="menu" size={22} />
          Menu
        </button>
      </nav>

      {sheet && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="anim-backdrop absolute inset-0 bg-[#050810]/80" onClick={() => setSheet(false)} />
          <div className="anim-pop absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col gap-3 overflow-y-auto rounded-t-3xl border-t border-edge bg-side px-4 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between px-2">
              <span className="truncate text-xs text-muted">{email}</span>
              <button
                type="button"
                onClick={() => setSheet(false)}
                aria-label="Fechar menu"
                className="flex size-10 cursor-pointer items-center justify-center rounded-xl text-muted hover:bg-surface"
              >
                <Icon name="close" />
              </button>
            </div>
            <Groups pathname={pathname} collapsible={false} />
            <div className="flex flex-col gap-0.5 border-t border-line pt-3">
              {MORE.map((i) => (
                <NavLink key={i.href} item={i} pathname={pathname} />
              ))}
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
          </div>
        </div>
      )}

      {/* Computador */}
      <aside className="hidden w-62 shrink-0 flex-col gap-5 border-r border-line bg-side px-5 py-7 md:sticky md:top-0 md:flex md:h-screen">
        <div className="flex items-center justify-between px-2">
          <Logo />
          <PrivacyToggle />
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1" aria-label="Navegação principal">
          {TOP.map((i) => (
            <NavLink key={i.href} item={i} pathname={pathname} />
          ))}
          <div className="mt-3 flex flex-col gap-1">
            <Groups pathname={pathname} collapsible />
          </div>
        </nav>

        <div className="flex flex-col gap-1 border-t border-line pt-3">
          {MORE.map((i) => (
            <NavLink key={i.href} item={i} pathname={pathname} small />
          ))}
          <p className="truncate px-3.5 pt-2 text-[11px] text-muted" title={email}>
            {email}
          </p>
          <form action={signOut}>
            <button
              type="submit"
              className="flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-xl px-3.5 text-[13px] font-semibold text-muted hover:bg-surface hover:text-text"
            >
              <Icon name="logout" size={18} />
              Sair
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
