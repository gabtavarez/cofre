import { Suspense } from "react";
import { QuickAdd } from "@/components/QuickAdd";
import { Sidebar } from "@/components/Sidebar";
import { getBase, getCategoryHints } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { renewSeries } from "@/lib/renew";
import { createClient } from "@/lib/supabase/server";

/** Botão de lançamento rápido: carrega em paralelo, sem travar a página. */
async function QuickAddLoader() {
  const supabase = await createClient();
  const [base, hints] = await Promise.all([
    getBase(),
    getCategoryHints(),
    renewSeries(supabase).catch(() => {}),
  ]);
  return <QuickAdd accounts={base.accounts} categories={base.categories} today={todayISO()} hints={hints} />;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === "string" ? data.claims.email : "";

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar email={email} />
      <main className="app-main flex min-w-0 flex-1 flex-col gap-6 px-5 py-6 pb-28 md:px-9 md:py-7 md:pb-12">{children}</main>
      <Suspense fallback={null}>
        <QuickAddLoader />
      </Suspense>
    </div>
  );
}
