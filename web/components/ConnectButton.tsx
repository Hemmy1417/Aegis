"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@/lib/wallet";

function short(a: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}

export function ConnectButton() {
  const { address, connecting, hasWallet, connect, disconnect } = useWallet();
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

  async function onConnect() {
    setErr("");
    try {
      await connect();
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
        <button onClick={onConnect} disabled={connecting} className="ink-pill text-sm">
          {connecting ? "Connecting…" : "Connect wallet"}
        </button>
        {(err || !hasWallet) && (
          <div className="absolute right-0 mt-2 w-64 card p-3 z-30 shadow-lg">
            <p className="text-xs text-body">
              {err || "No wallet detected."}
            </p>
            {!hasWallet && (
              <a
                href="https://rabby.io"
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs text-ink underline underline-offset-4"
              >
                Install a wallet (Rabby / MetaMask) ↗
              </a>
            )}
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
