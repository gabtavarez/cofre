import { MonthNav } from "@/components/MonthNav";
import { WishlistClient, type Wish } from "@/components/WishlistClient";
import { getBase } from "@/lib/data";
import { monthBounds, resolveMonth, todayISO } from "@/lib/dates";
import { getFreeBudget } from "@/lib/free";
import { createClient } from "@/lib/supabase/server";

export default async function Desejos({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const realToday = todayISO();
  const month = resolveMonth(m);
  // Em mês futuro, os desejos com "esperar até" dentro do mês já contam como liberados.
  const today = month > realToday.slice(0, 7) ? monthBounds(month).end : realToday;
  const supabase = await createClient();
  const [free, { accounts }, { data }] = await Promise.all([
    getFreeBudget(month),
    getBase(),
    supabase
      .from("wishlist_items")
      .select("id,name,price,priority,url,wait_until,bought_at")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const wishes: Wish[] = (data ?? []).map((w) => ({
    id: w.id,
    name: w.name,
    price: Number(w.price),
    priority: w.priority as 1 | 2 | 3,
    url: w.url,
    waitUntil: w.wait_until,
    boughtAt: w.bought_at,
  }));

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-muted">Seus desejos, de acordo com a sua verba do mês</span>
          <h1 className="text-3xl font-extrabold">Lista de desejos</h1>
        </div>
        <MonthNav month={month} basePath="/desejos" />
      </header>
      <WishlistClient
        wishes={wishes}
        today={today}
        left={free.left}
        budget={free.budget}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
        categories={free.freeCategories}
      />
    </>
  );
}
