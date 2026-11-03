// Matemática de financiamento imobiliário: funções puras, sem dependências (testáveis em isolamento).

export type Method = "sac" | "price";

export type Installment = {
  n: number; // número da parcela (1..prazo)
  interest: number;
  amortization: number;
  extras: number; // seguro + tarifa mensal
  payment: number; // parcela total
  balance: number; // saldo devedor depois de pagar
};

export type Schedule = {
  rows: Installment[];
  first: number;
  last: number;
  totalInterest: number;
  totalExtras: number;
  totalPaid: number; // soma das parcelas (sem a entrada)
};

export type ScheduleInput = {
  principal: number; // valor financiado
  annualRate: number; // taxa nominal ao ano, em % (como o banco anuncia)
  months: number;
  insuranceRate?: number; // % ao mês sobre o saldo devedor (MIP + DFI)
  adminFee?: number; // R$ por mês
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Taxa mensal usada pelos bancos: nominal anual / 12. */
export const monthlyRate = (annualRatePct: number) => annualRatePct / 100 / 12;

/** Parcela fixa da Tabela Price (sem seguros). */
export function pricePayment(principal: number, i: number, n: number): number {
  if (n <= 0) return 0;
  if (i === 0) return principal / n;
  return (principal * i) / (1 - Math.pow(1 + i, -n));
}

export function buildSchedule(method: Method, inp: ScheduleInput): Schedule {
  const { principal, months: n } = inp;
  const i = monthlyRate(inp.annualRate);
  const ins = (inp.insuranceRate ?? 0) / 100;
  const fee = inp.adminFee ?? 0;
  const rows: Installment[] = [];
  if (principal <= 0 || n <= 0) return { rows, first: 0, last: 0, totalInterest: 0, totalExtras: 0, totalPaid: 0 };

  let balance = principal;
  const pmt = method === "price" ? pricePayment(principal, i, n) : 0;
  const sacAmort = principal / n;

  for (let k = 1; k <= n; k++) {
    const interest = balance * i;
    const amortization = method === "price" ? pmt - interest : sacAmort;
    const extras = balance * ins + fee;
    balance = Math.max(0, balance - amortization);
    rows.push({ n: k, interest, amortization, extras, payment: interest + amortization + extras, balance: k === n ? 0 : balance });
  }

  const totalInterest = rows.reduce((s, r) => s + r.interest, 0);
  const totalExtras = rows.reduce((s, r) => s + r.extras, 0);
  const totalPaid = rows.reduce((s, r) => s + r.payment, 0);
  return {
    rows,
    first: r2(rows[0].payment),
    last: r2(rows[rows.length - 1].payment),
    totalInterest: r2(totalInterest),
    totalExtras: r2(totalExtras),
    totalPaid: r2(totalPaid),
  };
}

export type UpfrontInput = {
  price: number;
  down: number;
  fgtsOnDown: number; // parte da entrada paga com FGTS
  itbiPct: number;
  registryPct: number; // escritura + registro
  otherFees: number; // avaliação, tarifas
};

/** Dinheiro que precisa existir no dia da compra. */
export function upfrontCosts(u: UpfrontInput) {
  const fgts = Math.min(Math.max(u.fgtsOnDown, 0), u.down);
  const itbi = r2((u.price * u.itbiPct) / 100);
  const registry = r2((u.price * u.registryPct) / 100);
  const costs = r2(itbi + registry + u.otherFees);
  const cashDown = r2(u.down - fgts);
  return { fgts, itbi, registry, other: u.otherFees, costs, cashDown, totalCash: r2(cashDown + costs) };
}

export type RentVsBuyInput = {
  price: number;
  upfrontCash: number; // dinheiro que o comprador desembolsa no dia 0 (entrada em dinheiro + custos)
  schedule: Schedule;
  holdCostMonthly: number; // condomínio + IPTU + manutenção (começa no mês 1, reajusta com a inflação do aluguel)
  appreciationPct: number; // valorização anual do imóvel
  sellingCostPct: number; // corretagem etc. na venda
  rent: number; // aluguel mensal inicial
  rentAdjustPct: number; // reajuste anual do aluguel
  investPct: number; // rendimento anual líquido do dinheiro investido
  years: number; // horizonte
};

export type RentVsBuyPoint = { year: number; buy: number; rent: number };

/**
 * Patrimônio de quem compra x quem aluga e investe a diferença, ao fim de cada ano.
 * Comprar: valor do imóvel (menos custo de venda) − saldo devedor.
 * Alugar: investe a entrada + custos no dia 0 e, todo mês, a diferença entre o custo de morar comprando e o aluguel.
 */
export function rentVsBuy(inp: RentVsBuyInput): { points: RentVsBuyPoint[]; breakEvenYear: number | null } {
  const months = inp.years * 12;
  const mInvest = Math.pow(1 + inp.investPct / 100, 1 / 12) - 1;
  const mApprec = Math.pow(1 + inp.appreciationPct / 100, 1 / 12) - 1;
  let invest = inp.upfrontCash;
  let house = inp.price;
  const points: RentVsBuyPoint[] = [];
  let breakEvenYear: number | null = null;

  for (let m = 1; m <= months; m++) {
    const yearIdx = Math.floor((m - 1) / 12);
    const inflate = Math.pow(1 + inp.rentAdjustPct / 100, yearIdx);
    const rent = inp.rent * inflate;
    const row = inp.schedule.rows[m - 1];
    const buyCost = (row ? row.payment : 0) + inp.holdCostMonthly * inflate;

    invest = invest * (1 + mInvest) + (buyCost - rent);
    house = house * (1 + mApprec);

    if (m % 12 === 0) {
      const balance = row ? row.balance : 0;
      const buyWealth = house * (1 - inp.sellingCostPct / 100) - balance;
      const year = m / 12;
      points.push({ year, buy: r2(buyWealth), rent: r2(invest) });
      if (breakEvenYear === null && buyWealth >= invest) breakEvenYear = year;
    }
  }
  return { points, breakEvenYear };
}
