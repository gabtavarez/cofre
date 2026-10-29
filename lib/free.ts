import { getBalanceRows, getBase, getTransactionsBetween } from "@/lib/data";
import { daysInMonth, monthBounds, parseISO, todayISO } from "@/lib/dates";
import { round2, signed } from "@/lib/finance";
import { createClient } from "@/lib/supabase/server";

export const DEFAULT_FREE =
  /lazer|restaurante|bar\b|jogo|game|roupa|compra|entreten|pessoal|streaming|viagem|hobby|cinema|presente|delivery|ifood|besteira|rol[eê]/i;

export type FreeBudget = {
  income: number;
  opening: number; // saldo que já havia antes do mês
  committed: number;
  save: number;
  buffer: number;
  configured: boolean;
  savingsPct: number;
  bufferPct: number;
  selected: string[];
  expenseCategories: { id: string; name: string }[];
  spentByCategory: { name: string; v: number }[];
  reserved: number; // poupança + colchão
  budget: number;
  spentFree: number;
  left: number;
  daysLeft: number;
  freeCategories: { id: string; name: string }[];
};

/** Verba "sem remorso" do mês: (saldo anterior + renda) − compromissos − poupança − colchão, menos o já gasto em categorias pessoais. */
export async function getFreeBudget(month: string): Promise<FreeBudget> {
  const { start, end } = monthBounds(month);
  const today = todayISO();
  const supabase = await createClient();
  const [{ accounts, categories }, txs, rows, { data: settings }] = await Promise.all([
    getBase(),
    getTransactionsBetween(start, end),
    getBalanceRows(end),
    supabase.from("free_spend_settings").select("savings_pct,buffer_pct,category_ids").maybeSingle(),
  ]);

  const expenseCats = categories.filter((c) => c.kind === "expense");
  const selected = settings
    ? ((settings.category_ids ?? []) as string[]).filter((id) => expenseCats.some((c) => c.id === id))
    : expenseCats.filter((c) => DEFAULT_FREE.test(c.name)).map((c) => c.id);
  const free = new Set(selected);
  const savingsPct = Number(settings?.savings_pct ?? 20);
  const bufferPct = Number(settings?.buffer_pct ?? 10);

  const initial = accounts.reduce((a, c) => a + c.initial_balance, 0);
  const opening = Math.max(0, round2(rows.filter((r) => r.date < start).reduce((a, r) => a + signed(r), initial)));
  const income = txs.filter((t) => t.kind === "income").reduce((s, t) => s + t.amount, 0);
  const expenses = txs.filter((t) => t.kind === "expense");
  const committed = expenses.filter((t) => !t.category_id || !free.has(t.category_id)).reduce((s, t) => s + t.amount, 0);
  const spentFree = expenses.filter((t) => t.category_id && free.has(t.category_id)).reduce((s, t) => s + t.amount, 0);
  // Base = dinheiro que já estava na conta + receitas do mês.
  const base = income + opening;
  const save = round2((base * savingsPct) / 100);
  const buffer = round2((base * bufferPct) / 100);
  const reserved = round2(save + buffer);
  const budget = Math.max(0, round2(base - committed - reserved));

  const cur = today.slice(0, 7);
  const { y, m } = parseISO(start);
  const dim = daysInMonth(y, m);
  const daysLeft = month < cur ? 0 : month > cur ? dim : dim - parseISO(today).d + 1;

  return {
    income,
    opening,
    committed: round2(committed),
    save,
    buffer,
    configured: !!settings,
    savingsPct,
    bufferPct,
    selected,
    expenseCategories: expenseCats.map((c) => ({ id: c.id, name: c.name })),
    spentByCategory: expenseCats
      .filter((c) => free.has(c.id))
      .map((c) => ({ name: c.name, v: expenses.filter((t) => t.category_id === c.id).reduce((a, t) => a + t.amount, 0) }))
      .filter((c) => c.v > 0)
      .sort((a, b) => b.v - a.v),
    reserved,
    budget,
    spentFree: round2(spentFree),
    left: round2(budget - spentFree),
    daysLeft,
    freeCategories: expenseCats.filter((c) => free.has(c.id)).map((c) => ({ id: c.id, name: c.name })),
  };
}
