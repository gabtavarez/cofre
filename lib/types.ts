export type Kind = "expense" | "income";
export type Repeat = "none" | "installment" | "fixed";

export type Account = {
  id: string;
  name: string;
  kind: "checking" | "savings" | "cash" | "card" | "investment";
  initial_balance: number;
};

export type Category = {
  id: string;
  name: string;
  kind: Kind;
  monthly_limit: number | null;
};

export type Transaction = {
  id: string;
  account_id: string;
  category_id: string | null;
  kind: Kind;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  paid: boolean;
  repeat: Repeat;
  series_id: string | null;
  installment_no: number | null;
  installments_total: number | null;
  notes: string | null;
};

export const ACCOUNT_KIND_LABEL: Record<Account["kind"], string> = {
  checking: "Conta corrente",
  savings: "Poupança / cofrinho",
  cash: "Dinheiro",
  card: "Cartão",
  investment: "Investimento",
};
