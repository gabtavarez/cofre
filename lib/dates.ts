const TZ = "America/Sao_Paulo";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Hoje em YYYY-MM-DD no fuso de São Paulo. */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function parseISO(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

export function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Soma meses preservando o dia (31/jan + 1 mês = 28 ou 29/fev). */
export function addMonths(iso: string, n: number): string {
  const { y, m, d } = parseISO(iso);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return toISO(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

/** Soma dias a uma data ISO. */
export function addDays(iso: string, n: number): string {
  const { y, m, d } = parseISO(iso);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return toISO(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** "2026-10" válido? Senão devolve o mês de hoje. */
export function resolveMonth(param: string | undefined): string {
  if (param && /^\d{4}-(0[1-9]|1[0-2])$/.test(param)) return param;
  return todayISO().slice(0, 7);
}

export function monthBounds(month: string): { start: string; end: string; days: number } {
  const [y, m] = month.split("-").map(Number);
  const days = daysInMonth(y, m);
  return { start: toISO(y, m, 1), end: toISO(y, m, days), days };
}

export function shiftMonth(month: string, n: number): string {
  return addMonths(`${month}-01`, n).slice(0, 7);
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function monthShort(month: string): string {
  const m = Number(month.slice(5, 7));
  return MONTHS_SHORT[m - 1];
}

export function weekday(iso: string): string {
  const { y, m, d } = parseISO(iso);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** "2026-10-24" -> "24/10" */
export function dm(iso: string): string {
  const { m, d } = parseISO(iso);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

/** "2026-10-24" -> "sáb, 24 out" */
export function dayHeading(iso: string): string {
  const { m, d } = parseISO(iso);
  return `${weekday(iso)}, ${String(d).padStart(2, "0")} ${MONTHS_SHORT[m - 1].toLowerCase()}`;
}

export function daysBetween(a: string, b: string): number {
  const pa = parseISO(a);
  const pb = parseISO(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86400000);
}
