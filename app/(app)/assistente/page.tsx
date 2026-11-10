import { ChatClient } from "@/components/ChatClient";

export default function Assistente() {
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
