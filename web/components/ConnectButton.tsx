"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet, type Discovered } from "@/lib/wallet";

function short(a: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}

export function ConnectButton() {
  const { address, connecting, wallets, connect, disconnect } = useWallet();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function onPick(w: Discovered) {
    setErr("");
    try {
      await connect(w);
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  function copy() {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  if (!address) {
    return (
      <div className="relative" ref={ref}>
        <button onClick={() => setOpen((o) => !o)} disabled={connecting} className="ink-pill text-sm">
          {connecting ? "Connecting…" : "Connect wallet"}
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-64 card p-2 z-30 shadow-lg">
            <p className="eyebrow px-2 py-2">Choose a wallet</p>
            {wallets.length === 0 ? (
              <div className="px-2 py-2">
                <p className="text-xs text-body">No wallet detected.</p>
                <a href="https://rabby.io" target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-ink underline underline-offset-4">
                  Install a wallet (Rabby / MetaMask) ↗
                </a>
              </div>
            ) : (
              wallets.map((w) => (
                <button
                  key={w.info.uuid}
                  onClick={() => onPick(w)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-strong transition-colors text-left"
                >
                  {w.info.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={w.info.icon} alt="" width={20} height={20} className="rounded" />
                  ) : (
                    <span className="w-5 h-5 rounded bg-surface-strong" />
                  )}
                  <span className="text-sm font-medium text-ink">{w.info.name}</span>
                </button>
              ))
            )}
            {err && <p className="px-3 py-2 text-xs text-error break-words">{err}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="btn-outline text-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-success" />
        <span className="font-mono">{short(address)}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-72 card p-2 z-30 shadow-lg">
          <div className="p-2">
            <div className="eyebrow">Connected wallet</div>
            <div className="font-mono text-sm text-ink break-all mt-1.5">{address}</div>
            <div className="flex gap-2 mt-3">
              <button onClick={copy} className="btn-outline text-xs flex-1 !py-2">
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={() => {
                  disconnect();
                  setOpen(false);
                }}
                className="btn-outline text-xs flex-1 !py-2"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
