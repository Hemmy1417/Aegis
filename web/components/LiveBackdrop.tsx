"use client";

// Aegis — parchment feel. Slow sepia ink diffusion blooms + floating
// scale-of-justice glyphs. Subtle: this is a legal/escrow surface, not
// a nightclub.

export function LiveBackdrop() {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="aeg-bloom aeg-bloom-a" />
      <div className="aeg-bloom aeg-bloom-b" />
      <div className="aeg-bloom aeg-bloom-c" />
      <div className="aeg-grain" />
      <div className="aeg-glyphs">
        {["§", "⚖", "◇", "§", "⚖", "◇"].map((c, i) => (
          <span key={i} className={`aeg-glyph aeg-g${i}`}>{c}</span>
        ))}
      </div>

      <style jsx>{`
        .aeg-bloom {
          position: absolute;
          border-radius: 9999px;
          filter: blur(90px);
          opacity: 0.35;
          mix-blend-mode: multiply;
          will-change: transform;
        }
        .aeg-bloom-a {
          width: 640px; height: 640px;
          top: -160px; left: -140px;
          background: radial-gradient(circle at 40% 40%, #8b6f3f, transparent 70%);
          animation: aegDriftA 32s ease-in-out infinite;
        }
        .aeg-bloom-b {
          width: 560px; height: 560px;
          top: 40%; right: -160px;
          background: radial-gradient(circle at 50% 50%, #5c4a2a, transparent 70%);
          animation: aegDriftB 38s ease-in-out infinite;
        }
        .aeg-bloom-c {
          width: 480px; height: 480px;
          bottom: -140px; left: 30%;
          background: radial-gradient(circle at 50% 50%, #a58b5c, transparent 70%);
          animation: aegDriftC 42s ease-in-out infinite;
        }
        @keyframes aegDriftA {
          0%, 100% { transform: translate(0, 0)      scale(1);    }
          50%       { transform: translate(100px, 60px) scale(1.12); }
        }
        @keyframes aegDriftB {
          0%, 100% { transform: translate(0, 0)         scale(1);    }
          50%       { transform: translate(-120px, 90px) scale(1.08); }
        }
        @keyframes aegDriftC {
          0%, 100% { transform: translate(0, 0)          scale(1);    }
          50%       { transform: translate(60px, -110px) scale(1.15); }
        }

        .aeg-grain {
          position: absolute; inset: 0;
          background-image:
            radial-gradient(rgba(92, 74, 42, 0.06) 1px, transparent 1px);
          background-size: 3px 3px;
          opacity: 0.5;
        }

        .aeg-glyphs { position: absolute; inset: 0; }
        .aeg-glyph {
          position: absolute; bottom: -40px;
          font-family: "EB Garamond", ui-serif, Georgia, serif;
          font-size: 24px;
          color: rgba(92, 74, 42, 0.18);
          animation: aegFloat linear infinite;
        }
        @keyframes aegFloat {
          0%   { transform: translateY(0)      rotate(0deg);   opacity: 0; }
          10%  { opacity: 0.5; }
          90%  { opacity: 0.5; }
          100% { transform: translateY(-115vh) rotate(-12deg); opacity: 0; }
        }
        .aeg-g0 { left: 12%; animation-duration: 44s; animation-delay:  0s; font-size: 22px; }
        .aeg-g1 { left: 28%; animation-duration: 52s; animation-delay:  8s; font-size: 28px; }
        .aeg-g2 { left: 46%; animation-duration: 48s; animation-delay:  4s; font-size: 20px; }
        .aeg-g3 { left: 60%; animation-duration: 56s; animation-delay: 12s; font-size: 26px; }
        .aeg-g4 { left: 76%; animation-duration: 46s; animation-delay:  6s; font-size: 22px; }
        .aeg-g5 { left: 88%; animation-duration: 50s; animation-delay: 14s; font-size: 24px; }

        @media (prefers-reduced-motion: reduce) {
          .aeg-bloom, .aeg-glyph { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
