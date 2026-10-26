import { createClient } from "@/lib/supabase/server";
import { monthBounds } from "@/lib/dates";

const safe = (v: string) => {
  // evita que o Excel interprete o texto como fórmula
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${s.replace(/"/g, '""')}"`;
};
const money = (n: number) => n.toFixed(2).replace(".", ",");

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return new Response("Não autorizado", { status: 401 });

  const m = new URL(request.url).searchParams.get("m");
  let query = supabase
    .from("transactions")
    .select("date,description,kind,amount,paid,repeat,installment_no,installments_total,category:categories(name),account:accounts(name)")
    .order("date", { ascending: true })
    .limit(50000);
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const { start, end } = monthBounds(m);
    query = query.gte("date", start).lte("date", end);
  }
  const { data, error } = await query;
  if (error) return new Response(error.message, { status: 500 });

  const head = ["Data", "Descrição", "Tipo", "Categoria", "Conta", "Valor", "Situação", "Repetição", "Parcela"];
  const lines = [head.join(";")];
  for (const t of (data ?? []) as unknown as {
    date: string; description: string; kind: string; amount: number; paid: boolean; repeat: string;
    installment_no: number | null; installments_total: number | null;
    category: { name: string } | null; account: { name: string } | null;
  }[]) {
    const value = t.kind === "income" ? Number(t.amount) : -Number(t.amount);
    lines.push(
      [
        t.date.split("-").reverse().join("/"),
        safe(t.description),
        t.kind === "income" ? "Receita" : "Despesa",
        safe(t.category?.name ?? ""),
        safe(t.account?.name ?? ""),
        money(value),
        t.paid ? (t.kind === "income" ? "Recebido" : "Pago") : "Pendente",
        { none: "Única", installment: "Parcelada", fixed: "Fixa mensal", yearly: "Anual" }[t.repeat] ?? t.repeat,
        t.installment_no ? `${t.installment_no}/${t.installments_total}` : "",
      ].join(";"),
    );
  }

  const name = m ? `mymony-${m}.csv` : "mymony-tudo.csv";
  return new Response("\uFEFF" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
