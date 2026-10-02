import React from "react";

/**
 * SkeletonLoader - Enterprise Shimmering Placeholders
 */
export function SkeletonKpiGrid({ count = 4 }) {
  return (
    <div className="skeleton-kpi-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card skeleton-kpi">
          <div className="skeleton-line short shimmer" />
          <div className="skeleton-line medium number-line shimmer" />
          <div className="skeleton-line tiny shimmer" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonChartGrid({ count = 2 }) {
  return (
    <div className="skeleton-chart-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card skeleton-chart">
          <div className="skeleton-header">
            <div className="skeleton-line short shimmer" />
            <div className="skeleton-line tiny shimmer" />
          </div>
          <div className="skeleton-chart-body shimmer" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6, cols = 5 }) {
  return (
    <div className="skeleton-card skeleton-table">
      <div className="skeleton-table-header">
        {Array.from({ length: cols }).map((_, c) => (
          <div key={c} className="skeleton-line tiny shimmer" />
        ))}
      </div>
      <div className="skeleton-table-rows">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="skeleton-table-row">
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} className="skeleton-line small shimmer" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SkeletonLoader({ type = "dashboard" }) {
  if (type === "kpis") return <SkeletonKpiGrid />;
  if (type === "charts") return <SkeletonChartGrid />;
  if (type === "table") return <SkeletonTable />;

  return (
    <div className="skeleton-dashboard-container">
      <SkeletonKpiGrid count={4} />
      <div style={{ marginTop: 24 }}>
        <SkeletonChartGrid count={2} />
      </div>
    </div>
  );
}
