import { ShoppingClient, type ShopItem } from "@/components/ShoppingClient";
import { getBase, getTransactionsBetween } from "@/lib/data";
import { monthBounds, resolveMonth } from "@/lib/dates";
import { round2 } from "@/lib/finance";
import { createClient } from "@/lib/supabase/server";

export default async function Mercado() {
  const month = resolveMonth(undefined);
  const { start, end } = monthBounds(month);
  const supabase = await createClient();
  const [{ accounts, categories }, txs, { data: rows }] = await Promise.all([
    getBase(),
    getTransactionsBetween(start, end),
    supabase
      .from("shopping_items")
      .select("id,name,qty,unit_price,checked,done_at,created_at")
      .order("created_at", { ascending: false })
      .limit(600),
  ]);

  const expenseCats = categories.filter((c) => c.kind === "expense");
  const market = expenseCats.find((c) => /mercado|supermercado|feira|aliment/i.test(c.name)) ?? null;
  const spent = market
    ? round2(txs.filter((t) => t.kind === "expense" && t.category_id === market.id).reduce((s, t) => s + t.amount, 0))
    : 0;

  const all = (rows ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    qty: Number(r.qty),
    price: Number(r.unit_price),
    checked: !!r.checked,
    done: !!r.done_at,
  }));
  const items: ShopItem[] = all.filter((i) => !i.done).reverse();

  // itens frequentes: já comprados antes (último preço), sem repetir os que estão na lista
  const inList = new Set(items.map((i) => i.name.toLowerCase()));
  const seen = new Map<string, ShopItem>();
  for (const i of all.filter((x) => x.done)) {
    const k = i.name.toLowerCase();
    if (!seen.has(k) && !inList.has(k)) seen.set(k, i);
  }

  return (
    <>
      <header className="flex flex-col gap-1">
        <span className="text-[13px] text-muted">Monte a lista, marque no mercado e lance a compra</span>
        <h1 className="text-3xl font-extrabold">Lista de mercado</h1>
      </header>
      <ShoppingClient
        items={items}
        frequent={[...seen.values()].slice(0, 12)}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
        categories={expenseCats.map((c) => ({ id: c.id, name: c.name }))}
        marketId={market?.id ?? ""}
        marketName={market?.name ?? null}
        limit={market?.monthly_limit ?? null}
        spent={spent}
      />
    </>
  );
}
