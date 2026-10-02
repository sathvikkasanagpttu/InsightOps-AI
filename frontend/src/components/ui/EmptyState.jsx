import React from "react";
import { Database, Plus, Upload, Sparkles } from "lucide-react";

/**
 * EmptyState - Polished Enterprise Empty View with Abstract 3D SVG Geometry
 */
export default function EmptyState({
  title = "No Data Available",
  description = "Upload a dataset or select a sample domain to activate automatic profiling, Power BI visualizations, and AI insights.",
  actionLabel = "Upload Dataset",
  actionIcon: ActionIcon = Upload,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className = "",
}) {
  return (
    <div className={`enterprise-empty-state ${className}`}>
      <div className="empty-state-visual" aria-hidden="true">
        {/* Isometric 3D Data Cube SVG */}
        <svg width="140" height="140" viewBox="0 0 140 140" fill="none">
          <defs>
            <linearGradient id="cubeTop" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id="cubeLeft" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#312e81" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="cubeRight" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#e6c348" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#b45309" stopOpacity="0.2" />
            </linearGradient>
            <filter id="cubeGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Glowing background ring */}
          <circle cx="70" cy="70" r="54" stroke="rgba(99, 102, 241, 0.2)" strokeWidth="1.5" strokeDasharray="4 4" />
          <circle cx="70" cy="70" r="62" stroke="rgba(230, 195, 72, 0.15)" strokeWidth="1" />

          {/* Isometric Cube Faces */}
          <g filter="url(#cubeGlow)">
            {/* Top Face */}
            <polygon points="70,30 105,50 70,70 35,50" fill="url(#cubeTop)" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
            {/* Left Face */}
            <polygon points="35,50 70,70 70,110 35,90" fill="url(#cubeLeft)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
            {/* Right Face */}
            <polygon points="70,70 105,50 105,90 70,110" fill="url(#cubeRight)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          </g>

          {/* Floating Data Nodes */}
          <circle cx="28" cy="38" r="3.5" fill="#38bdf8" />
          <line x1="28" y1="38" x2="35" y2="50" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2 2" />

          <circle cx="112" cy="42" r="3" fill="#e6c348" />
          <line x1="112" y1="42" x2="105" y2="50" stroke="#e6c348" strokeWidth="1" strokeDasharray="2 2" />

          <circle cx="70" cy="122" r="3" fill="#818cf8" />
          <line x1="70" y1="110" x2="70" y2="122" stroke="#818cf8" strokeWidth="1" strokeDasharray="2 2" />
        </svg>
      </div>

      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-desc">{description}</p>

      <div className="empty-state-actions">
        {onAction && (
          <button type="button" className="enterprise-btn primary" onClick={onAction}>
            <ActionIcon size={16} />
            <span>{actionLabel}</span>
          </button>
        )}
        {secondaryActionLabel && onSecondaryAction && (
          <button type="button" className="enterprise-btn secondary" onClick={onSecondaryAction}>
            <span>{secondaryActionLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
}
