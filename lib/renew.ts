import type { SupabaseClient } from "@supabase/supabase-js";
import { addMonths, todayISO } from "@/lib/dates";

let lastRun = 0;

/**
 * Renova as séries fixas (mensais) e anuais que estão acabando, gerando os próximos
 * lançamentos. Séries encerradas pelo usuário ("este e os próximos") têm auto_renew = false.
 * Roda no máximo uma vez por hora por instância (a consulta é leve).
 */
export async function renewSeries(supabase: SupabaseClient): Promise<void> {
  if (Date.now() - lastRun < 60 * 60 * 1000) return;
  lastRun = Date.now();

  const today = todayISO();

  const { data } = await supabase
    .from("transactions")
    .select("series_id,date,repeat,kind,description,amount,account_id,category_id,auto_renew")
    .in("repeat", ["fixed", "yearly"])
    .not("series_id", "is", null)
    .order("date", { ascending: false })
    .limit(3000);

  const latest = new Map<string, NonNullable<typeof data>[number]>();
  for (const r of data ?? []) {
    if (r.series_id && !latest.has(r.series_id)) latest.set(r.series_id, r);
  }

  const rows: Record<string, unknown>[] = [];
  for (const last of latest.values()) {
    if (!last.auto_renew) continue;
    const step = last.repeat === "yearly" ? 12 : 1;
    const threshold = addMonths(today, last.repeat === "yearly" ? 24 : 6);
    const horizon = addMonths(today, last.repeat === "yearly" ? 60 : 12);
    if (last.date >= threshold) continue;
    let i = 1;
    for (;;) {
      const date = addMonths(last.date, i * step);
      if (date > horizon) break;
      rows.push({
        kind: last.kind,
        description: last.description,
        amount: last.amount,
        account_id: last.account_id,
        category_id: last.category_id,
        date,
        paid: false,
        repeat: last.repeat,
        series_id: last.series_id,
        auto_renew: true,
      });
      i++;
      if (i > 200) break;
    }
  }
  if (rows.length) await supabase.from("transactions").insert(rows);
}
