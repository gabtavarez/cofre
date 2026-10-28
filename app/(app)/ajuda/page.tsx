import { Faq } from "@/components/Faq";

export default function Ajuda() {
  return (
    <>
      <header className="flex flex-col gap-1">
        <span className="text-[13px] text-muted">Respostas rápidas para as dúvidas mais comuns</span>
        <h1 className="text-3xl font-extrabold">Ajuda e perguntas frequentes</h1>
      </header>
      <Faq />
    </>
  );
}
