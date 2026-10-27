"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fieldCls } from "@/components/forms";
import { brl } from "@/lib/format";

export type Facts = {
  balance: number;
  avgExpense: number;
  avgIncome: number;
  liquidInvested: number;
  totalInvested: number;
  debts: { name: string; balance: number; rate: number }[];
};

type Goal = "reserva" | "curto" | "medio" | "longo" | "renda";
type Exp = "zero" | "pouco" | "ok";
type Risk = "baixo" | "medio" | "alto";
type Job = "estavel" | "variavel";

const LESSONS: { t: string; b: string }[] = [
  { t: "Inflação: por que deixar parado perde valor", b: "Os preços sobem com o tempo. Se seu dinheiro rende menos que a inflação, você compra menos coisas no futuro com a mesma grana. Investir serve, antes de tudo, para não perder poder de compra." },
  { t: "Selic e CDI: a base da renda fixa", b: "A Selic é a taxa básica de juros do país. O CDI anda colado nela. Muitos investimentos de renda fixa prometem “X% do CDI”: 100% do CDI rende o mesmo que a taxa base. Consulte a taxa atual no site do Banco Central, ela muda." },
  { t: "Renda fixa x renda variável", b: "Na renda fixa você sabe a regra do rendimento na hora da compra (ex.: 100% do CDI). Na variável (ações, fundos imobiliários, ETFs) não há promessa: o preço sobe e desce, com chance de ganhar mais no longo prazo e de ver prejuízo no curto." },
  { t: "Liquidez: em quanto tempo vira dinheiro", b: "Liquidez diária significa poder resgatar quando quiser. Outros títulos só liberam o dinheiro no vencimento. Dinheiro de emergência sempre fica em algo com liquidez diária." },
  { t: "Tesouro Direto", b: "Você empresta dinheiro ao governo, considerado o emissor mais seguro do país. Tesouro Selic acompanha a taxa básica e é o mais estável (bom para reserva). Tesouro IPCA+ paga inflação mais uma taxa e serve para objetivos longos." },
  { t: "CDB, LCI e LCA", b: "Títulos emitidos por bancos. Têm cobertura do FGC até R$ 250 mil por CPF e instituição. LCI e LCA não pagam imposto de renda para pessoa física, mas costumam ter prazo mínimo. Compare sempre a taxa líquida, depois do imposto." },
  { t: "Imposto de renda na renda fixa", b: "Em CDB e Tesouro, o IR incide só sobre o rendimento e cai com o tempo (de 22,5% em até 6 meses para 15% depois de 2 anos). Por isso resgatar cedo costuma compensar menos." },
  { t: "Risco e diversificação", b: "Risco é a chance de o resultado ser diferente do esperado. Não coloque tudo em um só ativo. Diversificar entre tipos de investimento reduz o estrago se um deles for mal." },
  { t: "Ações, FIIs e ETFs", b: "Ações são pedaços de empresas. FIIs são fundos que investem em imóveis e pagam renda mensal. ETFs reúnem muitos ativos numa compra só (ex.: um índice). Para iniciantes, ETFs e fundos amplos são mais simples que escolher papéis um a um." },
  { t: "Juros compostos: o tempo trabalha por você", b: "Os rendimentos passam a render também. Quanto mais cedo começar e mais constante for o aporte, maior o efeito. Teste no Simulador com seus números." },
  { t: "Golpes e promessas", b: "Desconfie de retorno alto e garantido, de pressa para aplicar e de quem pede dinheiro por fora de corretoras e bancos autorizados. Confira a empresa no site do Banco Central ou da CVM." },
];

const pct = (n: number) => `${Math.round(n)}%`;

