import { useEffect, useState } from "react";

interface Props {
  onComplete: () => void;
}

export default function OceanPreloader({ onComplete }: Props) {
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setFadeOut(true);
            setTimeout(onComplete, 600);
          }, 300);
          return 100;
        }
        const next = prev + Math.floor(Math.random() * 15) + 8;
        return next > 100 ? 100 : next;
      });
    }, 80);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "#000717",
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeOut ? 0 : 1,
        transform: fadeOut ? "scale(1.04)" : "scale(1)",
        pointerEvents: fadeOut ? "none" : "all",
        transition: "opacity 0.6s cubic-bezier(0.165, 0.84, 0.44, 1), transform 0.6s cubic-bezier(0.165, 0.84, 0.44, 1)",
      }}
    >
      {/* Hydrographic Radar Sonar Outer Circles */}
      <div style={{ position: "relative", width: "240px", height: "240px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* Outer Pulsing Ring */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "1px dashed rgba(144, 224, 239, 0.25)",
            animation: "spinSlow 12s linear infinite",
          }}
        />
        
        {/* Middle Ring */}
        <div
          style={{
            position: "absolute",
            inset: "25px",
            borderRadius: "50%",
            border: "1px solid rgba(144, 224, 239, 0.4)",
            boxShadow: "0 0 20px rgba(144, 224, 239, 0.15)",
          }}
        />

        {/* Orbiting Radar Sweeper Dot */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            animation: "orbitSpin 2s linear infinite",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "-4px",
              left: "50%",
              transform: "translateX(-50%)",
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: "#90e0ef",
              boxShadow: "0 0 15px #90e0ef, 0 0 30px #90e0ef",
            }}
          />
        </div>

        {/* Center Percentage Display */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "36px", fontWeight: "700", color: "#ffffff", letterSpacing: "-1px" }}>
            {progress}%
          </div>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "10px", color: "#90e0ef", letterSpacing: "1.5px", marginTop: "4px", textTransform: "uppercase" }}>
            INITIALIZING 4D NETCDF
          </div>
        </div>
      </div>

      {/* Brand Subtitle Tagline */}
      <div style={{ marginTop: "32px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center", marginBottom: "6px" }}>
          <span style={{ width: "6px", height: "6px", backgroundColor: "#ff7438", display: "inline-block", borderRadius: "1px" }} />
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "11px", letterSpacing: "2px", color: "var(--text-muted)", textTransform: "uppercase" }}>
            FloatChat
          </span>
        </div>
        <p style={{ color: "#94a3b8", fontSize: "13px", margin: 0, fontFamily: "Plus Jakarta Sans, sans-serif" }}>
          Connecting to Global ARGO ERDDAP Data Assembly Network
        </p>
      </div>

      {/* Keyframe Styles */}
      <style>{`
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes orbitSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
