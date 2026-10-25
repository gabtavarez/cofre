export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-busy="true" aria-label="Carregando">
      <div className="flex flex-col gap-2">
        <div className="h-3 w-28 rounded bg-raised" />
        <div className="h-8 w-56 rounded-lg bg-raised" />
      </div>
      <div className="flex flex-wrap gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 min-w-55 flex-1 rounded-[20px] border border-line bg-surface" />
        ))}
      </div>
      <div className="h-80 rounded-[20px] border border-line bg-surface" />
    </div>
  );
}
