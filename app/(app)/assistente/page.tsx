import { ChatClient } from "@/components/ChatClient";
import { proGate } from "@/components/ProGate";

export default async function Assistente() {
  const gate = await proGate("Assistente", "Converse com uma IA que conhece as suas contas, gastos, metas e dívidas e responde com base neles.");
  if (gate) return gate;
  return (
    <>
      <header className="flex flex-col gap-1">
        <span className="text-[13px] text-muted">Pergunte sobre as suas contas, gastos, metas e dívidas</span>
        <h1 className="text-3xl font-extrabold">Assistente</h1>
      </header>
      <ChatClient />
    </>
  );
}
