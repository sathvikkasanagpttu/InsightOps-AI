import React, { useState } from "react";
import { Maximize2, Download, Filter, MoreHorizontal, Layers, Sparkles } from "lucide-react";

/**
 * ChartCard - Framed BI Visualization Card
 * Wraps charts with consistent enterprise header, metadata, actions, and hover elevation
 */
export default function ChartCard({
  title,
  subtitle,
  kind = "line",
  sourceColumns = [],
  children,
  onFullscreen,
  onExport,
  actions = null,
  className = "",
  badge = null,
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={`chart-card-container ${className}`}>
      <div className="chart-card-header">
        <div className="chart-card-title-group">
          <div className="chart-card-kicker">
            <span className="chart-card-kind-badge">{badge || kind.toUpperCase()}</span>
            {sourceColumns.length > 0 && (
              <span className="chart-card-source-badge">
                cols: {sourceColumns.slice(0, 2).join(", ")}
              </span>
            )}
          </div>
          <h3 className="chart-card-title">{title}</h3>
          {subtitle && <p className="chart-card-subtitle">{subtitle}</p>}
        </div>

        <div className="chart-card-actions">
          {actions}
          {onExport && (
            <button
              type="button"
              className="chart-action-btn"
              onClick={onExport}
              title="Export visualization data"
              aria-label="Export visualization data"
            >
              <Download size={14} />
            </button>
          )}
          {onFullscreen && (
            <button
              type="button"
              className="chart-action-btn"
              onClick={onFullscreen}
              title="Expand to Fullscreen"
              aria-label="Expand to Fullscreen"
            >
              <Maximize2 size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="chart-card-content">
        {children}
      </div>
    </div>
  );
}
