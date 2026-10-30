import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { normalizeDesc } from "@/lib/format";
import type { Account, Category, Transaction } from "@/lib/types";

export type TxWithRefs = Transaction & {
  category: { name: string } | null;
  account: { name: string } | null;
};

const DEFAULT_CATEGORIES: { name: string; kind: "expense" | "income" }[] = [
  { name: "Moradia", kind: "expense" },
  { name: "Alimentação", kind: "expense" },
  { name: "Transporte", kind: "expense" },
  { name: "Saúde", kind: "expense" },
  { name: "Educação", kind: "expense" },
  { name: "Lazer", kind: "expense" },
  { name: "Assinaturas", kind: "expense" },
  { name: "Outros", kind: "expense" },
  { name: "Salário", kind: "income" },
  { name: "Extras", kind: "income" },
];

/** Contas e categorias do usuário; cria o básico no primeiro acesso. */
export const getBase = cache(async function getBase(): Promise<{ accounts: Account[]; categories: Category[] }> {
  const supabase = await createClient();

  const [{ data: accounts }, { data: categories }] = await Promise.all([
    supabase.from("accounts").select("id,name,kind,initial_balance").order("created_at"),
    supabase.from("categories").select("id,name,kind,monthly_limit").order("name"),
  ]);

  if (!categories || categories.length === 0) {
    await supabase.from("categories").insert(DEFAULT_CATEGORIES);
    const { data: seeded } = await supabase
      .from("categories")
      .select("id,name,kind,monthly_limit")
      .order("name");
    return { accounts: (accounts ?? []) as Account[], categories: (seeded ?? []) as Category[] };
  }

  return { accounts: (accounts ?? []) as Account[], categories: categories as Category[] };
});

const REFS = "*, category:categories(name), account:accounts(name)";

/** Cache por requisição: várias partes da mesma página pedem o mesmo intervalo e só uma consulta vai ao banco. */
export const getTransactionsBetween = cache(async function getTransactionsBetween(from: string, to: string): Promise<TxWithRefs[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(REFS)
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TxWithRefs[];
});

type BalanceRow = Pick<Transaction, "kind" | "amount" | "date" | "paid" | "account_id">;

/** Todos os lançamentos (campos leves), buscados uma única vez por requisição. */
const getAllBalanceRows = cache(async function getAllBalanceRows(): Promise<BalanceRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("transactions").select("kind,amount,date,paid,account_id").limit(20000);
  if (error) throw new Error(error.message);
  return (data ?? []) as BalanceRow[];
});

/** Dados leves de todos os lançamentos até `to`, para calcular saldos. */
export async function getBalanceRows(to: string): Promise<BalanceRow[]> {
  return (await getAllBalanceRows()).filter((r) => r.date <= to);
}

export async function getUpcoming(limitDate: string, limit = 5): Promise<TxWithRefs[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(REFS)
    .eq("paid", false)
    .lte("date", limitDate)
    .order("date", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TxWithRefs[];
}

/** Descrição normalizada → categoria mais usada (para sugerir a categoria ao digitar). */
export const getCategoryHints = cache(async function getCategoryHints(): Promise<Record<string, string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transactions")
    .select("description,category_id")
    .not("category_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(600);
  const counts = new Map<string, Map<string, number>>();
  for (const r of data ?? []) {
    const key = normalizeDesc(r.description);
    if (!key) continue;
    const m = counts.get(key) ?? new Map<string, number>();
    m.set(r.category_id as string, (m.get(r.category_id as string) ?? 0) + 1);
    counts.set(key, m);
  }
  const out: Record<string, string> = {};
  for (const [key, m] of counts) out[key] = [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return out;
});


export type Goal = {
  id: string;
  name: string;
  target_amount: number;
  target_date: string | null;
  saved: number;
  investment_id: string | null;
  investment_name: string | null;
};

export async function getGoals(): Promise<Goal[]> {
  const supabase = await createClient();
  const [{ data: goals }, { data: moves }, { data: invs }] = await Promise.all([
    supabase.from("goals").select("id,name,target_amount,target_date,investment_id").order("created_at"),
    supabase.from("goal_moves").select("goal_id,amount").limit(20000),
    supabase.from("investments").select("id,name,current_value"),
  ]);
  const saved = new Map<string, number>();
  for (const m of moves ?? []) saved.set(m.goal_id, (saved.get(m.goal_id) ?? 0) + Number(m.amount));
  const invMap = new Map((invs ?? []).map((i) => [i.id, i]));
  return (goals ?? []).map((g) => {
    const inv = g.investment_id ? invMap.get(g.investment_id) : undefined;
    return {
      id: g.id,
      name: g.name,
      target_amount: Number(g.target_amount),
      target_date: g.target_date,
      saved: inv ? Number(inv.current_value) : Math.round((saved.get(g.id) ?? 0) * 100) / 100,
      investment_id: inv ? inv.id : null,
      investment_name: inv ? inv.name : null,
    };
  });
}

export type InvestmentKind = "renda_fixa" | "acoes" | "fiis" | "cripto" | "tesouro" | "outro";
export const INVESTMENT_KIND_LABEL: Record<InvestmentKind, string> = {
  renda_fixa: "Renda fixa",
  tesouro: "Tesouro Direto",
  acoes: "Ações",
  fiis: "Fundos imobiliários",
  cripto: "Cripto",
  outro: "Outro",
};

export type Investment = {
  id: string;
  name: string;
  kind: InvestmentKind;
  current_value: number;
  invested: number; // aportes − resgates
};

export async function getInvestments(): Promise<Investment[]> {
  const supabase = await createClient();
  const [{ data: invs }, { data: moves }] = await Promise.all([
    supabase.from("investments").select("id,name,kind,current_value").order("created_at"),
    supabase.from("investment_moves").select("investment_id,amount").limit(20000),
  ]);
  const invested = new Map<string, number>();
  for (const m of moves ?? []) invested.set(m.investment_id, (invested.get(m.investment_id) ?? 0) + Number(m.amount));
  return (invs ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    kind: i.kind as InvestmentKind,
    current_value: Number(i.current_value),
    invested: Math.round((invested.get(i.id) ?? 0) * 100) / 100,
  }));
}

