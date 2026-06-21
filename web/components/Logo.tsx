// Aegis mark — a shield (protection/escrow) cradling a balance beam (arbitration).
// Drawn with currentColor so it inherits ink on light surfaces / white on dark.
export function AegisMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M16 2.5 L27 6.2 V15 C27 22.4 22.3 27.4 16 29.5 C9.7 27.4 5 22.4 5 15 V6.2 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="none"
      />
      {/* balance beam */}
      <line x1="10.5" y1="13" x2="21.5" y2="13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="16" y1="10.5" x2="16" y2="20" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      {/* pans */}
      <path d="M8.5 13 L12.5 13 L10.5 17 Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none" />
      <path d="M19.5 13 L23.5 13 L21.5 17 Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function AegisWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <AegisMark size={26} />
      <span className="display text-[1.35rem] tracking-tight" style={{ fontWeight: 400 }}>
        Aegis
      </span>
    </span>
  );
}
