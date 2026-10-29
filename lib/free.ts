import { getBase, getTransactionsBetween } from "@/lib/data";
import { daysInMonth, monthBounds, parseISO, todayISO } from "@/lib/dates";
import { round2 } from "@/lib/finance";
import { createClient } from "@/lib/supabase/server";

export const DEFAULT_FREE =
  /lazer|restaurante|bar\b|jogo|game|roupa|compra|entreten|pessoal|streaming|viagem|hobby|cinema|presente|delivery|ifood|besteira|rol[eê]/i;

export type FreeBudget = {
  income: number;
  budget: number;
  spentFree: number;
  left: number;
  daysLeft: number;
  freeCategories: { id: string; name: string }[];
};

/** Verba "sem remorso" do mês: renda − compromissos − poupança − colchão, menos o já gasto em categorias pessoais. */
export async function getFreeBudget(month: string): Promise<FreeBudget> {
  const { start, end } = monthBounds(month);
  const today = todayISO();
  const supabase = await createClient();
  const [{ categories }, txs, { data: settings }] = await Promise.all([
    getBase(),
    getTransactionsBetween(start, end),
    supabase.from("free_spend_settings").select("savings_pct,buffer_pct,category_ids").maybeSingle(),
  ]);

  const expenseCats = categories.filter((c) => c.kind === "expense");
  const selected = settings
    ? ((settings.category_ids ?? []) as string[]).filter((id) => expenseCats.some((c) => c.id === id))
    : expenseCats.filter((c) => DEFAULT_FREE.test(c.name)).map((c) => c.id);
  const free = new Set(selected);
  const savingsPct = Number(settings?.savings_pct ?? 20);
  const bufferPct = Number(settings?.buffer_pct ?? 10);

  const income = txs.filter((t) => t.kind === "income").reduce((s, t) => s + t.amount, 0);
  const expenses = txs.filter((t) => t.kind === "expense");
  const committed = expenses.filter((t) => !t.category_id || !free.has(t.category_id)).reduce((s, t) => s + t.amount, 0);
  const spentFree = expenses.filter((t) => t.category_id && free.has(t.category_id)).reduce((s, t) => s + t.amount, 0);
  const budget = Math.max(0, round2(income - committed - (income * savingsPct) / 100 - (income * bufferPct) / 100));

  const cur = today.slice(0, 7);
  const { y, m } = parseISO(start);
  const dim = daysInMonth(y, m);
  const daysLeft = month < cur ? 0 : month > cur ? dim : dim - parseISO(today).d + 1;

  return {
    income,
    budget,
    spentFree: round2(spentFree),
    left: round2(budget - spentFree),
    daysLeft,
    freeCategories: expenseCats.filter((c) => free.has(c.id)).map((c) => ({ id: c.id, name: c.name })),
  };
}
