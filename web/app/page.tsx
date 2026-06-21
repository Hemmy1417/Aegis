import Link from "next/link";

export default function Home() {
  return (
    <div className="relative overflow-hidden">
      {/* atmospheric orbs */}
      <div className="orb orb-sky" style={{ width: 520, height: 520, top: -120, left: "8%" }} />
      <div className="orb orb-lavender" style={{ width: 460, height: 460, top: 40, right: "4%" }} />
      <div className="orb orb-mint" style={{ width: 380, height: 380, top: 380, left: "38%", opacity: 0.4 }} />

      {/* hero */}
      <section className="relative mx-auto max-w-4xl px-5 pt-24 pb-20 text-center">
        <p className="eyebrow">AI-arbitrated escrow · GenLayer</p>
        <h1 className="display mt-5 text-5xl sm:text-6xl md:text-7xl">
          Get paid fairly.
          <br />
          Even when there&apos;s a dispute.
        </h1>
        <p className="mt-6 text-lg text-body max-w-2xl mx-auto">
          Lock a freelance payment in escrow. If the work is disputed, an AI-validator panel reads
          the agreed terms and both sides&apos; cases, then rules how the funds split — trustlessly,
          on-chain. No platform, no 20% middleman.
        </p>
        <div className="mt-9 flex items-center justify-center gap-3">
          <Link href="/new" className="ink-pill">
            Start a deal
          </Link>
          <Link href="/#how" className="btn-outline">
            How it works
          </Link>
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="relative mx-auto max-w-6xl px-5 py-20">
        <p className="eyebrow text-center">How it works</p>
        <h2 className="display text-3xl sm:text-4xl text-center mt-3">Four steps to a fair settlement</h2>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { n: "01", t: "Fund the escrow", d: "The client posts the job terms in plain English and locks the payment in the contract." },
            { n: "02", t: "Deliver the work", d: "The freelancer marks it delivered. Happy path: the client approves and is paid instantly." },
            { n: "03", t: "Disagree? Make your case", d: "Either side can dispute. Both submit a written statement; the freelancer can attach the deliverable." },
            { n: "04", t: "The AI rules", d: "A GenLayer validator panel weighs the evidence and splits the escrow — release, refund, or a fair %." },
          ].map((s) => (
            <div key={s.n} className="card card-hover p-6">
              <div className="display text-2xl text-muted-soft">{s.n}</div>
              <h3 className="mt-3 text-[1.15rem] font-medium text-ink" style={{ letterSpacing: 0 }}>
                {s.t}
              </h3>
              <p className="mt-2 text-[0.95rem] text-body">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* why GenLayer */}
      <section className="relative mx-auto max-w-5xl px-5 py-20">
        <div className="card p-10 sm:p-14 text-center relative overflow-hidden">
          <div className="orb orb-peach" style={{ width: 360, height: 360, top: -80, right: -40, opacity: 0.35 }} />
          <p className="eyebrow relative">Why GenLayer</p>
          <h2 className="display text-3xl sm:text-4xl mt-3 relative">A verdict that moves money</h2>
          <p className="mt-5 text-lg text-body max-w-2xl mx-auto relative">
            Resolving a dispute needs three things at once: interpret plain-English terms, weigh both
            arguments, and settle real funds. A normal smart contract can&apos;t judge; a normal
            backend can&apos;t settle trustlessly. Aegis does both — the AI panel decides, and the
            contract pays out the result.
          </p>
          <div className="mt-8 relative">
            <Link href="/new" className="ink-pill">
              Start a deal
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
