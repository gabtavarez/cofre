import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type ProState = { active: boolean; lifetime: boolean; expiresAt: string | null };

/** Plano Pro do dono dos dados (quem está num domicílio compartilhado herda o Pro do dono). */
export const getPro = cache(async function getPro(): Promise<ProState> {
  const supabase = await createClient();
  const { data } = await supabase.from("pro_access").select("lifetime,expires_at").maybeSingle();
  if (!data) return { active: false, lifetime: false, expiresAt: null };
  const active = data.lifetime || (!!data.expires_at && new Date(data.expires_at).getTime() > Date.now());
  return { active, lifetime: data.lifetime, expiresAt: data.expires_at };
});

export const PRO_ERROR = "Este recurso é do plano Pro. Veja os planos em “Planos”.";
