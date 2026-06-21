import type { Metadata } from "next";
import { Inter, EB_Garamond } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { WalletProvider } from "@/lib/wallet";
import { ConnectButton } from "@/components/ConnectButton";
import { AegisWordmark } from "@/components/Logo";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});
const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-eb-garamond",
});

export const metadata: Metadata = {
  title: "Aegis — AI-arbitrated freelance escrow on GenLayer",
  description:
    "Lock payment in escrow; if there's a dispute, an AI-validator panel reads both sides and rules how the funds split — trustlessly, on-chain.",
};

const navLinks = [
  { href: "/new", label: "New deal" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/#how", label: "How it works" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${ebGaramond.variable}`}>
      <body className="min-h-screen flex flex-col">
        <WalletProvider>
          <header className="sticky top-0 z-40 bg-canvas/85 backdrop-blur border-b border-hairline">
            <nav className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between">
              <Link href="/" className="text-ink hover:opacity-80 transition-opacity">
                <AegisWordmark />
              </Link>
              <div className="flex items-center gap-1 sm:gap-2">
                {navLinks.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="hidden sm:inline-block px-3 py-2 text-[0.9375rem] font-medium text-body hover:text-ink transition-colors"
                  >
                    {l.label}
                  </Link>
                ))}
                <ConnectButton />
              </div>
            </nav>
          </header>

          <main className="flex-1 relative">{children}</main>

          <footer className="border-t border-hairline bg-canvas">
            <div className="mx-auto max-w-6xl px-5 py-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <AegisWordmark />
                <p className="mt-2 text-[0.9375rem] text-muted max-w-md">
                  Escrow + AI arbitration, settled on-chain by a GenLayer validator panel.
                </p>
              </div>
              <p className="eyebrow">Sealed on GenLayer · Studionet</p>
            </div>
          </footer>
        </WalletProvider>
      </body>
    </html>
  );
}
