"use client";

import { useState } from "react";
import { specHash, shortHash } from "@/lib/aegis";

// "Terms locked on-chain" trust signal + a verifiable fingerprint of the spec.
export function SpecLock({ terms, compact }: { terms: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const hash = specHash(terms);

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted">
        <LockIcon /> Locked on-chain
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap text-xs">
      <span className="badge !bg-emerald-50 !text-emerald-800">
        <LockIcon /> Terms locked on-chain
      </span>
      <span className="text-muted">neither side can change them ·</span>
      <button
        onClick={() => {
          navigator.clipboard.writeText(hash);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        title="Spec fingerprint — copy to verify both parties see the same terms"
        className="font-mono text-muted hover:text-ink transition-colors"
      >
        {copied ? "copied" : shortHash(hash)}
      </button>
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
