"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addMonths } from "@/lib/dates";
import { parseBRL, splitInstallments } from "@/lib/format";

export type ActionResult = { ok: true } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// Quantos meses gerar para lançamentos fixos (recorrentes).
const FIXED_MONTHS = 12;
// Quantos anos gerar para lançamentos anuais.
const YEARLY_COUNT = 5;

/* ───────────── Lançamentos ───────────── */

export async function createTransaction(fd: FormData): Promise<ActionResult> {
  const kind = str(fd, "kind");
  const description = str(fd, "description");
  const date = str(fd, "date");
  const repeat = str(fd, "repeat") || "none";
  const accountId = str(fd, "account_id");
  const categoryId = str(fd, "category_id") || null;
  const paid = fd.get("paid") === "on";
  const amount = parseBRL(str(fd, "amount"));
  const count = Math.max(1, Math.min(120, Number(str(fd, "count")) || 1));

  if (kind !== "expense" && kind !== "income") return fail("Tipo inválido.");
  if (!description) return fail("Informe uma descrição.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Data inválida.");
  if (!accountId) return fail("Escolha uma conta.");
  if (!Number.isFinite(amount) || amount <= 0) return fail("Informe um valor maior que zero.");
  if (!["none", "installment", "fixed", "yearly"].includes(repeat)) return fail("Repetição inválida.");

  const base = {
    kind,
    description,
    account_id: accountId,
    category_id: categoryId,
  };

  let rows: Record<string, unknown>[];

  if (repeat === "installment" && count > 1) {
    const seriesId = crypto.randomUUID();
    const parts = splitInstallments(amount, count);
    rows = parts.map((value, i) => ({
      ...base,
      amount: value,
      date: addMonths(date, i),
      paid: i === 0 ? paid : false,
      repeat: "installment",
      series_id: seriesId,
      installment_no: i + 1,
      installments_total: count,
    }));
  } else if (repeat === "fixed") {
    const seriesId = crypto.randomUUID();
    rows = Array.from({ length: FIXED_MONTHS }, (_, i) => ({
      ...base,
      amount,
      date: addMonths(date, i),
      paid: i === 0 ? paid : false,
      repeat: "fixed",
      series_id: seriesId,
    }));
  } else if (repeat === "yearly") {
    const seriesId = crypto.randomUUID();
    rows = Array.from({ length: YEARLY_COUNT }, (_, i) => ({
      ...base,
      amount,
      date: addMonths(date, i * 12),
      paid: i === 0 ? paid : false,
      repeat: "yearly",
      series_id: seriesId,
    }));
  } else {
    rows = [{ ...base, amount, date, paid, repeat: "none" }];
  }

  const supabase = await createClient();
  const { error } = await supabase.from("transactions").insert(rows);
  if (error) return fail(error.message);

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Edita um lançamento. scope "future": propaga descrição, categoria, conta (e valor, nas fixas) aos próximos da série. */
export async function updateTransaction(fd: FormData): Promise<ActionResult> {
  const id = str(fd, "id");
  const kind = str(fd, "kind");
  const description = str(fd, "description");
  const date = str(fd, "date");
  const accountId = str(fd, "account_id");
  const categoryId = str(fd, "category_id") || null;
  const paid = fd.get("paid") === "on";
  const amount = parseBRL(str(fd, "amount"));
  const scope = str(fd, "scope") === "future" ? "future" : "one";

  if (!id) return fail("Lançamento inválido.");
  if (kind !== "expense" && kind !== "income") return fail("Tipo inválido.");
  if (!description) return fail("Informe uma descrição.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Data inválida.");
  if (!accountId) return fail("Escolha uma conta.");
  if (!Number.isFinite(amount) || amount <= 0) return fail("Informe um valor maior que zero.");

  const supabase = await createClient();
  const { data: tx, error: readErr } = await supabase
    .from("transactions")
    .select("series_id,date,repeat")
    .eq("id", id)
    .single();
  if (readErr || !tx) return fail("Lançamento não encontrado.");

  const { error } = await supabase
    .from("transactions")
    .update({ kind, description, date, account_id: accountId, category_id: categoryId, paid, amount })
    .eq("id", id);
  if (error) return fail(error.message);

  if (scope === "future" && tx.series_id) {
    const shared: Record<string, unknown> = {
      kind,
      description,
      account_id: accountId,
      category_id: categoryId,
    };
    if (tx.repeat === "fixed" || tx.repeat === "yearly") shared.amount = amount;
    const { error: futErr } = await supabase
      .from("transactions")
      .update(shared)
      .eq("series_id", tx.series_id)
      .gt("date", tx.date)
      .neq("id", id);
    if (futErr) return fail(futErr.message);
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setPaid(id: string, paid: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").update({ paid }).eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** scope "one": só este; "future": este e os próximos da mesma série. */
export async function deleteTransaction(
  id: string,
  scope: "one" | "future" = "one",
): Promise<ActionResult> {
  const supabase = await createClient();

  if (scope === "future") {
    const { data: tx } = await supabase
      .from("transactions")
      .select("series_id,date")
      .eq("id", id)
      .single();
    if (tx?.series_id) {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("series_id", tx.series_id)
        .gte("date", tx.date);
      if (error) return fail(error.message);
      // série encerrada: não renovar automaticamente
      await supabase.from("transactions").update({ auto_renew: false }).eq("series_id", tx.series_id);
      revalidatePath("/", "layout");
      return { ok: true };
    }
  }

  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Ajusta o saldo de uma conta numa data criando uma receita/despesa (já paga) com a diferença. */
export async function adjustBalance(fd: FormData): Promise<ActionResult> {
  const accountId = str(fd, "account_id");
  const date = str(fd, "date");
  const categoryId = str(fd, "category_id") || null;
  const debtor = str(fd, "sign") === "debtor";
  const raw = parseBRL(str(fd, "balance"));

  if (!accountId) return fail("Conta inválida.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Data inválida.");
  if (!Number.isFinite(raw) || raw < 0) return fail("Informe o novo saldo.");
  const target = debtor ? -raw : raw;

  const supabase = await createClient();
  const [{ data: acc }, { data: rows, error }] = await Promise.all([
    supabase.from("accounts").select("initial_balance").eq("id", accountId).single(),
    supabase
      .from("transactions")
      .select("kind,amount")
      .eq("account_id", accountId)
      .eq("paid", true)
      .lte("date", date),
  ]);
  if (!acc || error) return fail("Conta não encontrada.");

  const current = (rows ?? []).reduce(
    (s, t) => s + (t.kind === "income" ? Number(t.amount) : -Number(t.amount)),
    Number(acc.initial_balance),
  );
  const diff = Math.round((target - current) * 100) / 100;
  if (diff === 0) return fail("O saldo já é esse nessa data.");

  const { error: insErr } = await supabase.from("transactions").insert({
    account_id: accountId,
    category_id: categoryId,
    kind: diff > 0 ? "income" : "expense",
    description: "Ajuste de saldo",
    amount: Math.abs(diff),
    date,
    paid: true,
    repeat: "none",
  });
  if (insErr) return fail(insErr.message);

  revalidatePath("/", "layout");
  return { ok: true };
}

/* ───────────── Contas ───────────── */

export async function createAccount(fd: FormData): Promise<ActionResult> {
  const name = str(fd, "name");
  const kind = str(fd, "kind") || "checking";
  const raw = str(fd, "initial_balance");
  const initial = raw ? parseBRL(raw) : 0;
  if (!name) return fail("Informe o nome da conta.");
  if (!Number.isFinite(initial)) return fail("Saldo inicial inválido.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("accounts")
    .insert({ name, kind, initial_balance: initial });
  if (error) return fail(error.message);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) {
    return fail(
      error.code === "23503"
        ? "Esta conta tem lançamentos. Apague ou mova os lançamentos antes."
        : error.message,
    );
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ───────────── Categorias ───────────── */

export async function createCategory(fd: FormData): Promise<ActionResult> {
  const name = str(fd, "name");
  const kind = str(fd, "kind");
  const raw = str(fd, "monthly_limit");
  const limit = raw ? parseBRL(raw) : null;
  if (!name) return fail("Informe o nome da categoria.");
  if (kind !== "expense" && kind !== "income") return fail("Tipo inválido.");
  if (limit !== null && (!Number.isFinite(limit) || limit < 0)) return fail("Limite inválido.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .insert({ name, kind, monthly_limit: kind === "expense" ? limit : null });
  if (error) return fail(error.message);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setCategoryLimit(id: string, raw: string): Promise<ActionResult> {
  const limit = raw.trim() ? parseBRL(raw) : null;
  if (limit !== null && (!Number.isFinite(limit) || limit < 0)) return fail("Limite inválido.");
  const supabase = await createClient();
  const { error } = await supabase.from("categories").update({ monthly_limit: limit }).eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ───────────── Auth ───────────── */

export async function signIn(fd: FormData): Promise<ActionResult> {
  const email = str(fd, "email");
  const password = String(fd.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return fail("E-mail ou senha incorretos.");
  redirect("/");
}

export async function signUp(fd: FormData): Promise<ActionResult> {
  const email = str(fd, "email");
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) return fail("A senha precisa ter pelo menos 8 caracteres.");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return fail(error.message);
  if (!data.session) return fail("Conta criada. Confirme o e-mail para entrar.");
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/* ───────────── Metas ───────────── */

export async function createGoal(fd: FormData): Promise<ActionResult> {
  const name = str(fd, "name");
  const target = parseBRL(str(fd, "target_amount"));
  const date = str(fd, "target_date") || null;
  if (!name) return fail("Dê um nome para a meta.");
  if (!Number.isFinite(target) || target <= 0) return fail("Informe o valor da meta.");
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Data inválida.");
  const supabase = await createClient();
  const investmentId = str(fd, "investment_id") || null;
  const { error } = await supabase
    .from("goals")
    .insert({ name, target_amount: target, target_date: date, investment_id: investmentId });
  if (error) return fail(error.message);
  revalidatePath("/metas");
  return { ok: true };
}

export async function deleteGoal(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/metas");
  return { ok: true };
}

/** Guardar (positivo) ou retirar (negativo) dinheiro de uma meta. */
export async function addGoalMove(goalId: string, withdraw: boolean, fd: FormData): Promise<ActionResult> {
  const v = parseBRL(str(fd, "amount"));
  if (!Number.isFinite(v) || v <= 0) return fail("Informe um valor maior que zero.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("goal_moves")
    .insert({ goal_id: goalId, amount: withdraw ? -v : v });
  if (error) return fail(error.message);
  revalidatePath("/metas");
  return { ok: true };
}

/* ───────────── Investimentos ───────────── */

const INVESTMENT_KINDS = ["renda_fixa", "acoes", "fiis", "cripto", "tesouro", "outro"];

export async function createInvestment(fd: FormData): Promise<ActionResult> {
  const name = str(fd, "name");
  const kind = str(fd, "kind") || "renda_fixa";
  const initial = str(fd, "amount") ? parseBRL(str(fd, "amount")) : 0;
  if (!name) return fail("Dê um nome ao investimento.");
  if (!INVESTMENT_KINDS.includes(kind)) return fail("Tipo inválido.");
  if (!Number.isFinite(initial) || initial < 0) return fail("Valor inválido.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("investments")
    .insert({ name, kind, current_value: initial })
    .select("id")
    .single();
  if (error || !data) return fail(error?.message ?? "Erro ao salvar.");
  if (initial > 0) {
    const { error: e2 } = await supabase.from("investment_moves").insert({ investment_id: data.id, amount: initial });
    if (e2) return fail(e2.message);
  }
  revalidatePath("/investimentos");
  return { ok: true };
}

export async function deleteInvestment(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("investments").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/investimentos");
  return { ok: true };
}

/** Aporte (soma ao valor atual e ao investido) ou resgate. */
export async function addInvestmentMove(id: string, withdraw: boolean, fd: FormData): Promise<ActionResult> {
  const v = parseBRL(str(fd, "amount"));
  if (!Number.isFinite(v) || v <= 0) return fail("Informe um valor maior que zero.");
  const supabase = await createClient();
  const { data: inv, error: readErr } = await supabase
    .from("investments")
    .select("current_value")
    .eq("id", id)
    .single();
  if (readErr || !inv) return fail("Investimento não encontrado.");
  const signedV = withdraw ? -v : v;
  const next = Math.max(0, Math.round((Number(inv.current_value) + signedV) * 100) / 100);
  const { error } = await supabase.from("investment_moves").insert({ investment_id: id, amount: signedV });
  if (error) return fail(error.message);
  const { error: e2 } = await supabase.from("investments").update({ current_value: next }).eq("id", id);
  if (e2) return fail(e2.message);
  revalidatePath("/investimentos");
  return { ok: true };
}

/** Atualiza quanto o investimento vale hoje (a diferença para o investido é a rentabilidade). */
export async function setInvestmentValue(id: string, fd: FormData): Promise<ActionResult> {
  const v = parseBRL(str(fd, "amount"));
  if (!Number.isFinite(v) || v < 0) return fail("Valor inválido.");
  const supabase = await createClient();
  const { error } = await supabase.from("investments").update({ current_value: v }).eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/investimentos");
  return { ok: true };
}

/* ───────────── Dívidas ───────────── */

export async function createDebt(fd: FormData): Promise<ActionResult> {
  const name = str(fd, "name");
  const creditor = str(fd, "creditor") || null;
  const balance = parseBRL(str(fd, "balance"));
  const rateRaw = str(fd, "monthly_rate");
  const rate = rateRaw ? Number(rateRaw.replace(",", ".")) : 0;
  const payRaw = str(fd, "monthly_payment");
  const payment = payRaw ? parseBRL(payRaw) : 0;
  if (!name) return fail("Dê um nome para a dívida.");
  if (!Number.isFinite(balance) || balance <= 0) return fail("Informe quanto você deve hoje.");
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) return fail("Juros inválidos.");
  if (!Number.isFinite(payment) || payment < 0) return fail("Parcela inválida.");
  const supabase = await createClient();
  const { error } = await supabase.from("debts").insert({
    name,
    creditor,
    original_amount: balance,
    current_balance: balance,
    monthly_rate: rate,
    monthly_payment: payment,
  });
  if (error) return fail(error.message);
  revalidatePath("/dividas");
  return { ok: true };
}

export async function deleteDebt(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("debts").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/dividas");
  return { ok: true };
}

/** Registra um pagamento: abate do saldo devedor. */
export async function payDebt(id: string, fd: FormData): Promise<ActionResult> {
  const v = parseBRL(str(fd, "amount"));
  if (!Number.isFinite(v) || v <= 0) return fail("Informe um valor maior que zero.");
  const supabase = await createClient();
  const { data: d } = await supabase.from("debts").select("current_balance").eq("id", id).single();
  if (!d) return fail("Dívida não encontrada.");
  const next = Math.max(0, Math.round((Number(d.current_balance) - v) * 100) / 100);
  const { error } = await supabase.from("debts").update({ current_balance: next }).eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/dividas");
  return { ok: true };
}

/** Corrige o saldo devedor (por exemplo, depois que os juros do mês entraram). */
export async function setDebtBalance(id: string, fd: FormData): Promise<ActionResult> {
  const v = parseBRL(str(fd, "amount"));
  if (!Number.isFinite(v) || v < 0) return fail("Valor inválido.");
  const supabase = await createClient();
  const { error } = await supabase.from("debts").update({ current_balance: v }).eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/dividas");
  return { ok: true };
}
