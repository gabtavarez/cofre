# Cofre

Organizador financeiro pessoal: receitas e despesas (únicas, parceladas ou fixas), contas, categorias com limite mensal e painel com fluxo de caixa. Next.js 16 + Supabase (Postgres + login), pronto para a Vercel.

## 1. Supabase (uma vez)

1. Crie um projeto em [supabase.com](https://supabase.com) (plano gratuito basta).
2. **SQL Editor** → cole todo o conteúdo de `supabase/schema.sql` → Run.
3. **Project Settings → API**: copie a *Project URL* e a *anon public key*.
4. **Authentication → Sign In / Providers → Email**: para uso pessoal, desligue *Confirm email* (entra direto). Depois de criar a sua conta, desligue também **Allow new users to sign up** — assim ninguém mais consegue se cadastrar.

## 2. Rodar localmente

```bash
cp .env.example .env.local   # preencha as duas variáveis
npm install
npm run dev                  # http://localhost:3000
```

Crie sua conta na tela de login, depois cadastre uma conta em **Contas** (com o saldo de hoje) e comece a lançar.

## 3. Deploy na Vercel

1. Suba o projeto para um repositório no GitHub.
2. Na Vercel: **Add New → Project** → importe o repositório (framework Next.js é detectado sozinho).
3. Em **Environment Variables**, adicione `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Deploy. Se um dia reativar a confirmação de e-mail, ajuste **Authentication → URL Configuration → Site URL** no Supabase para o domínio da Vercel.

## Como funciona

- **Saldo atual** = saldo inicial das contas + lançamentos *pagos* até hoje. **Projetado** soma também os pendentes (inclusive atrasados) até o fim do mês.
- **Parcelada**: o valor informado é o total; ele é dividido em N parcelas mensais (a sobra de centavos vai para a última).
- **Fixa mensal**: cria os próximos 12 meses. Para encerrar, apague “este e os próximos”.
- Cada linha tem `user_id` e as políticas RLS isolam os dados por usuário, então liberar o app para outras pessoas é só reativar o cadastro; nenhum dado se mistura.

## Próximos passos sugeridos

- Editar lançamento existente (hoje é apagar e recriar)
- Cartão de crédito com fatura e melhor dia de compra
- Importar extrato OFX/CSV
- Investimentos (carteira, aportes, rentabilidade)
- Estender automaticamente os lançamentos fixos (job mensal)
- Saldos agregados em SQL (view/RPC) se o volume de lançamentos crescer muito
