import { createClient } from "@supabase/supabase-js";

/** Cliente com a chave de serviço: ignora RLS. Só para rotas de servidor confiáveis (webhook de pagamento). */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
