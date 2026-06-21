"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { getAddress } from "viem";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

type WalletState = {
  address: string;
  client: Client | null;
  connecting: boolean;
  hasWallet: boolean; // an injected EIP-1193 wallet is present
  chainName: string;
  gasSponsored: boolean; // Studionet covers gas; users still need GEN to fund escrow
  balanceWei: bigint | null;
  refreshBalance: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => void;
};

const Ctx = createContext<WalletState | null>(null);
const CONNECTED_KEY = "aegis_connected";
const STUDIONET_HEX = "0xF22F"; // 61999
const CHAIN_NAME = "Studionet";
const GAS_SPONSORED = true;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function eth(): any {
  return typeof window !== "undefined" ? (window as { ethereum?: unknown }).ethereum : undefined;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState("");
  const [client, setClient] = useState<Client | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);
  const [balanceWei, setBalanceWei] = useState<bigint | null>(null);

  const refreshBalance = useCallback(async () => {
    if (!client || !address) {
      setBalanceWei(null);
      return;
    }
    try {
      const b = await client.getBalance({ address });
      setBalanceWei(BigInt(b));
    } catch {
      setBalanceWei(null);
    }
  }, [client, address]);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  const bind = useCallback((raw: string) => {
    // Injected wallets often return a lowercase address; the contract keys state by the
    // EIP-55 checksummed address — normalize so read-backs (deals, reputation) match.
    const addr = getAddress(raw);
    setClient(createClient({ chain: studionet, account: addr }));
    setAddress(addr);
  }, []);

  const connect = useCallback(async () => {
    const provider = eth();
    if (!provider) throw new Error("No wallet detected. Install MetaMask or Rabby, then try again.");
    setConnecting(true);
    try {
      const accounts: string[] = await provider.request({ method: "eth_requestAccounts" });
      const raw = accounts?.[0];
      if (!raw) throw new Error("No account selected.");
      try {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: STUDIONET_HEX,
              chainName: "GenLayer Studionet",
              rpcUrls: ["https://studio.genlayer.com/api"],
              nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
            },
          ],
        });
      } catch {
        /* declined or already added — continue */
      }
      bind(raw);
      localStorage.setItem(CONNECTED_KEY, "1");
    } finally {
      setConnecting(false);
    }
  }, [bind]);

  const disconnect = useCallback(() => {
    setAddress("");
    setClient(null);
    setBalanceWei(null);
    localStorage.removeItem(CONNECTED_KEY);
  }, []);

  useEffect(() => {
    const provider = eth();
    setHasWallet(!!provider);
    if (!provider) return;
    // Silent eager-reconnect if previously connected (no popup).
    if (localStorage.getItem(CONNECTED_KEY) === "1") {
      provider
        .request({ method: "eth_accounts" })
        .then((accs: string[]) => {
          if (accs?.[0]) bind(accs[0]);
        })
        .catch(() => {});
    }
    // React to account / chain changes from the wallet.
    const onAccounts = (accs: string[]) => {
      if (accs?.[0]) bind(accs[0]);
      else disconnect();
    };
    provider.on?.("accountsChanged", onAccounts);
    return () => provider.removeListener?.("accountsChanged", onAccounts);
  }, [bind, disconnect]);

  return (
    <Ctx.Provider
      value={{
        address,
        client,
        connecting,
        hasWallet,
        chainName: CHAIN_NAME,
        gasSponsored: GAS_SPONSORED,
        balanceWei,
        refreshBalance,
        connect,
        disconnect,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useWallet(): WalletState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet must be used within WalletProvider");
  return v;
}

export function formatGen(wei: bigint | null): string {
  if (wei == null) return "—";
  const gen = Number(wei) / 1e18;
  return gen === 0 ? "0" : gen.toLocaleString(undefined, { maximumFractionDigits: 4 });
}