export type Debt = {
  id: string;
  name: string;
  creditor: string | null;
  original_amount: number;
  current_balance: number;
  monthly_rate: number; // % ao mês
  monthly_payment: number;
};

export async function getDebts(): Promise<Debt[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("debts")
    .select("id,name,creditor,original_amount,current_balance,monthly_rate,monthly_payment")
    .order("created_at");
  return (data ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    creditor: d.creditor,
    original_amount: Number(d.original_amount),
    current_balance: Number(d.current_balance),
    monthly_rate: Number(d.monthly_rate),
    monthly_payment: Number(d.monthly_payment),
  }));
}

export type NetWorth = { accounts: number; investments: number; debts: number; net: number };

export async function getNetWorth(today: string): Promise<NetWorth> {
  const supabase = await createClient();
  const [{ accounts }, rows, { data: invs }, { data: debts }] = await Promise.all([
    getBase(),
    getBalanceRows(today),
    supabase.from("investments").select("current_value"),
    supabase.from("debts").select("current_balance"),
  ]);
  const initial = accounts.reduce((s, a) => s + a.initial_balance, 0);
  const acc = rows.reduce((s, r) => (r.paid ? s + (r.kind === "income" ? r.amount : -r.amount) : s), initial);
  const inv = (invs ?? []).reduce((s, i) => s + Number(i.current_value), 0);
  const debt = (debts ?? []).reduce((s, d) => s + Number(d.current_balance), 0);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return { accounts: r2(acc), investments: r2(inv), debts: r2(debt), net: r2(acc + inv - debt) };
}

export type Snapshot = { month: string; accounts: number; investments: number; debts: number };

/** Grava (ou atualiza) o retrato do patrimônio do mês e devolve o histórico. */
export async function recordAndGetSnapshots(month: string, nw: NetWorth): Promise<Snapshot[]> {
  const supabase = await createClient();
  await supabase
    .from("net_worth_snapshots")
    .upsert(
      { month, accounts: nw.accounts, investments: nw.investments, debts: nw.debts },
      { onConflict: "user_id,month" },
    );
  const { data } = await supabase
    .from("net_worth_snapshots")
    .select("month,accounts,investments,debts")
    .order("month");
  return (data ?? []).map((r) => ({
    month: r.month,
    accounts: Number(r.accounts),
    investments: Number(r.investments),
    debts: Number(r.debts),
  }));
}

/** Sobra média por mês (receitas − despesas), olhando de 2 meses atrás até 2 meses à frente, só meses com lançamentos. */
export async function getMonthlySurplus(today: string): Promise<{ avg: number; months: number }> {
  const { shiftMonth, monthBounds } = await import("@/lib/dates");
  const cur = today.slice(0, 7);
  const from = monthBounds(shiftMonth(cur, -2)).start;
  const to = monthBounds(shiftMonth(cur, 2)).end;
  const txs = await getTransactionsBetween(from, to);
  const byMonth = new Map<string, number>();
  for (const t of txs) {
    const k = t.date.slice(0, 7);
    byMonth.set(k, (byMonth.get(k) ?? 0) + (t.kind === "income" ? t.amount : -t.amount));
  }
  const vals = [...byMonth.values()];
  if (vals.length === 0) return { avg: 0, months: 0 };
  return { avg: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100, months: vals.length };
}
