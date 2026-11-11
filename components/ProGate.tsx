import Link from "next/link";
import { getPro } from "@/lib/pro";

/** Para páginas Pro: devolve a tela de upgrade quando o plano não está ativo; senão null. */
export async function proGate(feature: string, why: string) {
  if ((await getPro()).active) return null;
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-[20px] border border-line bg-surface px-6 py-12 text-center">
      <span className="rounded-full bg-accent-bg px-3 py-1 text-xs font-extrabold text-accent-soft">PRO</span>
      <h1 className="text-2xl font-extrabold">{feature}</h1>
      <p className="text-sm text-soft">{why}</p>
      <Link href="/planos" className="min-h-12 rounded-xl bg-accent px-6 py-3.5 text-sm font-extrabold text-ink hover:brightness-110">
        Ver planos
      </Link>
    </section>
  );
}
