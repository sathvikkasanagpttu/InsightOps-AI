import React, { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react";

/**
 * KPIWidget - Enterprise Animated Metric Card
 * Features:
 * - Animated count-up effect
 * - SVG miniature sparkline curve
 * - Trend indicator (+12.4% vs prev)
 * - Source column metadata & calculation formula tooltip
 * - Hover elevation
 */
export default function KPIWidget({
  label,
  value,
  previousValue,
  format = "numeric", // "currency" | "percent" | "numeric" | "compact"
  trend = null, // "up" | "down" | "neutral" | null
  trendPercent = null,
  sparklineData = [],
  sourceColumns = [],
  calculation = null,
  icon: Icon = null,
  color = "indigo", // "indigo" | "gold" | "cyan" | "emerald" | "rose"
  compact = false,
  className = "",
}) {
  const numValue = typeof value === "number" ? value : parseFloat(value) || 0;
  const [displayValue, setDisplayValue] = useState(0);

  // Animated count-up on value change
  useEffect(() => {
    let startTimestamp = null;
    const duration = 800; // ms
    const startValue = 0;
    const endValue = numValue;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startValue + (endValue - startValue) * easeProgress);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setDisplayValue(endValue);
      }
    };

    const frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [numValue]);

  // Format the animated display value
  const formattedString = (() => {
    if (format === "currency") {
      return `₹${displayValue.toLocaleString("en-IN", {
        maximumFractionDigits: compact ? 0 : 2,
        notation: compact ? "compact" : "standard",
      })}`;
    }
    if (format === "percent") {
      return `${displayValue.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`;
    }
    return displayValue.toLocaleString("en-IN", {
      maximumFractionDigits: compact ? 1 : 2,
      notation: compact ? "compact" : "standard",
    });
  })();

  // Build SVG sparkline path from data points
  const sparklineSvg = (() => {
    const data = sparklineData && sparklineData.length > 1
      ? sparklineData
      : [displayValue * 0.85, displayValue * 0.92, displayValue * 0.88, displayValue * 0.97, displayValue * 0.94, displayValue];

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const width = 80;
    const height = 28;

    const points = data.map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const pathD = `M ${points.join(" L ")}`;
    const areaD = `M ${points[0]} L ${points.join(" L ")} L ${width},${height} L 0,${height} Z`;

    return { pathD, areaD, width, height };
  })();

  return (
    <div className={`kpi-widget color-${color} ${className}`} title={calculation ? `Calculation: ${calculation}` : undefined}>
      <div className="kpi-header">
        <div className="kpi-label-group">
          {Icon && (
            <span className={`kpi-icon-badge bg-${color}`}>
              <Icon size={16} />
            </span>
          )}
          <span className="kpi-label">{label}</span>
        </div>
        {calculation && (
          <span className="kpi-info-trigger" title={`Formula: ${calculation}`}>
            <Info size={13} />
          </span>
        )}
      </div>

      <div className="kpi-body">
        <div className="kpi-value-col">
          <strong className="kpi-number">{formattedString}</strong>
          
          {trendPercent !== null && (
            <div className={`kpi-trend-pill trend-${trend || (trendPercent >= 0 ? "up" : "down")}`}>
              {trendPercent >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span>{Math.abs(trendPercent).toFixed(1)}%</span>
            </div>
          )}
        </div>

        {/* Sparkline Graphic */}
        <div className="kpi-sparkline-box" aria-hidden="true">
          <svg width={sparklineSvg.width} height={sparklineSvg.height} viewBox={`0 0 ${sparklineSvg.width} ${sparklineSvg.height}`}>
            <defs>
              <linearGradient id={`sparkGrad-${color}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path d={sparklineSvg.areaD} fill={`url(#sparkGrad-${color})`} className="sparkline-area" />
            <path d={sparklineSvg.pathD} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sparkline-line" />
          </svg>
        </div>
      </div>

      {sourceColumns && sourceColumns.length > 0 && (
        <div className="kpi-footer">
          <span className="kpi-source-text">
            Source: <code>{sourceColumns.slice(0, 2).join(", ")}</code>
          </span>
        </div>
      )}
    </div>
  );
}
