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
  if (!["none", "installment", "fixed"].includes(repeat)) return fail("Repetição inválida.");

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
    if (tx.repeat === "fixed") shared.amount = amount;
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
      revalidatePath("/", "layout");
      return { ok: true };
    }
  }

  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return fail(error.message);
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
