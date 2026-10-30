// Mês escolhido, guardado só em memória: persiste ao navegar entre páginas, volta ao atual ao recarregar.
let selected: string | null = null;
const listeners = new Set<() => void>();

export const getSelectedMonth = () => selected;
export const subscribeMonth = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export function setSelectedMonth(m: string) {
  if (m === selected) return;
  selected = m;
  listeners.forEach((fn) => fn());
}
