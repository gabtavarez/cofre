import { ActionForm, DeleteButton, Field, LimitInput, fieldCls } from "@/components/forms";
import { createCategory, deleteCategory, setCategoryLimit } from "@/lib/actions";
import { getBase } from "@/lib/data";

export default async function Categorias() {
  const { categories } = await getBase();
  const expense = categories.filter((c) => c.kind === "expense");
  const income = categories.filter((c) => c.kind === "income");

  return (
    <>
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">Categorias e limites</h1>
        <p className="mt-1 text-sm text-muted">
          O limite mensal de cada categoria de despesa aparece na visão geral. Deixe vazio para não limitar.
        </p>
      </header>

      <section className="rounded-[20px] border border-line bg-surface p-5.5">
        <h2 className="mb-4 text-base font-bold">Nova categoria</h2>
        <ActionForm action={createCategory} submitLabel="Adicionar">
          <Field label="Nome" className="min-w-52 flex-1">
            <input name="name" required placeholder="Ex.: Pets" className={fieldCls} />
          </Field>
          <Field label="Tipo" className="min-w-40">
            <select name="kind" defaultValue="expense" className={fieldCls}>
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
            </select>
          </Field>
          <Field label="Limite mensal (R$)" className="min-w-44">
            <input name="monthly_limit" inputMode="decimal" placeholder="opcional" className={fieldCls} />
          </Field>
        </ActionForm>
      </section>

      <div className="flex flex-wrap gap-4">
        <section className="min-w-80 flex-[3_1_420px] overflow-hidden rounded-[20px] border border-line bg-surface">
          <h2 className="px-5 py-4 text-base font-bold">Despesas</h2>
          {expense.map((c) => (
            <div key={c.id} className="flex items-center gap-3 border-t border-line px-5 py-2.5">
              <b className="flex-1 truncate text-sm">{c.name}</b>
              <LimitInput initial={c.monthly_limit} action={setCategoryLimit.bind(null, c.id)} />
              <DeleteButton action={deleteCategory.bind(null, c.id)} label={`Apagar a categoria ${c.name}`} />
            </div>
          ))}
        </section>

        <section className="min-w-72 flex-[2_1_300px] self-start overflow-hidden rounded-[20px] border border-line bg-surface">
          <h2 className="px-5 py-4 text-base font-bold">Receitas</h2>
          {income.map((c) => (
            <div key={c.id} className="flex items-center gap-3 border-t border-line px-5 py-2.5">
              <b className="flex-1 truncate text-sm">{c.name}</b>
              <DeleteButton action={deleteCategory.bind(null, c.id)} label={`Apagar a categoria ${c.name}`} />
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
