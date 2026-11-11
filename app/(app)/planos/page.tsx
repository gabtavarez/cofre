import { PlansClient } from "@/components/PlansClient";
import { getPro } from "@/lib/pro";

export default async function Planos({ searchParams }: { searchParams: Promise<{ pago?: string }> }) {
  const { pago } = await searchParams;
  const pro = await getPro();
  const configured = !!process.env.MERCADOPAGO_ACCESS_TOKEN && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  return (
    <>
      <header className="flex flex-col gap-1">
        <span className="text-[13px] text-muted">Passe avulso, sem renovação automática</span>
        <h1 className="text-3xl font-extrabold">Planos</h1>
      </header>
      <PlansClient pro={pro} configured={configured} paid={pago ?? null} />
    </>
  );
}
