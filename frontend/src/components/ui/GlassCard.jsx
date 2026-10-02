import React from "react";

/**
 * GlassCard - Enterprise Glassmorphism Container with layered depth & subtle border glow
 */
export default function GlassCard({
  children,
  variant = "surface", // "surface" | "glass" | "elevated" | "accent" | "bordered"
  glow = false,
  className = "",
  style = {},
  onClick,
  ...props
}) {
  return (
    <div
      className={`enterprise-glass-card card-variant-${variant} ${glow ? "has-glow" : ""} ${className}`}
      style={style}
      onClick={onClick}
      {...props}
    >
      {/* Optional decorative top accent shimmer */}
      {glow && <div className="card-top-glow" aria-hidden="true" />}
      {children}
    </div>
  );
}
