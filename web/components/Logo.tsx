// Aegis mark — a scales-of-justice seal inside a shield (protection + fair arbitration),
// filled with the brand's mint→sky→lavender gradient.
export function AegisMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="aegisGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6ee0c2" />
          <stop offset="0.55" stopColor="#7eb2f0" />
          <stop offset="1" stopColor="#c0a9ec" />
        </linearGradient>
      </defs>
      <path
        d="M16 2.5 L27 6.2 V15 C27 22.4 22.3 27.4 16 29.5 C9.7 27.4 5 22.4 5 15 V6.2 Z"
        fill="url(#aegisGrad)"
        stroke="#0c0a09"
        strokeOpacity="0.14"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      {/* scales of justice */}
      <circle cx="16" cy="9.5" r="1" fill="#0c0a09" />
      <line x1="16" y1="10" x2="16" y2="21" stroke="#0c0a09" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="10.5" y1="11.6" x2="21.5" y2="11.6" stroke="#0c0a09" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M10.5 11.6 L8.7 15.4 L12.3 15.4 Z" fill="#ffffff" stroke="#0c0a09" strokeWidth="1" strokeLinejoin="round" />
      <path d="M21.5 11.6 L19.7 15.4 L23.3 15.4 Z" fill="#ffffff" stroke="#0c0a09" strokeWidth="1" strokeLinejoin="round" />
      <line x1="12.5" y1="21" x2="19.5" y2="21" stroke="#0c0a09" strokeWidth="1.3" strokeLinecap="round" />
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
