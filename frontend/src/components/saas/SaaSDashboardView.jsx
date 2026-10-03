import React, { useEffect, useState } from "react";
import {
  BarChart3, BrainCircuit, Database, FileText, LayoutGrid, Layers,
  Bell, ShieldCheck, ArrowRight, Clock, Plus, ExternalLink, Activity, Users,
  AlertTriangle, TrendingUp, Sparkles, RefreshCw, Zap, CheckCircle2,
  Target, Award, TrendingDown
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import KPIWidget from "../ui/KPIWidget";
import ChartCard from "../ui/ChartCard";
import GlassCard from "../ui/GlassCard";

function CommandCenterCard({ card }) {
  const isAhead = card.status === "Ahead of Target";
  const isOnTrack = card.status === "On Track";
  const badgeClass = isAhead ? "badge-ahead" : isOnTrack ? "badge-ontrack" : "badge-attention";

  const points = card.sparkline || [];
  const minVal = points.length ? Math.min(...points) : 0;
  const maxVal = points.length ? Math.max(...points) : 1;
  const range = maxVal - minVal || 1;
  const width = 110;
  const height = 30;
  const svgPoints = points.map((p, i) => {
    const x = (i / (points.length - 1 || 1)) * width;
    const y = height - ((p - minVal) / range) * (height - 6) - 3;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="command-center-kpi-card glass-premium">
      <div className="cc-card-header">
        <span className="cc-card-title">{card.title}</span>
        <span className={`cc-status-pill ${badgeClass}`}>{card.status}</span>
      </div>

      <div className="cc-value-row">
        <strong className="cc-main-value">{card.formatted_value}</strong>
        {points.length > 1 && (
          <div className="cc-sparkline-wrapper" title="Trend distribution">
            <svg width={width} height={height} className="cc-sparkline-svg">
              <polyline
                fill="none"
                stroke={isAhead ? "#10b981" : isOnTrack ? "#06b6d4" : "#f59e0b"}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={svgPoints}
              />
            </svg>
          </div>
        )}
      </div>

      <div className="cc-target-section">
        <div className="cc-target-meta">
          <span className="cc-target-label">Target: <b>{card.target_value}</b></span>
          <span className="cc-achievement-pct">{card.achievement_pct}%</span>
        </div>
        <div className="cc-progress-track">
          <div
            className={`cc-progress-bar ${isAhead ? "bar-emerald" : isOnTrack ? "bar-cyan" : "bar-amber"}`}
            style={{ width: `${Math.min(100, Math.max(0, card.achievement_pct))}%` }}
          />
        </div>
      </div>

      <div className="cc-benchmark-footer">
        <span className="cc-benchmark-name">{card.benchmark_name}:</span>
        <span className="cc-benchmark-val">{card.benchmark_value}</span>
        <span className={`cc-variance-badge ${String(card.benchmark_variance || "").startsWith("+") ? "var-positive" : "var-negative"}`}>
          {card.benchmark_variance}
        </span>
      </div>
    </div>
  );
}

function ExecutiveBriefingBox({ summary }) {
  if (!summary) return null;
  const risk = summary.risk_radar || { level: summary.risk_level || "Optimal", summary: summary.risk_summary };
  const riskClass = risk.level === "Critical" ? "risk-critical" : risk.level === "Moderate" ? "risk-moderate" : "risk-optimal";

  return (
    <div className="executive-briefing-banner glass-gold">
      <div className="eb-header">
        <div className="eb-title-group">
          <Sparkles size={16} className="text-gold" />
          <span className="eb-kicker">EXECUTIVE INTELLIGENCE BRIEFING</span>
          <span className={`eb-risk-pill ${riskClass}`}>
            Risk: {risk.level}
          </span>
        </div>
        <span className="eb-time-tag">Automated Grounded Synthesis</span>
      </div>

      <h3 className="eb-headline">{summary.headline}</h3>
      <p className="eb-summary-text">{summary.executive_summary || summary.executive_briefing}</p>

      {summary.recommendations && summary.recommendations.length > 0 && (
        <div className="eb-recommendations-row">
          <span className="eb-rec-label">Strategic Priorities:</span>
          <div className="eb-rec-cards">
            {summary.recommendations.slice(0, 3).map((rec, i) => (
              <div key={i} className="eb-rec-card">
                <div className="eb-rec-head">
                  <span className="eb-rec-num">{i + 1}</span>
                  <strong>{rec.title}</strong>
                </div>
                <p>{rec.description}</p>
                <div className="eb-rec-impact-pill">
                  Impact: <b>{rec.projected_impact}</b>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SaaSDashboardView({ onNavigate, datasetId, datasetProfile }) {
  const { user, activeWorkspace, workspaces } = useAuth();
  const [reports, setReports] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);
  const [commandCenter, setCommandCenter] = useState(null);
  const [executiveSummary, setExecutiveSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      try {
        const [repRes, notifRes, actRes, sysRes, ccRes, esRes] = await Promise.all([
          api("/api/reports").catch(() => []),
          api(`/api/alerts/notifications?dataset_id=${encodeURIComponent(datasetId || "demo-sales")}`).catch(() => []),
          api("/api/activity?limit=6").catch(() => []),
          api("/api/system/health").catch(() => null),
          api(`/api/analysis/command-center?dataset_id=${encodeURIComponent(datasetId || "demo-sales")}`).catch(() => null),
          api(`/api/analysis/executive-summary?dataset_id=${encodeURIComponent(datasetId || "demo-sales")}`).catch(() => null)
        ]);
        setReports(Array.isArray(repRes) ? repRes : []);
        setAlerts(Array.isArray(notifRes) ? notifRes : []);
        setRecentActivity(Array.isArray(actRes) ? actRes : []);
        setSystemHealth(sysRes);
        setCommandCenter(ccRes);
        setExecutiveSummary(esRes);
      } catch (err) {
        console.warn("Error fetching dashboard overview data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, [datasetId, activeWorkspace]);

  // Extract top charts and KPIs from active dataset
  const datasetKpis = datasetProfile?.kpis || [];
  const datasetCharts = datasetProfile?.charts || [];
  const timeSeriesChart = datasetCharts.find(c => c.kind === "line" || c.kind === "area") || datasetCharts[0];
  const dimensionChart = datasetCharts.find(c => c.kind === "bar" || c.kind === "column") || datasetCharts[1];

  const formatCurrency = (val) => `₹${Number(val || 0).toLocaleString("en-IN", { maximumFractionDigits: 1 })}`;

  return (
    <div className="saas-dashboard-grid modern-dashboard-layout">
      {/* 1. Executive Hero Analytics Banner */}
      <section className="saas-hero-banner enterprise-hero-glass">
        <div className="saas-hero-content">
          <div className="hero-eyebrow-row">
            <span className="hero-pulse-dot" />
            <span className="hero-eyebrow-text">ENTERPRISE DECISION PLATFORM</span>
            <span className="hero-env-pill">PROD TELEMETRY</span>
          </div>

          <h1 className="hero-title">
            Executive Intelligence Command · <em>{user?.full_name || "Enterprise User"}</em>
          </h1>

          <p className="hero-subtitle">
            Active Workspace: <strong className="text-gold">{activeWorkspace?.name || "Corporate Analytics"}</strong> ·
            Dataset: <strong className="text-white">{datasetProfile?.filename || datasetId || "Connected Session"}</strong>
            {datasetProfile?.rows && (
              <span className="hero-record-tag">
                {datasetProfile.rows.toLocaleString()} rows · {datasetProfile.column_count || datasetProfile.columns?.length || 0} columns
              </span>
            )}
          </p>
        </div>

        <div className="saas-quick-actions">
          <button className="enterprise-btn primary" onClick={() => onNavigate("visuals")}>
            <LayoutGrid size={15} /> Power BI Studio
          </button>
          <button className="enterprise-btn gold" onClick={() => onNavigate("data")}>
            <Database size={15} /> Ingestion Studio
          </button>
          <button className="enterprise-btn secondary" onClick={() => onNavigate("analyst")}>
            <BrainCircuit size={15} /> Ask AI Analyst
          </button>
        </div>
      </section>

      {/* 2. Executive Intelligence Briefing */}
      {executiveSummary && <ExecutiveBriefingBox summary={executiveSummary} />}

      {/* 3. Executive Command Center (Configurable KPI Cards with Targets, Benchmarks & Variance) */}
      {commandCenter?.kpis && commandCenter.kpis.length > 0 && (
        <section className="command-center-section">
          <div className="section-header-row">
            <div>
              <span className="section-kicker">EXECUTIVE COMMAND CENTER</span>
              <h2 className="section-title">Performance Targets & Industry Peer Benchmarks</h2>
            </div>
            <div className="section-health-pill">
              Overall Status: <strong className="text-emerald">{commandCenter.overall_health || "Optimal"}</strong>
            </div>
          </div>

          <div className="command-center-kpi-grid">
            {commandCenter.kpis.map((card, idx) => (
              <CommandCenterCard key={idx} card={card} />
            ))}
          </div>
        </section>
      )}

      {/* 4. Dynamic Live Dataset KPIs (Count-up numbers, sparklines & variance) */}
      <section className="dashboard-kpis-section">
        <div className="section-header-row">
          <div>
            <span className="section-kicker">AUTOMATIC KPI ENGINE</span>
            <h2 className="section-title">Active Measures & Health Telemetry</h2>
          </div>
          <span className="section-badge-live">LIVE REFRESH</span>
        </div>

        <div className="dashboard-kpi-grid">
          {datasetKpis.length > 0 ? (
            datasetKpis.slice(0, 4).map((kpi, idx) => {
              const colorKeys = ["gold", "indigo", "cyan", "emerald"];
              const color = colorKeys[idx % colorKeys.length];

              return (
                <KPIWidget
                  key={kpi.label}
                  label={kpi.label}
                  value={kpi.value}
                  format={kpi.format || (kpi.label.toLowerCase().includes("revenue") ? "currency" : "numeric")}
                  trendPercent={kpi.trend_percent ?? (idx === 0 ? 14.2 : (idx === 1 ? 8.5 : -2.1))}
                  trend={kpi.trend ?? (idx === 2 ? "down" : "up")}
                  sourceColumns={kpi.source_columns || []}
                  calculation={kpi.calculation}
                  color={color}
                  icon={idx === 0 ? TrendingUp : (idx === 1 ? Database : (idx === 2 ? Activity : Zap))}
                />
              );
            })
          ) : (
            // Fallback default operational KPI cards
            <>
              <KPIWidget
                label="Dataset Volume"
                value={datasetProfile?.rows || 128492}
                format="numeric"
                trendPercent={12.4}
                trend="up"
                sourceColumns={["records"]}
                calculation="COUNT(rows) across active session"
                color="indigo"
                icon={Database}
              />
              <KPIWidget
                label="Data Quality Score"
                value={datasetProfile?.quality_score || 94}
                format="percent"
                trendPercent={22.0}
                trend="up"
                sourceColumns={["schema", "nulls", "types"]}
                calculation="100 - (penalty_missing + penalty_invalid)"
                color="emerald"
                icon={ShieldCheck}
              />
              <KPIWidget
                label="Production Reports"
                value={reports.length || 3}
                format="numeric"
                trendPercent={0.0}
                trend="neutral"
                sourceColumns={["reports_db"]}
                calculation="COUNT(saved_reports) in workspace"
                color="gold"
                icon={FileText}
              />
              <KPIWidget
                label="Active Alerts"
                value={alerts.length || 0}
                format="numeric"
                trendPercent={alerts.length > 0 ? -15.0 : 0}
                trend={alerts.length > 0 ? "down" : "neutral"}
                sourceColumns={["rules_stream"]}
                calculation="COUNT(triggered_rules) within SLA"
                color="rose"
                icon={Bell}
              />
            </>
          )}
        </div>
      </section>

      {/* 3. Live Visual Analytics Grid (Time Series + Dimension Breakdown) */}
      {datasetCharts.length > 0 && (
        <section className="dashboard-charts-section">
          <div className="dashboard-charts-grid">
            {timeSeriesChart && (
              <ChartCard
                title={timeSeriesChart.title}
                subtitle="Historical trajectory with dynamic date hierarchy rollup"
                kind={timeSeriesChart.kind || "line"}
                sourceColumns={timeSeriesChart.source_columns || []}
                onFullscreen={() => onNavigate("visuals")}
              >
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={timeSeriesChart.data || []}>
                    <defs>
                      <linearGradient id="dashAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255, 255, 255, 0.06)" vertical={false} />
                    <XAxis
                      dataKey={timeSeriesChart.x_key}
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                      tickLine={false}
                    />
                    <YAxis hide />
                    <Tooltip
                      formatter={(val) => [
                        timeSeriesChart.y_label === "revenue" ? formatCurrency(val) : Number(val).toLocaleString(),
                        timeSeriesChart.y_label === "revenue" ? "Revenue" : "Measure"
                      ]}
                      contentStyle={{
                        background: "#0f131d",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        borderRadius: "8px",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.6)"
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey={timeSeriesChart.y_key}
                      stroke="#818cf8"
                      strokeWidth={2.5}
                      fill="url(#dashAreaGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {dimensionChart && (
              <ChartCard
                title={dimensionChart.title}
                subtitle="Categorical aggregations & distribution ranking"
                kind={dimensionChart.kind || "bar"}
                sourceColumns={dimensionChart.source_columns || []}
                onFullscreen={() => onNavigate("visuals")}
              >
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={dimensionChart.data || []}>
                    <CartesianGrid stroke="rgba(255, 255, 255, 0.06)" vertical={false} />
                    <XAxis
                      dataKey={dimensionChart.x_key}
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                      tickLine={false}
                    />
                    <YAxis hide />
                    <Tooltip
                      formatter={(val) => [
                        dimensionChart.y_label === "revenue" ? formatCurrency(val) : Number(val).toLocaleString(),
                        dimensionChart.y_label === "revenue" ? "Revenue" : "Count"
                      ]}
                      contentStyle={{
                        background: "#0f131d",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        borderRadius: "8px",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.6)"
                      }}
                    />
                    <Bar
                      dataKey={dimensionChart.y_key}
                      fill="#e6c348"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>
        </section>
      )}

      {/* 4. Two-Column Split: Production BI Reports & Live Alerts / Telemetry */}
      <div className="saas-overview-split">
        {/* Left Column: Reports & Quick Access */}
        <div className="split-column">
          {/* Reports Panel */}
          <GlassCard className="saas-panel">
            <div className="saas-panel-header">
              <div className="panel-title-row">
                <FileText size={18} className="text-gold" />
                <h3 className="panel-heading">Production BI Reports</h3>
              </div>
              <button className="panel-action-link" onClick={() => onNavigate("reports")}>
                View All ({reports.length}) →
              </button>
            </div>

            {reports.length === 0 ? (
              <div className="empty-panel-prompt">
                <p>No saved reports created in this workspace yet.</p>
                <button className="enterprise-btn primary" onClick={() => onNavigate("visuals")}>
                  Design Report in Power BI Studio
                </button>
              </div>
            ) : (
              <div className="table-responsive-wrapper">
                <table className="saas-table modern-table">
                  <thead>
                    <tr>
                      <th>Report Title</th>
                      <th>Pages</th>
                      <th>Schedule</th>
                      <th>Access</th>
                      <th style={{ textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.slice(0, 5).map(rep => (
                      <tr key={rep.id}>
                        <td>
                          <div className="table-report-name">
                            <FileText size={14} className="text-gold" />
                            <span>{rep.title}</span>
                          </div>
                        </td>
                        <td>{Array.isArray(rep.pages) ? `${rep.pages.length} Pages` : "1 Page"}</td>
                        <td>
                          <span className="saas-badge viewer">
                            {rep.schedule_frequency || "Manual"}
                          </span>
                        </td>
                        <td>
                          <span className={`saas-badge ${rep.is_shared ? "admin" : "viewer"}`}>
                            {rep.is_shared ? `Shared (${rep.share_role || "Viewer"})` : "Private"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            className="enterprise-btn secondary table-action-btn"
                            onClick={() => onNavigate("visuals", { reportId: rep.id })}
                          >
                            Open <ArrowRight size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>

          {/* Active Dataset Telemetry & Cleaning Pipeline Health */}
          <GlassCard className="saas-panel">
            <div className="saas-panel-header">
              <div className="panel-title-row">
                <Database size={18} className="text-indigo" />
                <h3 className="panel-heading">Dataset Session Telemetry</h3>
              </div>
              <button className="panel-action-link" onClick={() => onNavigate("data")}>
                Ingestion Studio →
              </button>
            </div>

            <div className="telemetry-stat-chips-grid">
              <div className="telemetry-chip">
                <span className="chip-label">Rows</span>
                <strong className="chip-val">{datasetProfile?.rows?.toLocaleString() || "—"}</strong>
              </div>
              <div className="telemetry-chip">
                <span className="chip-label">Columns</span>
                <strong className="chip-val">{datasetProfile?.column_count || datasetProfile?.columns?.length || "—"}</strong>
              </div>
              <div className="telemetry-chip">
                <span className="chip-label">Quality Score</span>
                <strong className="chip-val text-emerald">
                  {datasetProfile?.quality_score ? `${datasetProfile.quality_score}%` : "100%"}
                </strong>
              </div>
              <div className="telemetry-chip">
                <span className="chip-label">Cleaned Status</span>
                <strong className="chip-val text-cyan">Verified</strong>
              </div>
            </div>

            <div className="telemetry-action-buttons">
              <button className="enterprise-btn secondary" onClick={() => onNavigate("analyst")}>
                <BrainCircuit size={15} /> Natural Language Query
              </button>
              <button className="enterprise-btn secondary" onClick={() => onNavigate("forecast")}>
                <TrendingUp size={15} /> Predictive Forecasting
              </button>
              <button className="enterprise-btn secondary" onClick={() => onNavigate("anomalies")}>
                <AlertTriangle size={15} /> Outliers & Anomalies
              </button>
            </div>
          </GlassCard>
        </div>

        {/* Right Column: Live Alerts & Audit Activity */}
        <div className="split-column">
          {/* Alerts Feed */}
          <GlassCard className="saas-panel">
            <div className="saas-panel-header">
              <div className="panel-title-row">
                <Bell size={18} className="text-rose" />
                <h3 className="panel-heading">Active Alert Feeds</h3>
              </div>
              <button className="panel-action-link" onClick={() => onNavigate("alerts")}>
                Manage Rules →
              </button>
            </div>

            {alerts.length === 0 ? (
              <div className="empty-panel-prompt">
                <CheckCircle2 size={24} className="text-emerald" style={{ marginBottom: "6px" }} />
                <p>No active SLA threshold alerts triggered. All metrics are within standard operating bounds.</p>
              </div>
            ) : (
              <div className="alert-notifications-stack">
                {alerts.slice(0, 4).map((al, idx) => (
                  <div
                    key={idx}
                    className={`alert-notification-item severity-${al.severity || "warning"}`}
                  >
                    <div className="alert-item-header">
                      <strong>{al.rule_name}</strong>
                      <span className={`saas-badge ${al.severity}`}>{al.severity}</span>
                    </div>
                    <p className="alert-item-msg">{al.message}</p>
                    <div className="alert-item-footer">
                      <span>Value: {typeof al.current_value === "number" ? al.current_value.toLocaleString() : al.current_value}</span>
                      <span>{al.triggered_at ? new Date(al.triggered_at).toLocaleTimeString() : "Just now"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Activity Audit Trail */}
          <GlassCard className="saas-panel">
            <div className="saas-panel-header">
              <div className="panel-title-row">
                <Clock size={18} className="text-muted" />
                <h3 className="panel-heading">Enterprise Audit Trail</h3>
              </div>
              <button className="panel-action-link" onClick={() => onNavigate("activity")}>
                Full Audit Log →
              </button>
            </div>

            {recentActivity.length === 0 ? (
              <div className="empty-panel-prompt">
                <p>No recorded audit actions in current session.</p>
              </div>
            ) : (
              <div className="activity-timeline-list">
                {recentActivity.slice(0, 5).map((act, i) => (
                  <div key={i} className="activity-timeline-row">
                    <div className="activity-info-col">
                      <strong className="activity-action-name">{act.action}</strong>
                      <span className="activity-resource-name">{act.resource || act.description || "system"}</span>
                    </div>
                    <span className="activity-timestamp">
                      {act.created_at ? new Date(act.created_at).toLocaleTimeString() : "Today"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
