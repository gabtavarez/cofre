import { ImportClient } from "@/components/ImportClient";
import { getBase, getCategoryHints } from "@/lib/data";

export default async function Importar() {
  const [{ accounts, categories }, hints] = await Promise.all([getBase(), getCategoryHints()]);
  return (
    <>
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">Importar extrato</h1>
        <p className="mt-1 text-sm text-muted">Traga os lançamentos do banco sem digitar nada.</p>
      </header>
      {accounts.length === 0 ? (
        <p className="rounded-xl bg-raised px-4 py-3 text-sm text-soft">Crie uma conta antes de importar.</p>
      ) : (
        <ImportClient
          accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
          categories={categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))}
          hints={hints}
        />
      )}
    </>
  );
}
