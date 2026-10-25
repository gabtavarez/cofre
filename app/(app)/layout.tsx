import { Sidebar } from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === "string" ? data.claims.email : "";

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar email={email} />
      <main className="flex min-w-0 flex-1 flex-col gap-6 px-5 py-7 md:px-9 md:pb-12">{children}</main>
    </div>
  );
}
