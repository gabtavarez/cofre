import { ShareButton } from "@/components/ShareButtons";
import { ActionForm, Field, fieldCls } from "@/components/forms";
import { inviteMember } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";

type Row = { id: string; owner_id: string; owner_email: string | null; email: string; member_id: string | null; status: string };

export default async function Compartilhar() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const me = auth?.claims?.sub as string;
  const myEmail = String(auth?.claims?.email ?? "").toLowerCase();
  const { data } = await supabase.from("household_members").select("*").order("created_at");
  const rows = (data ?? []) as Row[];

  const invitesToMe = rows.filter((r) => r.status === "pending" && r.email.toLowerCase() === myEmail && r.owner_id !== me);
  const joined = rows.find((r) => r.status === "accepted" && r.member_id === me);
  const mine = rows.filter((r) => r.owner_id === me);

  return (
    <>
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">Compartilhar</h1>
        <p className="mt-1 text-sm text-muted">Use o mesmo Mymony com outra pessoa (parceiro, família) — os dois veem e editam os mesmos dados.</p>
      </header>

      {invitesToMe.map((r) => (
        <section key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-accent bg-accent-bg p-5">
          <p className="text-sm">
            <b>{r.owner_email}</b> convidou você para compartilhar o Mymony. Ao aceitar, você passa a ver os dados dele(a) no lugar dos seus.
          </p>
          <ShareButton id={r.id} kind="accept" label="Aceitar convite" />
        </section>
      ))}

      {joined && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-line bg-surface p-5">
          <p className="text-sm">
            Você está usando o Mymony de <b>{joined.owner_email}</b>.
          </p>
          <ShareButton id={joined.id} kind="remove" label="Sair do compartilhamento" danger />
        </section>
      )}

      {!joined && (
        <>
          <section className="flex flex-col gap-4 rounded-[20px] border border-line bg-surface p-5">
            <b>Convidar alguém</b>
            <ActionForm action={inviteMember} submitLabel="Convidar">
              <Field label="E-mail da pessoa" className="min-w-64 flex-1">
                <input name="email" type="email" required placeholder="nome@email.com" className={fieldCls} />
              </Field>
            </ActionForm>
            <p className="text-xs text-muted">
              A pessoa precisa criar uma conta com esse e-mail e aceitar o convite aqui. Quem aceita passa a ver e editar os seus dados; a conta e os dados dela anteriores ficam guardados, separados.
            </p>
          </section>

          {mine.length > 0 && (
            <section className="overflow-hidden rounded-[20px] border border-line bg-surface">
              <div className="px-5 py-4 font-bold">Convites e pessoas</div>
              {mine.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{r.email}</span>
                    <span className="text-xs text-muted">{r.status === "accepted" ? "Com acesso" : "Convite pendente"}</span>
                  </div>
                  <ShareButton id={r.id} kind="remove" label={r.status === "accepted" ? "Remover acesso" : "Cancelar"} danger />
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </>
  );
}
