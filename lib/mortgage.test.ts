import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSchedule, monthlyRate, pricePayment, rentVsBuy, upfrontCosts } from "./mortgage.ts";

const near = (a: number, b: number, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);

test("Price: parcela fixa conhecida (R$ 200.000, 12% a.a. nominal, 360 meses)", () => {
  // i = 1% a.m. → PMT = 200000 * 0.01 / (1 - 1.01^-360) ≈ 2057,23
  near(pricePayment(200000, 0.01, 360), 2057.23, 0.01);
});

test("Price: parcelas iguais e saldo zera no fim", () => {
  const s = buildSchedule("price", { principal: 200000, annualRate: 12, months: 360 });
  near(s.first, s.last, 0.01);
  assert.equal(s.rows[s.rows.length - 1].balance, 0);
  near(s.rows.reduce((a, r) => a + r.amortization, 0), 200000, 0.01);
});

test("SAC: amortização constante, parcela decrescente, primeira parcela conhecida", () => {
  const s = buildSchedule("sac", { principal: 200000, annualRate: 12, months: 360 });
  // amort = 555,56; juros 1º mês = 2000 → 2555,56
  near(s.first, 2555.56, 0.01);
  assert.ok(s.last < s.first);
  near(s.rows[0].amortization, s.rows[100].amortization, 1e-9);
});

test("SAC paga menos juros no total que Price, com a mesma taxa e prazo", () => {
  const a = buildSchedule("sac", { principal: 300000, annualRate: 10.5, months: 360 });
  const b = buildSchedule("price", { principal: 300000, annualRate: 10.5, months: 360 });
  assert.ok(a.totalInterest < b.totalInterest);
});

test("taxa zero: parcela = principal / prazo", () => {
  const s = buildSchedule("price", { principal: 120000, annualRate: 0, months: 120 });
  near(s.first, 1000);
  assert.equal(s.totalInterest, 0);
});

test("seguro e tarifa entram na parcela", () => {
  const base = buildSchedule("price", { principal: 100000, annualRate: 10, months: 60 });
  const withFees = buildSchedule("price", { principal: 100000, annualRate: 10, months: 60, insuranceRate: 0.05, adminFee: 25 });
  assert.ok(withFees.first > base.first + 25);
  assert.ok(withFees.totalExtras > 25 * 60);
});

test("custos de entrada: ITBI, registro e FGTS limitado à entrada", () => {
  const u = upfrontCosts({ price: 500000, down: 100000, fgtsOnDown: 150000, itbiPct: 3, registryPct: 1.5, otherFees: 3000 });
  assert.equal(u.itbi, 15000);
  assert.equal(u.registry, 7500);
  assert.equal(u.fgts, 100000); // não passa da entrada
  assert.equal(u.cashDown, 0);
  assert.equal(u.totalCash, 25500);
});

test("taxa mensal nominal = anual / 12", () => {
  near(monthlyRate(12), 0.01, 1e-12);
});

test("aluguel x compra: sem valorização e sem rendimento, comprar nunca vence na primeira década", () => {
  const schedule = buildSchedule("price", { principal: 400000, annualRate: 11, months: 360 });
  const r = rentVsBuy({
    price: 500000, upfrontCash: 125000, schedule, holdCostMonthly: 0, appreciationPct: 0, sellingCostPct: 0,
    rent: 2500, rentAdjustPct: 0, investPct: 0, years: 10,
  });
  assert.equal(r.points.length, 10);
  assert.ok(r.points[9].buy < r.points[9].rent);
});

test("aluguel x compra: com forte valorização, comprar passa a vencer", () => {
  const schedule = buildSchedule("sac", { principal: 300000, annualRate: 9, months: 240 });
  const r = rentVsBuy({
    price: 400000, upfrontCash: 120000, schedule, holdCostMonthly: 500, appreciationPct: 12, sellingCostPct: 5,
    rent: 2200, rentAdjustPct: 5, investPct: 6, years: 15,
  });
  assert.notEqual(r.breakEvenYear, null);
});
