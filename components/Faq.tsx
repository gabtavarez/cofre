"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fieldCls } from "@/components/forms";

type QA = { q: string; a: React.ReactNode; text: string };
const qa = (q: string, a: string): QA => ({ q, a, text: a });

const SECTIONS: { id: string; title: string; items: QA[] }[] = [
  {
    id: "comecar",
    title: "Primeiros passos",
    items: [
      qa("Por onde eu começo?", "1) Em Contas, cadastre suas contas (banco, carteira) com o saldo de hoje. 2) Em Lançamentos, registre suas receitas e despesas, inclusive as fixas. 3) Veja a Visão geral para acompanhar saldo, previsão do mês e vencimentos. O botão “+” (no celular) e o “Novo lançamento” (no computador) são o jeito mais rápido de registrar."),
      qa("Preciso informar o saldo atual das minhas contas?", "Sim, ao criar a conta informe o saldo inicial. Se o saldo no app divergir do banco, use “Ajustar saldo” em Lançamentos ou Contas: ele cria um lançamento de ajuste com a diferença, sem apagar o seu histórico."),
      qa("O que significam as cores?", "Verde é dinheiro que entrou (receita), rosa é dinheiro que saiu (despesa), amarelo é algo agendado ou perto de vencer, e lima é a cor da marca e das ações do app. Lilás indica investimentos."),
      qa("Posso usar no celular como um app?", "Sim. No iPhone, abra o site no Safari, toque em Compartilhar e escolha “Adicionar à Tela de Início”. No Android, no Chrome, abra o menu e escolha “Instalar app” ou “Adicionar à tela inicial”. Ele abre em tela cheia e atualiza sozinho."),
    ],
  },
  {
    id: "lancamentos",
    title: "Lançamentos",
    items: [
      qa("Qual a diferença entre pago e agendado?", "Agendado é um lançamento futuro ou ainda não confirmado: ele entra na previsão, mas não no saldo atual. Ao tocar no ícone do relógio, ele vira pago (ou recebido) e passa a contar no saldo de hoje. Atrasado é um lançamento com data passada que ainda não foi marcado como pago."),
      qa("Como lanço uma compra parcelada?", "Em Novo lançamento escolha a repetição “Parcelado” e informe o valor total e o número de parcelas. O app divide o valor (a diferença de centavos vai na primeira parcela) e cria uma parcela por mês."),
      qa("Como funcionam as contas fixas e anuais?", "Fixa repete todo mês, como aluguel e assinaturas. Anual repete uma vez por ano, como o 13º ou um seguro. O app cria os próximos meses automaticamente e renova a série sozinho quando ela está chegando ao fim. Para parar, apague “este e os próximos”."),
      qa("Como edito ou apago só um mês de uma série?", "Ao editar ou apagar um lançamento de uma série, o app pergunta se vale “só este” ou “este e os próximos”. Apagar os próximos também interrompe a renovação automática."),
      qa("Posso buscar um lançamento antigo?", "Sim. Em Lançamentos use a busca por descrição e os filtros de categoria, conta, tipo e status. Marque “Todos os meses” para procurar em todo o histórico."),
      qa("Como o app sugere a categoria?", "Ele aprende com o que você já lançou: se você sempre põe “Uber” em Transporte, da próxima vez sugere Transporte. Você pode trocar a sugestão na hora."),
    ],
  },
  {
    id: "contas",
    title: "Contas, categorias e limites",
    items: [
      qa("Para que servem as categorias e os limites?", "Categorias organizam seus gastos nos relatórios. O limite mensal define quanto você quer gastar numa categoria e a tela mostra o quanto já usou, para você se ajustar antes de estourar."),
      qa("Posso ter várias contas?", "Sim: conta corrente, poupança, dinheiro, cartão e investimento. O saldo geral soma todas, e você pode filtrar os lançamentos por conta."),
      qa("Transferir dinheiro entre minhas contas conta como gasto?", "Ainda não existe uma opção própria de transferência. Por enquanto, lance uma despesa na conta de origem e uma receita na de destino com a mesma descrição. Isso aparece nos relatórios, então é uma melhoria planejada."),
      qa("O cartão de crédito tem fatura?", "Ainda não. Compras no cartão entram como despesa na data da compra. A fatura com fechamento e vencimento é uma das próximas melhorias."),
    ],
  },
  {
    id: "planejar",
    title: "Planejamento e metas",
    items: [
      qa("O que é o “Gasto sem remorso”?", "É a verba que você pode gastar com você sem culpa. O app soma o dinheiro que você já tinha antes do mês (saldo anterior) com as receitas do mês, tira o que já está comprometido e separa a poupança e um colchão (porcentagens só sobre as receitas do mês) para imprevistos, e o que sobra é a sua verba. Você escolhe quais categorias contam como gasto pessoal e quanto quer guardar."),
      qa("Como funciona a Lista de desejos?", "Você cadastra o que quer comprar, com preço e prioridade. O app compara com a sua verba do Gasto sem remorso e diz se o item cabe agora, no mês que vem ou em quantos meses. Ele também sugere a combinação que cabe na verba, começando pelas prioridades altas. Ao tocar em “Comprei”, cria o lançamento e a verba do mês se atualiza. A opção de esperar 7 dias bloqueia a compra por impulso."),
      qa("Como funcionam as metas?", "Você define um valor e, se quiser, um prazo. Cada depósito soma no progresso. Uma meta pode ser ligada a um investimento: aí o progresso acompanha o valor atual desse investimento."),
      qa("O que aparece como “Sem remorso” na Visão geral?", "É a sua verba pessoal do mês dividida pelos dias que faltam, a mesma da página Gasto sem remorso. Ela já desconta compromissos, poupança e colchão, por isso é bem menor que o saldo da conta. Tocar no aviso abre o detalhe."),
      qa("Como uso a tela de Dívidas?", "Cadastre cada dívida com saldo, juros ao mês e parcela. Registre os pagamentos para o saldo cair. A tela de Aprender a investir também usa as suas dívidas para dizer o que quitar primeiro."),
    ],
  },
  {
    id: "investir",
    title: "Investimentos e aprendizado",
    items: [
      qa("O app compra investimentos por mim?", "Não. O Mymony não faz operações. Ele serve para registrar o que você tem, acompanhar a evolução e se organizar. Você compra na sua corretora ou banco e atualiza o valor aqui."),
      qa("O app dá recomendação de investimento?", "Não. A página Aprender a investir é educativa: monta uma trilha com base nos seus números e responde ao básico, mas não é recomendação personalizada nem consultoria. O app não é consultor licenciado. Para decisões grandes, converse com um profissional certificado."),
      qa("Como o simulador calcula?", "Com juros compostos mensais: o valor inicial e os aportes rendem a taxa que você informar. Ele também calcula quanto guardar por mês para chegar a um objetivo e para viver de renda. Rentabilidade passada não garante a futura."),
      qa("Por que o patrimônio não tem histórico antigo?", "O histórico do patrimônio é gravado uma vez por mês, quando você abre a página Patrimônio. Ele começa na primeira vez que foi aberta e vai crescendo daí."),
    ],
  },
  {
    id: "dados",
    title: "Importar, exportar e compartilhar",
    items: [
      qa("Como importo o extrato do meu banco?", "Em Importar extrato escolha a conta e envie um arquivo .ofx ou .csv exportado no app ou site do banco. Você confere as linhas e as categorias antes de importar. Lançamentos já importados e os que parecem já lançados à mão são sinalizados para você não duplicar."),
      qa("O app conecta direto com o banco (Open Finance)?", "Não. A conexão automática costuma ser paga e exige contratos com instituições. A importação por arquivo é a alternativa gratuita."),
      qa("Como exporto meus dados para o Excel?", "Em Lançamentos use “Este mês (CSV)” ou “Tudo (CSV)”. O arquivo usa ponto e vírgula e abre direto no Excel em português, com acentos corretos."),
      qa("Como divido o app com outra pessoa?", "Em Compartilhar, convide a pessoa pelo e-mail. Ela cria a conta, aceita o convite e passa a ver e editar os mesmos dados que você, como num app de casal. Você pode remover o acesso a qualquer momento. Quem aceita deixa de ver os dados que tinha antes, que ficam guardados separados."),
    ],
  },
  {
    id: "seguranca",
    title: "Privacidade e segurança",
    items: [
      qa("O que é o modo privacidade?", "O ícone de olho ao lado do logo esconde todos os valores na tela, trocando por “R$ ••••”. É útil para usar o app perto de outras pessoas. Ele fica lembrado no seu aparelho."),
      qa("Meus dados estão seguros?", "Cada pessoa só enxerga os próprios dados, protegidos por regras no banco de dados. A conexão é criptografada. O Mymony não pede nem guarda senha de banco. Use uma senha forte e única e, se possível, entre com o Google."),
      qa("Como entro com o Google?", "Na tela de login, use “Entrar com Google”, abaixo do formulário. Se usar o mesmo e-mail de uma conta que já existe, os dados costumam ficar na mesma conta. Se aparecer um app vazio, avise para eu juntar as contas."),
      qa("Esqueci minha senha. O que faço?", "Se você entrou com e-mail e senha, peça a redefinição ao responsável pelo app. Entrar com o Google com o mesmo e-mail também resolve na maioria dos casos."),
    ],
  },
  {
    id: "problemas",
    title: "Problemas comuns",
    items: [
      qa("O saldo está diferente do meu banco.", "Confira se há lançamentos ainda não marcados como pagos e se o saldo inicial da conta está certo. Se a diferença persistir, use “Ajustar saldo” para igualar ao banco. Ele registra a diferença como um lançamento de ajuste."),
      qa("Apaguei um lançamento sem querer.", "O app não tem lixeira, então a exclusão é definitiva. Se for um lançamento de uma série, recrie-o com a mesma data e valor. Antes de grandes mudanças, exporte o CSV como cópia de segurança."),
      qa("Os números da página Aprender a investir parecem estranhos.", "Ela usa a média dos meses que já têm lançamentos, passados e futuros. Se há poucos meses cadastrados, a média pode não representar a sua rotina. Lance mais meses para melhorar."),
      qa("A tela demora ou parece travada.", "Atualize a página. Se o app estiver instalado na tela inicial, feche e abra de novo. Persistindo, avise qual tela e o que você fez."),
    ],
  },
];

