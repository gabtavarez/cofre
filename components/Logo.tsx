export function Monogram({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Mymony" className={className}>
      <rect width="64" height="64" rx="19" fill="#C8F169" />
      <path
        d="M16 45V29a8 8 0 0 1 16 0v16M32 29a8 8 0 0 1 16 0v16"
        fill="none"
        stroke="#0A0F1E"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="16" r="3.6" fill="#0A0F1E" />
    </svg>
  );
}

export function Logo({ size = 36, textClass = "text-[22px]" }: { size?: number; textClass?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <Monogram size={size} />
      <span className={`font-display font-extrabold ${textClass}`}>mymony</span>
    </span>
  );
}
