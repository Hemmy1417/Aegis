"use client";

// Aegis — editorial parchment palette (ElevenLabs-inspired). Airy pastel
// aurora orbs, an SVG escrow ribbon flowing between two anchor points
// (represents funds held in trust between two parties), soft coin motes
// drifting. Bright, editorial, calm — not a nightclub.

export function LiveBackdrop() {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Pastel atmospheric orbs — the design system already calls these out */}
      <div className="aeg-orb aeg-orb-peach" />
      <div className="aeg-orb aeg-orb-mint" />
      <div className="aeg-orb aeg-orb-sky" />
      <div className="aeg-orb aeg-orb-blush" />

      {/* Escrow ribbon — a Bezier arc between two anchor points, breathing */}
      <svg className="aeg-ribbon" viewBox="0 0 1200 800" preserveAspectRatio="none">
        <defs>
          <linearGradient id="aeg-ribbon-a" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"  stopColor="#f4a486" stopOpacity="0.35" />
            <stop offset="50%" stopColor="#c9b6ff" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#8cd4c1" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id="aeg-ribbon-b" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"  stopColor="#8cd4c1" stopOpacity="0.22" />
            <stop offset="50%" stopColor="#a9c8ff" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#f4a486" stopOpacity="0.22" />
          </linearGradient>
        </defs>

        {/* two anchor dots — party A on the left, party B on the right */}
        <circle cx="120" cy="600" r="6" fill="#0c0a09" opacity="0.35" />
        <circle cx="1080" cy="600" r="6" fill="#0c0a09" opacity="0.35" />

        {/* thick ribbon behind */}
        <path
          className="aeg-ribbon-path aeg-ribbon-back"
          d="M 120,600 C 340,120 860,120 1080,600"
          stroke="url(#aeg-ribbon-b)"
          strokeWidth="60"
          fill="none"
          strokeLinecap="round"
        />
        {/* thinner ribbon in front */}
        <path
          className="aeg-ribbon-path aeg-ribbon-front"
          d="M 120,600 C 380,200 820,200 1080,600"
          stroke="url(#aeg-ribbon-a)"
          strokeWidth="28"
          fill="none"
          strokeLinecap="round"
        />
      </svg>

      {/* Coin motes — soft, low-contrast */}
      <div className="aeg-motes">
        {["$", "◇", "$", "•", "◇", "$", "•", "◇"].map((c, i) => (
          <span key={i} className={`aeg-mote aeg-m${i}`}>{c}</span>
        ))}
      </div>

      <style jsx>{`
        .aeg-orb {
          position: absolute;
          border-radius: 9999px;
          filter: blur(80px);
          opacity: 0.75;
          mix-blend-mode: multiply;
          will-change: transform;
        }
        .aeg-orb-peach {
          width: 560px; height: 560px;
          top: -120px; left: -100px;
          background: radial-gradient(circle at 40% 40%, #f4a486, transparent 70%);
          animation: aegDriftA 28s ease-in-out infinite;
        }
        .aeg-orb-mint {
          width: 620px; height: 620px;
          top: 30%; right: -160px;
          background: radial-gradient(circle at 60% 40%, #8cd4c1, transparent 70%);
          animation: aegDriftB 34s ease-in-out infinite;
        }
        .aeg-orb-sky {
          width: 500px; height: 500px;
          bottom: -140px; left: 30%;
          background: radial-gradient(circle at 50% 50%, #a9c8ff, transparent 70%);
          animation: aegDriftC 38s ease-in-out infinite;
        }
        .aeg-orb-blush {
          width: 420px; height: 420px;
          top: 55%; left: 8%;
          background: radial-gradient(circle at 50% 50%, #f4c8dc, transparent 70%);
          animation: aegDriftD 42s ease-in-out infinite;
          mix-blend-mode: multiply;
        }
        @keyframes aegDriftA {
          0%, 100% { transform: translate(0, 0)          scale(1);    }
          50%       { transform: translate(120px, 80px)   scale(1.15); }
        }
        @keyframes aegDriftB {
          0%, 100% { transform: translate(0, 0)          scale(1);    }
          50%       { transform: translate(-140px, 100px) scale(1.1);  }
        }
        @keyframes aegDriftC {
          0%, 100% { transform: translate(0, 0)          scale(1);    }
          50%       { transform: translate(80px, -120px)  scale(1.2);  }
        }
        @keyframes aegDriftD {
          0%, 100% { transform: translate(0, 0)          scale(1);    }
          50%       { transform: translate(-60px, -70px) scale(1.08); }
        }

        .aeg-ribbon {
          position: absolute;
          inset: 0;
          width: 100%; height: 100%;
          mask-image: radial-gradient(ellipse 100% 70% at 50% 45%, black 40%, transparent 90%);
          -webkit-mask-image: radial-gradient(ellipse 100% 70% at 50% 45%, black 40%, transparent 90%);
        }
        .aeg-ribbon-path {
          stroke-dasharray: 40 20;
          animation: aegRibbonFlow 12s linear infinite;
          will-change: stroke-dashoffset;
        }
        .aeg-ribbon-back  { animation-duration: 16s; opacity: 0.7; }
        .aeg-ribbon-front { animation-duration: 10s; opacity: 0.9; }
        @keyframes aegRibbonFlow {
          from { stroke-dashoffset: 0;   }
          to   { stroke-dashoffset: -240; }
        }

        .aeg-motes { position: absolute; inset: 0; }
        .aeg-mote {
          position: absolute;
          bottom: -30px;
          font-family: ui-serif, "EB Garamond", Georgia, serif;
          color: rgba(41, 37, 36, 0.22);
          text-shadow: 0 0 6px rgba(255, 200, 160, 0.4);
          animation: aegRise linear infinite;
        }
        @keyframes aegRise {
          0%   { transform: translateY(0)       translateX(0);    opacity: 0; }
          10%  { opacity: 0.6; }
          90%  { opacity: 0.6; }
          100% { transform: translateY(-115vh)  translateX(30px); opacity: 0; }
        }
        .aeg-m0 { left:  8%; animation-duration: 26s; animation-delay:  0s;  font-size: 14px; }
        .aeg-m1 { left: 22%; animation-duration: 32s; animation-delay:  5s;  font-size: 18px; }
        .aeg-m2 { left: 36%; animation-duration: 28s; animation-delay:  2s;  font-size: 12px; }
        .aeg-m3 { left: 50%; animation-duration: 34s; animation-delay:  8s;  font-size: 16px; }
        .aeg-m4 { left: 62%; animation-duration: 30s; animation-delay:  4s;  font-size: 20px; }
        .aeg-m5 { left: 74%; animation-duration: 36s; animation-delay: 10s;  font-size: 14px; }
        .aeg-m6 { left: 86%; animation-duration: 28s; animation-delay:  6s;  font-size: 16px; }
        .aeg-m7 { left: 94%; animation-duration: 32s; animation-delay:  1s;  font-size: 18px; }

        @media (prefers-reduced-motion: reduce) {
          .aeg-orb, .aeg-ribbon-path, .aeg-mote { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