export function Faq() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [cat, setCat] = useState("todas");

  const needle = q.trim().toLowerCase();
  const sections = useMemo(
    () =>
      SECTIONS.filter((s) => cat === "todas" || s.id === cat)
        .map((s) => ({
          ...s,
          items: s.items.filter((i) => !needle || i.q.toLowerCase().includes(needle) || i.text.toLowerCase().includes(needle)),
        }))
        .filter((s) => s.items.length > 0),
    [needle, cat],
  );

  return (
    <>
      <div className="flex flex-col gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar uma dúvida…"
          aria-label="Buscar nas perguntas frequentes"
          className={fieldCls}
        />
        <div className="flex flex-wrap gap-2">
          {[{ id: "todas", title: "Todas" }, ...SECTIONS].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setCat(s.id)}
              aria-pressed={cat === s.id}
              className={`min-h-9 cursor-pointer rounded-full border px-3.5 text-[13px] font-bold ${
                cat === s.id ? "border-accent bg-accent text-ink" : "border-edge bg-side text-soft hover:border-accent"
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>

      {sections.length === 0 && (
        <p className="rounded-xl bg-raised px-4 py-6 text-center text-sm text-muted">Não achei nada com essa busca. Tente outra palavra.</p>
      )}

      {sections.map((s) => (
        <section key={s.id} className="overflow-hidden rounded-[20px] border border-line bg-surface">
          <h2 className="px-5 py-4 text-base font-bold">{s.title}</h2>
          {s.items.map((i) => {
            const key = `${s.id}:${i.q}`;
            const isOpen = open === key || !!needle;
            return (
              <div key={key} className="border-t border-line">
                <button
                  type="button"
                  onClick={() => setOpen(open === key ? null : key)}
                  aria-expanded={isOpen}
                  className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 px-5 py-3 text-left text-sm font-bold hover:bg-side"
                >
                  {i.q}
                  <span className="text-muted">{isOpen ? "−" : "+"}</span>
                </button>
                {isOpen && <p className="px-5 pb-4 text-sm leading-relaxed text-soft">{i.a}</p>}
              </div>
            );
          })}
        </section>
      ))}

      <p className="text-center text-xs text-muted">
        Não achou o que procurava? Veja também <Link href="/aprender" className="font-bold text-accent-soft underline">Aprender a investir</Link>.
      </p>
    </>
  );
}
