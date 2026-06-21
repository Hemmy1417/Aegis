"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@/lib/wallet";

function short(a: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}

export function ConnectButton() {
  const { address, method, connecting, hasMetaMask, connectBuiltIn, connectMetaMask, disconnect } =
    useWallet();
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

  async function onMetaMask() {
    setErr("");
    try {
      await connectMetaMask();
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  function onBuiltIn() {
    setErr("");
    connectBuiltIn();
    setOpen(false);
  }

  function copy() {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={address ? "btn-outline text-sm" : "ink-pill text-sm"}
      >
        {address ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            <span className="font-mono">{short(address)}</span>
          </>
        ) : connecting ? (
          "Connecting…"
        ) : (
          "Connect wallet"
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 card p-2 z-30 shadow-lg">
          {address ? (
            <div className="p-2">
              <div className="eyebrow">{method === "metamask" ? "Browser wallet" : "Instant wallet"}</div>
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
          ) : (
            <div className="p-1">
              <p className="eyebrow px-2 py-2">Choose a wallet</p>
              <button
                onClick={onBuiltIn}
                className="w-full text-left px-3 py-3 rounded-lg border border-hairline-strong hover:bg-surface-strong transition-colors"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-ink">⚡ Instant wallet</span>
                  <span className="badge !bg-success/12 !text-success">Recommended</span>
                </div>
                <div className="text-xs text-muted mt-1">No extension · gas sponsored on Studionet</div>
              </button>
              <button
                onClick={onMetaMask}
                disabled={!hasMetaMask}
                className="w-full text-left px-3 py-3 mt-1 rounded-lg hover:bg-surface-strong transition-colors disabled:opacity-40"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-ink">🦊 Browser wallet</span>
                  <span className="badge">Beta</span>
                </div>
                <div className="text-xs text-muted mt-1">
                  {hasMetaMask ? "MetaMask, Rabby, etc." : "Not detected"}
                </div>
              </button>
              {err && <p className="px-3 py-2 text-xs text-error break-words">{err}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
