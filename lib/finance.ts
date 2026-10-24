import type { Transaction } from "@/lib/types";
import { addDays, daysInMonth, monthBounds, parseISO, toISO } from "@/lib/dates";

type Row = Pick<Transaction, "kind" | "amount" | "date" | "paid">;

export const signed = (t: Pick<Transaction, "kind" | "amount">): number =>
  t.kind === "income" ? t.amount : -t.amount;

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export type MonthSummary = {
  income: number;
  incomePaid: number;
  expense: number;
  expensePaid: number;
  expenseOpen: number;
  result: number;
};

export function summarize(txs: Row[]): MonthSummary {
  let income = 0, incomePaid = 0, expense = 0, expensePaid = 0;
  for (const t of txs) {
    if (t.kind === "income") {
      income += t.amount;
      if (t.paid) incomePaid += t.amount;
    } else {
      expense += t.amount;
      if (t.paid) expensePaid += t.amount;
    }
  }
  return {
    income: round2(income),
    incomePaid: round2(incomePaid),
    expense: round2(expense),
    expensePaid: round2(expensePaid),
    expenseOpen: round2(expense - expensePaid),
    result: round2(income - expense),
  };
}

export type Series = {
  days: number;
  todayDay: number | null; // dia do mês de "hoje" (null se fora do mês)
  realized: number[]; // saldo realizado, dia 1..todayDay (ou 1..days se mês passado)
  projected: number[]; // saldo projetado, de todayDay..days (ou 1..days se mês futuro)
  projectedStart: number; // dia (1-based) em que `projected[0]` começa
  currentBalance: number;
  endBalance: number;
};

/**
 * Saldo diário do mês.
 * `rows` deve conter TODOS os lançamentos com data <= fim do mês (incluindo meses anteriores).
 */
export function dailySeries(rows: Row[], initial: number, month: string, today: string): Series {
  const { start, end, days } = monthBounds(month);

  let paidBefore = initial;
  let allBefore = initial;
  const paidByDay = new Map<number, number>();
  const openByDay = new Map<number, number>();
  let currentPaid = initial; // todos os pagos com data <= hoje (qualquer mês)

  for (const t of rows) {
    const v = signed(t);
    if (t.date < start) {
      allBefore += v;
      if (t.paid) paidBefore += v;
    } else if (t.date <= end) {
      const d = parseISO(t.date).d;
      const map = t.paid ? paidByDay : openByDay;
      map.set(d, (map.get(d) ?? 0) + v);
    }
    if (t.paid && t.date <= today) currentPaid += v;
  }

  const todayInMonth = today >= start && today <= end;
  const todayDay = todayInMonth ? parseISO(today).d : null;
  const monthIsPast = today > end;
  const monthIsFuture = today < start;

  const lastRealized = monthIsPast ? days : monthIsFuture ? 0 : (todayDay as number);

  const realized: number[] = [];
  let paidBal = paidBefore;
  for (let d = 1; d <= lastRealized; d++) {
    paidBal += paidByDay.get(d) ?? 0;
    realized.push(round2(paidBal));
  }

  const projected: number[] = [];
  let projectedStart = days + 1;
  if (monthIsFuture) {
    projectedStart = 1;
    let bal = allBefore;
    for (let d = 1; d <= days; d++) {
      bal += (paidByDay.get(d) ?? 0) + (openByDay.get(d) ?? 0);
      projected.push(round2(bal));
    }
  } else if (!monthIsPast) {
    const t = todayDay as number;
    projectedStart = t;
    // pendentes atrasados (qualquer mês) + pendentes de hoje entram a partir de amanhã
    let carry = openByDay.get(t) ?? 0;
    for (const r of rows) if (!r.paid && r.date < today) carry += signed(r);
    let bal = realized[t - 1];
    projected.push(round2(bal));
    for (let d = t + 1; d <= days; d++) {
      if (d === t + 1) bal += carry;
      bal += (paidByDay.get(d) ?? 0) + (openByDay.get(d) ?? 0);
      projected.push(round2(bal));
    }
    if (t === days) projected[0] = round2(bal + carry);
  }

  const endBalance = projected.length
    ? projected[projected.length - 1]
    : realized[realized.length - 1] ?? paidBefore;

  return {
    days,
    todayDay,
    realized,
    projected,
    projectedStart,
    currentBalance: round2(currentPaid),
    endBalance,
  };
}

export type CategorySlice = { name: string; value: number };

export function expenseByCategory(
  txs: (Row & { category: { name: string } | null })[],
  topN = 3,
): CategorySlice[] {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (t.kind !== "expense") continue;
    const name = t.category?.name ?? "Sem categoria";
    map.set(name, (map.get(name) ?? 0) + t.amount);
  }
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value: round2(value) }));
  if (sorted.length <= topN + 1) return sorted;
  const head = sorted.slice(0, topN);
  const rest = round2(sorted.slice(topN).reduce((s, x) => s + x.value, 0));
  return [...head, { name: "Outros", value: rest }];
}

export function niceCeil(v: number): number {
  if (v <= 0) return 1000;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * mag;
}

export function monthRangeISO(month: string, offset: number): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + offset;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return { start: toISO(ny, nm, 1), end: toISO(ny, nm, daysInMonth(ny, nm)) };
}

export const plusDays = addDays;