export function LearnClient({ facts }: { facts: Facts }) {
  const [goal, setGoal] = useState<Goal>("reserva");
  const [exp, setExp] = useState<Exp>("zero");
  const [risk, setRisk] = useState<Risk>("baixo");
  const [job, setJob] = useState<Job>("estavel");
  const [open, setOpen] = useState<number | null>(0);

  const plan = useMemo(() => {
    const monthsReserve = job === "estavel" ? 6 : 12;
    const target = facts.avgExpense * monthsReserve;
    const have = Math.max(0, facts.balance) + facts.liquidInvested;
    const gap = Math.max(0, target - have);
    const surplus = facts.avgIncome - facts.avgExpense;
    const badDebts = facts.debts.filter((d) => d.rate >= 1.5).sort((a, b) => b.rate - a.rate);

    // perfil: risco declarado, ajustado por experiência e objetivo
    let score = { baixo: 0, medio: 1, alto: 2 }[risk];
    if (exp === "zero") score = Math.min(score, 1);
    if (goal === "reserva" || goal === "curto") score = 0;
    const profile = ["Conservador", "Moderado", "Arrojado"][score];
    const alloc =
      score === 0
        ? [["Renda fixa pós-fixada (liquidez)", 80], ["Renda fixa com inflação", 20], ["Renda variável", 0]]
        : score === 1
          ? [["Renda fixa pós-fixada (liquidez)", 45], ["Renda fixa com inflação", 35], ["Renda variável", 20]]
          : [["Renda fixa pós-fixada (liquidez)", 25], ["Renda fixa com inflação", 35], ["Renda variável", 40]];

    const where: Record<Goal, string> = {
      reserva: "Tesouro Selic ou CDB com liquidez diária pagando 100% do CDI ou mais. Prioridade é poder sacar a qualquer momento.",
      curto: "Prazo de até 2 anos: CDB, LCI ou LCA pós-fixados com vencimento perto da data que você precisa, ou Tesouro Selic.",
      medio: "De 2 a 5 anos: mistura de CDB/LCI/LCA e Tesouro IPCA+ com vencimento perto do seu objetivo, para proteger da inflação.",
      longo: "Mais de 5 anos: Tesouro IPCA+ como base, e uma parte em renda variável diversificada (ETFs amplos ou fundos) para buscar mais retorno.",
      renda: "Longo prazo: base em Tesouro IPCA+ e títulos privados, com parte em ETFs, ações de empresas que pagam dividendos e FIIs para formar renda mensal.",
    };

    const aport = surplus > 0 ? [Math.round(surplus * 0.5), Math.round(surplus * 0.8)] : null;
    return { target, have, gap, surplus, badDebts, profile, alloc, where: where[goal], monthsReserve, aport };
  }, [facts, goal, exp, risk, job]);

  const steps: { n: number; title: string; status: "ok" | "todo" | "info"; body: React.ReactNode }[] = [
    {
      n: 1,
      title: "Faça sobrar dinheiro todo mês",
      status: plan.surplus > 0 ? "ok" : "todo",
      body:
        facts.avgIncome === 0 && facts.avgExpense === 0 ? (
          <>Ainda não há histórico dos últimos 3 meses. Registre suas receitas e despesas em Lançamentos para eu calcular sua sobra mensal.</>
        ) : plan.surplus > 0 ? (
          <>Nos últimos 3 meses você ganhou em média <b>{brl(facts.avgIncome)}</b> e gastou <b>{brl(facts.avgExpense)}</b>. Sobram cerca de <b>{brl(plan.surplus)}</b> por mês, e é daqui que sai o seu investimento.</>
        ) : (
          <>Você gasta em média <b>{brl(facts.avgExpense)}</b> e ganha <b>{brl(facts.avgIncome)}</b>. Antes de investir, o caminho é reduzir despesas ou aumentar a renda. Veja o relatório de Categorias para achar onde cortar.</>
        ),
    },
    {
      n: 2,
      title: "Quite as dívidas caras primeiro",
      status: plan.badDebts.length ? "todo" : "ok",
      body: plan.badDebts.length ? (
        <>
          Dívida com juros altos quase sempre custa mais do que qualquer investimento rende. Priorize, da mais cara para a mais barata:
          <ul className="mt-2 list-disc pl-5">
            {plan.badDebts.map((d) => (
              <li key={d.name}>
                {d.name}: {brl(d.balance)} a {d.rate.toString().replace(".", ",")}% ao mês
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>Nenhuma dívida cara cadastrada (acima de 1,5% ao mês). Se tiver cartão rotativo, cheque especial ou empréstimo pessoal, cadastre em Dívidas.</>
      ),
    },
    {
      n: 3,
      title: "Monte sua reserva de emergência",
      status: plan.gap === 0 && facts.avgExpense > 0 ? "ok" : "todo",
      body:
        facts.avgExpense === 0 ? (
          <>A reserva cobre {plan.monthsReserve} meses de gastos. Registre suas despesas para eu calcular o valor.</>
        ) : (
          <>
            Meta: <b>{plan.monthsReserve} meses</b> de gastos = <b>{brl(plan.target)}</b>. Hoje você tem cerca de <b>{brl(plan.have)}</b> disponível (contas + renda fixa).{" "}
            {plan.gap > 0 ? <>Faltam <b>{brl(plan.gap)}</b>.</> : <>Meta atingida.</>}
            <br />
            Onde: {where_reserva}
          </>
        ),
    },
    {
      n: 4,
      title: `Escolha onde investir (perfil ${plan.profile})`,
      status: "info",
      body: (
        <>
          {plan.where}
          <div className="mt-3 flex flex-col gap-2">
            {plan.alloc.map(([label, v]) => (
              <div key={label as string}>
                <div className="flex justify-between text-xs">
                  <span>{label}</span>
                  <b>{pct(v as number)}</b>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-raised">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${v}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            Esse é um ponto de partida didático, não uma regra. Só comece pela renda variável depois da reserva pronta e invista nela dinheiro que você não vai precisar em menos de 5 anos.
          </p>
        </>
      ),
    },
    {
      n: 5,
      title: "Defina quanto aportar por mês",
      status: "info",
      body: plan.aport ? (
        <>
          Com a sua sobra, algo entre <b>{brl(plan.aport[0])}</b> e <b>{brl(plan.aport[1])}</b> por mês é um bom ponto de partida. O mais importante é a constância: programe o aporte logo que o salário cair. Veja o efeito no <Link href="/simulador" className="font-bold text-accent-soft underline">Simulador</Link>.
        </>
      ) : (
        <>Assim que houver sobra mensal, comece com qualquer valor, até R$ 50. Criar o hábito vale mais que o tamanho do aporte. Depois use o <Link href="/simulador" className="font-bold text-accent-soft underline">Simulador</Link> para ver o efeito do tempo.</>
      ),
    },
    {
      n: 6,
      title: "Registre e acompanhe",
      status: "info",
      body: (
        <>
          Cadastre o que você comprar em <Link href="/investimentos" className="font-bold text-accent-soft underline">Investimentos</Link> e ligue às suas <Link href="/metas" className="font-bold text-accent-soft underline">Metas</Link>. Revise a cada 3 a 6 meses, não todo dia: oscilações curtas assustam, mas importam pouco no longo prazo.
        </>
      ),
    },
  ];

  const sel = (label: string, value: string, onChange: (v: string) => void, opts: [string, string][]) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold text-muted">{label}</span>
      <select className={fieldCls} value={value} onChange={(e) => onChange(e.target.value)}>
        {opts.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );

  return (
    <>
      <section className="rounded-[20px] border border-line bg-surface p-5.5">
        <h2 className="mb-1 text-base font-bold">Conte um pouco sobre você</h2>
        <p className="mb-4 text-xs text-muted">Suas respostas ajustam a trilha abaixo, que também usa seus lançamentos, contas, dívidas e investimentos do Mymony.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {sel("Qual o seu objetivo?", goal, (v) => setGoal(v as Goal), [
            ["reserva", "Reserva de emergência"],
            ["curto", "Algo em até 2 anos (viagem, carro)"],
            ["medio", "Algo em 2 a 5 anos (entrada de imóvel)"],
            ["longo", "Mais de 5 anos (patrimônio)"],
            ["renda", "Viver de renda no futuro"],
          ])}
          {sel("Sua experiência", exp, (v) => setExp(v as Exp), [
            ["zero", "Nunca investi"],
            ["pouco", "Já usei poupança/CDB"],
            ["ok", "Já invisto há um tempo"],
          ])}
          {sel("Se o investimento cair 10% em um mês, você…", risk, (v) => setRisk(v as Risk), [
            ["baixo", "Vende para não perder mais"],
            ["medio", "Fica incomodado, mas espera"],
            ["alto", "Aproveita para comprar mais"],
          ])}
          {sel("Sua renda", job, (v) => setJob(v as Job), [
            ["estavel", "Estável (CLT, concursado)"],
            ["variavel", "Variável (autônomo, comissão)"],
          ])}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold">Sua trilha</h2>
        {steps.map((s) => (
          <div key={s.n} className="flex gap-4 rounded-[20px] border border-line bg-surface p-5">
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${
                s.status === "ok" ? "bg-income-bg text-income-text" : s.status === "todo" ? "bg-warn-bg text-warn-text" : "bg-raised text-soft"
              }`}
            >
              {s.status === "ok" ? "✓" : s.n}
            </span>
            <div className="min-w-0 text-sm leading-relaxed text-soft">
              <b className="mb-1 block text-base text-text">{s.title}</b>
              {s.body}
            </div>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-[20px] border border-line bg-surface">
        <h2 className="px-5 py-4 text-base font-bold">Aprenda o básico</h2>
        {LESSONS.map((l, i) => (
          <div key={l.t} className="border-t border-line">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              aria-expanded={open === i}
              className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 px-5 py-3 text-left text-sm font-bold hover:bg-side"
            >
              {l.t}
              <span className="text-muted">{open === i ? "−" : "+"}</span>
            </button>
            {open === i && <p className="px-5 pb-4 text-sm leading-relaxed text-soft">{l.b}</p>}
          </div>
        ))}
      </section>

      <p className="rounded-xl bg-raised px-4 py-3 text-xs text-muted">
        Conteúdo educativo, não é recomendação de investimento. O Mymony não é consultor financeiro licenciado e não conhece todos os seus detalhes. Rentabilidades passadas não garantem as futuras e as taxas mudam: confira as condições atuais antes de aplicar e, para decisões grandes, converse com um profissional certificado (CFP ou analista CVM).
      </p>
    </>
  );
}

const where_reserva = "Tesouro Selic ou CDB com liquidez diária pagando 100% do CDI ou mais. Evite renda variável aqui: esse dinheiro precisa estar lá quando você precisar.";
