import React, { useEffect, useState } from "react";
import {
  BarChart3, BrainCircuit, Database, FileText, LayoutGrid, Layers,
  Bell, ShieldCheck, ArrowRight, Clock, Plus, ExternalLink, Activity, Users, AlertTriangle
} from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

export default function SaaSDashboardView({ onNavigate, datasetId, datasetProfile }) {
  const { user, activeWorkspace, workspaces } = useAuth();
  const [reports, setReports] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      try {
        const [repRes, notifRes, actRes, sysRes] = await Promise.all([
          api("/api/reports").catch(() => []),
          api(`/api/alerts/notifications?dataset_id=${encodeURIComponent(datasetId || "demo-sales")}`).catch(() => []),
          api("/api/activity?limit=6").catch(() => []),
          api("/api/system/health").catch(() => null)
        ]);
        setReports(Array.isArray(repRes) ? repRes : []);
        setAlerts(Array.isArray(notifRes) ? notifRes : []);
        setRecentActivity(Array.isArray(actRes) ? actRes : []);
        setSystemHealth(sysRes);
      } catch (err) {
        console.warn("Error fetching dashboard overview data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, [datasetId, activeWorkspace]);

  return (
    <div className="saas-dashboard-grid">
      {/* Hero Banner with Actions */}
      <section className="saas-hero-banner">
        <div className="saas-hero-content">
          <p className="eyebrow" style={{ margin: "0 0 4px 0", fontSize: "11px", letterSpacing: "1px" }}>
            ENTERPRISE AI BUSINESS INTELLIGENCE SAAS
          </p>
          <h1>
            Welcome back, <em>{user?.full_name || "Analyst"}</em>
          </h1>
          <p>
            Workspace: <strong style={{ color: "#e6c348" }}>{activeWorkspace?.name || "Production Analytics"}</strong> ·
            Dataset: <strong style={{ color: "#fff" }}>{datasetProfile?.filename || datasetId || "Active Dataset"}</strong>
            {datasetProfile?.rows ? ` (${datasetProfile.rows.toLocaleString()} rows)` : ""}
          </p>
        </div>

        <div className="saas-quick-actions">
          <button className="saas-action-btn primary" onClick={() => onNavigate("visuals")}>
            <LayoutGrid size={16} /> Power BI Studio
          </button>
          <button className="saas-action-btn secondary" onClick={() => onNavigate("data")}>
            <Database size={16} /> Ingest Dataset
          </button>
          <button className="saas-action-btn secondary" onClick={() => onNavigate("reports")}>
            <Plus size={16} /> New Report
          </button>
        </div>
      </section>

      {/* SaaS Stats Overview Row */}
      <div className="saas-stats-row">
        <div className="saas-stat-card">
          <div className="saas-stat-icon"><Layers size={22} /></div>
          <div className="saas-stat-info">
            <span>Workspaces</span>
            <strong>{workspaces?.length || 1} Active</strong>
            <small>Role: {activeWorkspace?.role || "Owner"}</small>
          </div>
        </div>

        <div className="saas-stat-card">
          <div className="saas-stat-icon"><Database size={22} /></div>
          <div className="saas-stat-info">
            <span>Active Dataset</span>
            <strong>{datasetProfile?.rows ? `${datasetProfile.rows.toLocaleString()} Rows` : "Connected"}</strong>
            <small>{datasetProfile?.quality_score ? `${datasetProfile.quality_score}% Quality` : "Inspected"}</small>
          </div>
        </div>

        <div className="saas-stat-card">
          <div className="saas-stat-icon"><FileText size={22} /></div>
          <div className="saas-stat-info">
            <span>Saved Reports</span>
            <strong>{reports.length} Reports</strong>
            <small>Multi-page & Schedulable</small>
          </div>
        </div>

        <div className="saas-stat-card">
          <div className="saas-stat-icon"><Bell size={22} /></div>
          <div className="saas-stat-info">
            <span>Active Alerts</span>
            <strong style={{ color: alerts.some(a => a.severity === "critical") ? "#f87171" : "#e6c348" }}>
              {alerts.length} Triggered
            </strong>
            <small>{alerts.filter(a => a.severity === "critical").length} Critical</small>
          </div>
        </div>

        <div className="saas-stat-card">
          <div className="saas-stat-icon"><ShieldCheck size={22} /></div>
          <div className="saas-stat-info">
            <span>System Health</span>
            <strong style={{ color: "#10b981" }}>{systemHealth?.status ? "Operational" : "Healthy"}</strong>
            <small>DB: {systemHealth?.database?.dialect || "SQLAlchemy"}</small>
          </div>
        </div>
      </div>

      {/* Two Column Split: Left = Datasets & Reports, Right = Alerts & Activity */}
      <div className="saas-overview-split">
        {/* Left Column: Reports & Quick Access */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Reports Panel */}
          <div className="saas-panel">
            <div className="saas-panel-header">
              <h2><FileText size={18} color="#e6c348" /> Production BI Reports</h2>
              <button onClick={() => onNavigate("reports")}>View All Reports →</button>
            </div>

            {reports.length === 0 ? (
              <div style={{ padding: "30px", textAlign: "center", color: "#8a8370" }}>
                <p>No saved reports yet in this workspace.</p>
                <button className="saas-action-btn primary" onClick={() => onNavigate("visuals")} style={{ margin: "10px auto" }}>
                  Design Report in Power BI Studio
                </button>
              </div>
            ) : (
              <table className="saas-table">
                <thead>
                  <tr>
                    <th>Report Title</th>
                    <th>Pages</th>
                    <th>Schedule</th>
                    <th>Sharing</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.slice(0, 5).map(rep => (
                    <tr key={rep.id}>
                      <td style={{ fontWeight: "600", color: "#fff" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <FileText size={15} color="#e6c348" />
                          <span>{rep.title}</span>
                        </div>
                      </td>
                      <td>{Array.isArray(rep.pages) ? `${rep.pages.length} Pages` : "1 Page"}</td>
                      <td>
                        <span className="saas-badge viewer">
                          {rep.schedule_frequency || "None"}
                        </span>
                      </td>
                      <td>
                        <span className={`saas-badge ${rep.is_shared ? "admin" : "viewer"}`}>
                          {rep.is_shared ? `Shared (${rep.share_role || "Viewer"})` : "Private"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="saas-action-btn secondary"
                          style={{ padding: "4px 10px", fontSize: "12px" }}
                          onClick={() => onNavigate("visuals", { reportId: rep.id })}
                        >
                          Open <ArrowRight size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Active Dataset Overview & Profile Card */}
          <div className="saas-panel">
            <div className="saas-panel-header">
              <h2><Database size={18} color="#60a5fa" /> Active Dataset Telemetry</h2>
              <button onClick={() => onNavigate("data")}>Ingestion Studio →</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "16px" }}>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "8px" }}>
                <span style={{ fontSize: "11px", color: "#8a8370", textTransform: "uppercase" }}>Rows Count</span>
                <p style={{ margin: "4px 0 0 0", fontSize: "18px", fontWeight: "700", color: "#fff" }}>
                  {datasetProfile?.rows ? datasetProfile.rows.toLocaleString() : "—"}
                </p>
              </div>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "8px" }}>
                <span style={{ fontSize: "11px", color: "#8a8370", textTransform: "uppercase" }}>Columns</span>
                <p style={{ margin: "4px 0 0 0", fontSize: "18px", fontWeight: "700", color: "#fff" }}>
                  {datasetProfile?.columns ? datasetProfile.columns.length : "—"}
                </p>
              </div>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "8px" }}>
                <span style={{ fontSize: "11px", color: "#8a8370", textTransform: "uppercase" }}>Data Quality</span>
                <p style={{ margin: "4px 0 0 0", fontSize: "18px", fontWeight: "700", color: "#10b981" }}>
                  {datasetProfile?.quality_score ? `${datasetProfile.quality_score}%` : "100%"}
                </p>
              </div>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "8px" }}>
                <span style={{ fontSize: "11px", color: "#8a8370", textTransform: "uppercase" }}>Duplicates</span>
                <p style={{ margin: "4px 0 0 0", fontSize: "18px", fontWeight: "700", color: "#f87171" }}>
                  {datasetProfile?.cleaning_stats?.duplicate_rows ?? 0}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button className="saas-action-btn secondary" onClick={() => onNavigate("analyst")}>
                <BrainCircuit size={15} /> Ask AI Analyst
              </button>
              <button className="saas-action-btn secondary" onClick={() => onNavigate("forecast")}>
                <Activity size={15} /> Time Series Forecast
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Alerts & Audit Activity */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Alerts Feed */}
          <div className="saas-panel">
            <div className="saas-panel-header">
              <h2><Bell size={18} color="#f87171" /> Real-time Alert Feed</h2>
              <button onClick={() => onNavigate("alerts")}>Manage Rules →</button>
            </div>

            {alerts.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", color: "#8a8370", fontSize: "13px" }}>
                No active threshold alerts triggered on current dataset. All systems within SLA bounds.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {alerts.slice(0, 4).map((al, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderLeft: `4px solid ${al.severity === "critical" ? "#ef4444" : "#f59e0b"}`,
                      borderRadius: "6px",
                      padding: "10px 14px",
                      fontSize: "13px"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <strong style={{ color: "#fff" }}>{al.rule_name}</strong>
                      <span className={`saas-badge ${al.severity}`}>{al.severity}</span>
                    </div>
                    <p style={{ margin: "0", color: "#a49d89", fontSize: "12px" }}>{al.message}</p>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", fontSize: "11px", color: "#8a8370" }}>
                      <span>Value: {typeof al.current_value === "number" ? al.current_value.toLocaleString() : al.current_value}</span>
                      <span>{al.triggered_at ? new Date(al.triggered_at).toLocaleTimeString() : "Just now"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity Audit Trail */}
          <div className="saas-panel">
            <div className="saas-panel-header">
              <h2><Clock size={18} color="#a49d89" /> Audit & Activity Trail</h2>
              <button onClick={() => onNavigate("activity")}>View Full Log →</button>
            </div>

            {recentActivity.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", color: "#8a8370", fontSize: "13px" }}>
                No recorded actions yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {recentActivity.slice(0, 5).map((act, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      fontSize: "12px"
                    }}
                  >
                    <div>
                      <strong style={{ color: "#e6c348", marginRight: "6px" }}>{act.action}</strong>
                      <span style={{ color: "#a49d89" }}>{act.resource || "system"}</span>
                    </div>
                    <span style={{ color: "#6b7280", fontSize: "11px" }}>
                      {act.created_at ? new Date(act.created_at).toLocaleDateString() : "Today"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
