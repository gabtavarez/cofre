export type PlanId = "30d" | "1y" | "life";

export const PLANS: Record<PlanId, { label: string; price: number; days: number | null; blurb: string }> = {
  "30d": { label: "30 dias", price: 9.9, days: 30, blurb: "Experimente o Pro por um mês" },
  "1y": { label: "1 ano", price: 79.9, days: 365, blurb: "Equivale a R$ 6,66 por mês" },
  life: { label: "Vitalício", price: 199.9, days: null, blurb: "Pague uma vez, use para sempre" },
};

export const PLAN_IDS = Object.keys(PLANS) as PlanId[];
export const isPlan = (v: unknown): v is PlanId => typeof v === "string" && v in PLANS;

export const PRO_FEATURES = [
  "Assistente de IA com os seus dados",
  "Financiar imóvel: SAC × Price, ITBI, FGTS e aluguel × compra",
  "Importar extrato do banco (CSV e OFX)",
  "Compartilhar a conta com outra pessoa",
  "Relatórios e Patrimônio",
  "Exportar para Excel/CSV",
];
