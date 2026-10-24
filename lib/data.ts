import { createClient } from "@/lib/supabase/server";
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
export async function getBase(): Promise<{ accounts: Account[]; categories: Category[] }> {
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
}

const REFS = "*, category:categories(name), account:accounts(name)";

export async function getTransactionsBetween(from: string, to: string): Promise<TxWithRefs[]> {
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
}

/** Dados leves de todos os lançamentos até `to`, para calcular saldos. */
export async function getBalanceRows(to: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("kind,amount,date,paid,account_id")
    .lte("date", to)
    .limit(20000);
  if (error) throw new Error(error.message);
  return (data ?? []) as Pick<Transaction, "kind" | "amount" | "date" | "paid" | "account_id">[];
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
