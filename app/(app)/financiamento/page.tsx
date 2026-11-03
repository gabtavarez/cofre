import { MortgageClient } from "@/components/MortgageClient";
import { getMonthlySurplus } from "@/lib/data";
import { todayISO } from "@/lib/dates";

export default async function Financiamento() {
  const surplus = await getMonthlySurplus(todayISO());
  return (
    <>
      <header className="flex flex-col gap-1">
        <span className="text-[13px] text-muted">SAC × Price, custos da compra, FGTS e aluguel × compra</span>
        <h1 className="text-3xl font-extrabold">Financiar um imóvel</h1>
      </header>
      <MortgageClient income={surplus.avgIncome} surplus={surplus.avg} />
    </>
  );
}
