const nf = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 4284 -> "R$ 4.284,00" */
export function brl(n: number): string {
  const v = Math.round(n * 100) / 100;
  return `${v < 0 ? "−" : ""}R$ ${nf.format(Math.abs(v))}`;
}

/** Sem o prefixo: 4284 -> "4.284,00" */
export function num(n: number): string {
  return nf.format(Math.round(n * 100) / 100);
}

/** "1.234,56" | "1234.56" | "351,84" -> 351.84 (NaN se inválido) */
export function parseBRL(input: string): number {
  const s = input.trim().replace(/[R$\s]/g, "");
  if (!s) return NaN;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

/** Divide `total` em n parcelas em centavos; a sobra vai para a última. */
export function splitInstallments(total: number, n: number): number[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  const parts = Array.from({ length: n }, () => base);
  parts[n - 1] += cents - base * n;
  return parts.map((c) => c / 100);
}
