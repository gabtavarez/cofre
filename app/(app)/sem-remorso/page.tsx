import { FreeSettings } from "@/components/FreeSettings";
import { MonthNav } from "@/components/MonthNav";
import { getBase, getTransactionsBetween } from "@/lib/data";
import { daysInMonth, monthBounds, parseISO, resolveMonth, todayISO } from "@/lib/dates";
import { round2 } from "@/lib/finance";
import { brl } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_FREE = /lazer|restaurante|bar\b|jogo|game|roupa|compra|entreten|pessoal|streaming|viagem|hobby|cinema|presente|delivery|ifood|besteira|rol[eê]/i;

export default async function SemRemorso({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const today = todayISO();
  const month = resolveMonth(m);
  const { start, end, days } = monthBounds(month);

  const supabase = await createClient();
  const [{ categories }, txs, { data: settings }] = await Promise.all([
    getBase(),
    getTransactionsBetween(start, end),
    supabase.from("free_spend_settings").select("savings_pct,buffer_pct,category_ids").maybeSingle(),
  ]);

  const expenseCats = categories.filter((c) => c.kind === "expense");
  const savedIds: string[] = settings?.category_ids ?? [];
  const configured = !!settings;
  const selected = configured
    ? savedIds.filter((id) => expenseCats.some((c) => c.id === id))
    : expenseCats.filter((c) => DEFAULT_FREE.test(c.name)).map((c) => c.id);
  const savingsPct = Number(settings?.savings_pct ?? 20);
  const bufferPct = Number(settings?.buffer_pct ?? 10);

  const free = new Set(selected);
  const income = txs.filter((t) => t.kind === "income").reduce((s, t) => s + t.amount, 0);
  const expenses = txs.filter((t) => t.kind === "expense");
  const committed = expenses.filter((t) => !t.category_id || !free.has(t.category_id)).reduce((s, t) => s + t.amount, 0);
  const spentFree = expenses.filter((t) => t.category_id && free.has(t.category_id)).reduce((s, t) => s + t.amount, 0);

  const save = round2((income * savingsPct) / 100);
  const buf = round2((income * bufferPct) / 100);
  const budget = Math.max(0, round2(income - committed - save - buf));
  const left = round2(budget - spentFree);
  const over = left < 0;

  const cur = today.slice(0, 7);
  const dim = daysInMonth(parseISO(start).y, parseISO(start).m);
  const daysLeft = month < cur ? 0 : month > cur ? days : dim - parseISO(today).d + 1;
  const perDay = daysLeft > 0 && !over ? round2(left / daysLeft) : 0;
  const dayOfMonth = month < cur ? dim : month > cur ? 0 : parseISO(today).d;
  const expectedByNow = round2((budget * dayOfMonth) / dim);
  const pctUsed = budget > 0 ? Math.min(100, (spentFree / budget) * 100) : spentFree > 0 ? 100 : 0;
  const paceHigh = month === cur && spentFree > expectedByNow && !over;

  const state = over ? "over" : paceHigh || (budget > 0 && left / budget < 0.2) ? "warn" : "ok";
  const headline =
    income === 0
      ? "Cadastre suas receitas do mês para eu calcular."
      : budget === 0 && !over
        ? "Neste mês não sobra verba depois dos compromissos e da poupança."
        : over
          ? `Você passou ${brl(Math.abs(left))} da verba. Isso sai do seu colchão ou da poupança.`
          : state === "warn"
            ? "Vá com calma: o ritmo está acima do planejado."
            : "Pode gastar sem remorso.";

  const palette = { ok: "bg-accent text-ink", warn: "bg-warn text-[#2a1d00]", over: "bg-expense text-[#230a10]" }[state];

  const parts = [
    { label: "Compromissos", v: committed, cls: "bg-raised" },
    { label: "Poupança", v: save, cls: "bg-invest" },
    { label: "Colchão", v: buf, cls: "bg-warn" },
    { label: "Verba livre", v: budget, cls: "bg-accent" },
  ];
  const total = Math.max(income, committed + save + buf + budget, 1);

  const topFree = expenseCats
    .filter((c) => free.has(c.id))
    .map((c) => ({ name: c.name, v: expenses.filter((t) => t.category_id === c.id).reduce((s, t) => s + t.amount, 0) }))
    .filter((c) => c.v > 0)
    .sort((a, b) => b.v - a.v);

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-muted">Primeiro você se paga, depois se diverte com tranquilidade</span>
          <h1 className="text-3xl font-extrabold">Gasto sem remorso</h1>
        </div>
        <MonthNav month={month} basePath="/sem-remorso" />
      </header>

      <section className={`flex flex-col gap-3 rounded-[20px] p-6 ${palette}`}>
        <span className="text-[13px] font-bold">{headline}</span>
        <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
          <div className="flex flex-col">
            <span className="text-xs font-semibold">{over ? "Passou da verba" : "Ainda pode gastar comigo"}</span>
            <b className="font-display text-4xl">{brl(Math.abs(left))}</b>
          </div>
          {!over && daysLeft > 0 && budget > 0 && (
            <div className="flex flex-col">
              <span className="text-xs font-semibold">Por dia, até o fim do mês</span>
              <b className="font-display text-2xl">{brl(perDay)}</b>
            </div>
          )}
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-black/20">
          <div className="h-full rounded-full bg-black/45 transition-all duration-700" style={{ width: `${pctUsed}%` }} />
        </div>
        <span className="text-xs font-semibold">
          Gasto comigo: {brl(spentFree)} de {brl(budget)}
          {month === cur && budget > 0 ? ` · esperado até hoje: ${brl(expectedByNow)}` : ""}
        </span>
      </section>

      <section className="rounded-[20px] border border-line bg-surface p-5.5">
        <h2 className="mb-1 text-base font-bold">Como chegamos nesse valor</h2>
        <p className="mb-4 text-xs text-muted">
          Da sua renda de {brl(income)}, separamos o que já está comprometido, a poupança e um colchão. O que sobra é seu.
        </p>
        <div className="flex h-4 overflow-hidden rounded-full bg-raised">
          {parts.map((p) => (
            <div key={p.label} className={p.cls} style={{ width: `${(p.v / total) * 100}%` }} title={`${p.label}: ${brl(p.v)}`} />
          ))}
        </div>
        <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {parts.map((p) => (
            <li key={p.label} className="flex items-center gap-2">
              <span className={`size-3 rounded-full ${p.cls}`} />
              <span className="text-soft">{p.label}</span>
              <b className="ml-auto">{brl(p.v)}</b>
            </li>
          ))}
        </ul>
        {topFree.length > 0 && (
          <div className="mt-5 border-t border-line pt-4">
            <span className="text-xs font-bold text-muted">Onde foi o gasto comigo</span>
            <ul className="mt-2 flex flex-col gap-1.5 text-sm">
              {topFree.map((c) => (
                <li key={c.name} className="flex justify-between">
                  <span className="text-soft">{c.name}</span>
                  <b>{brl(c.v)}</b>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-[20px] border border-line bg-surface p-5.5">
        <h2 className="mb-1 text-base font-bold">Suas regras</h2>
        <p className="mb-4 text-xs text-muted">
          {configured
            ? "Ajuste o quanto guarda e quais categorias contam como gasto pessoal."
            : "Sugeri categorias e percentuais comuns (guardar 20%, colchão de 10%). Ajuste e salve para fixar."}
        </p>
        <FreeSettings
          savings={savingsPct}
          buffer={bufferPct}
          categories={expenseCats.map((c) => ({ id: c.id, name: c.name }))}
          selected={selected}
        />
      </section>
    </>
  );
}
