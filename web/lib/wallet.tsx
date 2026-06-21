"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { getAddress } from "viem";

export type WalletMethod = "builtin" | "metamask";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

type WalletState = {
  address: string;
  method: WalletMethod | null;
  client: Client | null;
  connecting: boolean;
  hasMetaMask: boolean;
  // gas
  chainName: string;
  gasSponsored: boolean; // true on Studionet — the network covers gas
  balanceWei: bigint | null;
  refreshBalance: () => Promise<void>;
  requestTestGen: () => Promise<{ ok: boolean; message: string }>;
  // connection
  connectBuiltIn: () => void;
  connectMetaMask: () => Promise<void>;
  disconnect: () => void;
};

const Ctx = createContext<WalletState | null>(null);
const PK_KEY = "aegis_pk";
const METHOD_KEY = "aegis_wallet_method";
const STUDIONET_HEX = "0xF22F"; // 61999
const CHAIN_NAME = "Studionet";
const GAS_SPONSORED = true; // Studionet (chain 61999) sponsors gas for contract calls

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function eth(): any {
  return typeof window !== "undefined" ? (window as { ethereum?: unknown }).ethereum : undefined;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState("");
  const [method, setMethod] = useState<WalletMethod | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [hasMetaMask, setHasMetaMask] = useState(false);
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

  const requestTestGen = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    if (!client || !address) return { ok: false, message: "Connect a wallet first." };
    try {
      // Programmatic faucet — works on localnet; Studionet/testnet throw and we handle it.
      await client.fundAccount(address, BigInt("1000000000000000000"));
      await refreshBalance();
      return { ok: true, message: "Funded with test GEN." };
    } catch {
      return {
        ok: false,
        message: GAS_SPONSORED
          ? "Studionet sponsors gas — no top-up needed. You're clear to verify."
          : "Open the GenLayer faucet to fund this wallet, then refresh.",
      };
    }
  }, [client, address, refreshBalance]);

  const connectBuiltIn = useCallback(() => {
    let pk = localStorage.getItem(PK_KEY);
    if (!pk) {
      pk = generatePrivateKey();
      localStorage.setItem(PK_KEY, pk);
    }
    const account = createAccount(pk as `0x${string}`);
    setClient(createClient({ chain: studionet, account }));
    setAddress(account.address);
    setMethod("builtin");
    localStorage.setItem(METHOD_KEY, "builtin");
  }, []);

  const connectMetaMask = useCallback(async () => {
    const provider = eth();
    if (!provider) throw new Error("MetaMask not detected. Install it, or use the Instant Wallet.");
    setConnecting(true);
    try {
      const accounts: string[] = await provider.request({ method: "eth_requestAccounts" });
      const raw = accounts?.[0];
      if (!raw) throw new Error("No account selected.");
      // Injected wallets (MetaMask, Rabby, …) often return a lowercase address, but the
      // contract keys state by the EIP-55 checksummed address — normalize so read-backs match.
      const addr = getAddress(raw);
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
      setClient(createClient({ chain: studionet, account: addr }));
      setAddress(addr);
      setMethod("metamask");
      localStorage.setItem(METHOD_KEY, "metamask");
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress("");
    setClient(null);
    setMethod(null);
    setBalanceWei(null);
    localStorage.removeItem(METHOD_KEY);
  }, []);

  useEffect(() => {
    setHasMetaMask(!!eth());
    if (localStorage.getItem(METHOD_KEY) === "builtin") connectBuiltIn();
  }, [connectBuiltIn]);

  return (
    <Ctx.Provider
      value={{
        address,
        method,
        client,
        connecting,
        hasMetaMask,
        chainName: CHAIN_NAME,
        gasSponsored: GAS_SPONSORED,
        balanceWei,
        refreshBalance,
        requestTestGen,
        connectBuiltIn,
        connectMetaMask,
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
