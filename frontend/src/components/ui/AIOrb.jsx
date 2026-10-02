import React from "react";

/**
 * AIOrb - Futuristic AI Neural Intelligence Orb
 * Used in the AI Analyst header & chat panels to signify active data intelligence
 */
export default function AIOrb({ state = "idle", size = 80, className = "" }) {
  const isThinking = state === "thinking" || state === "analyzing";
  const isStreaming = state === "streaming";

  return (
    <div
      className={`ai-orb-container ${isThinking ? "state-thinking" : ""} ${isStreaming ? "state-streaming" : ""} ${className}`}
      style={{
        width: size,
        height: size,
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      aria-label={`AI Status: ${state}`}
    >
      {/* Outer ambient glow */}
      <div
        className="ai-orb-glow"
        style={{
          position: "absolute",
          width: "120%",
          height: "120%",
          borderRadius: "50%",
          background: isThinking
            ? "radial-gradient(circle, rgba(99, 102, 241, 0.45) 0%, rgba(230, 195, 72, 0.2) 50%, transparent 75%)"
            : "radial-gradient(circle, rgba(99, 102, 241, 0.3) 0%, rgba(6, 182, 212, 0.15) 50%, transparent 70%)",
          filter: "blur(12px)",
          animation: "aiGlowPulse 4s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />

      {/* Orbit Ring 1 */}
      <div
        className="ai-orb-ring ring-1"
        style={{
          position: "absolute",
          width: "92%",
          height: "92%",
          borderRadius: "50%",
          border: "1.5px dashed rgba(99, 102, 241, 0.6)",
          animation: isThinking ? "aiSpinFast 3s linear infinite" : "aiSpinSlow 12s linear infinite",
          pointerEvents: "none",
        }}
      />

      {/* Orbit Ring 2 (counter-rotating with gold accent) */}
      <div
        className="ai-orb-ring ring-2"
        style={{
          position: "absolute",
          width: "78%",
          height: "78%",
          borderRadius: "50%",
          border: "1px solid rgba(230, 195, 72, 0.5)",
          borderTopColor: "transparent",
          borderBottomColor: "transparent",
          animation: isThinking ? "aiSpinReverseFast 4s linear infinite" : "aiSpinReverse 16s linear infinite",
          pointerEvents: "none",
        }}
      />

      {/* Orbit Ring 3 (cyan tilted) */}
      <div
        className="ai-orb-ring ring-3"
        style={{
          position: "absolute",
          width: "64%",
          height: "64%",
          borderRadius: "50%",
          border: "1px dotted rgba(6, 182, 212, 0.7)",
          transform: "rotate(45deg)",
          animation: "aiSpinSlow 20s linear infinite",
          pointerEvents: "none",
        }}
      />

      {/* Core AI Sphere */}
      <div
        className="ai-orb-core"
        style={{
          width: "48%",
          height: "48%",
          borderRadius: "50%",
          background: isThinking
            ? "linear-gradient(135deg, #818cf8 0%, #6366f1 50%, #e6c348 100%)"
            : "linear-gradient(135deg, #6366f1 0%, #3b82f6 50%, #06b6d4 100%)",
          boxShadow: isThinking
            ? "0 0 20px rgba(99, 102, 241, 0.8), inset 0 0 10px rgba(230, 195, 72, 0.6)"
            : "0 0 16px rgba(99, 102, 241, 0.6), inset 0 0 8px rgba(6, 182, 212, 0.5)",
          animation: "aiCoreBreathe 3s ease-in-out infinite alternate",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Core highlight dot */}
        <div
          style={{
            position: "absolute",
            top: "22%",
            left: "25%",
            width: "25%",
            height: "25%",
            borderRadius: "50%",
            background: "radial-gradient(circle, #ffffff 0%, rgba(255,255,255,0) 80%)",
          }}
        />
      </div>

      {/* Equalizer Wave / Activity Indicator underneath */}
      {isThinking && (
        <div
          className="ai-wave-bars"
          style={{
            position: "absolute",
            bottom: "-12px",
            display: "flex",
            gap: "3px",
            alignItems: "flex-end",
            height: "12px",
          }}
        >
          <span className="wave-bar bar-1" />
          <span className="wave-bar bar-2" />
          <span className="wave-bar bar-3" />
          <span className="wave-bar bar-4" />
        </div>
      )}
    </div>
  );
}
