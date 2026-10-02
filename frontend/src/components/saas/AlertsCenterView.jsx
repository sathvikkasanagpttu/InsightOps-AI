import React, { useEffect, useState } from "react";
import {
  Bell, AlertTriangle, Plus, Trash2, CheckCircle2, ShieldAlert,
  ArrowRight, X, RefreshCw, Mail, MessageSquare, Zap
} from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

export default function AlertsCenterView({ datasetId, addToast }) {
  const { activeWorkspace } = useAuth();
  const [activeTab, setActiveTab] = useState("feed");
  const [rules, setRules] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create rule modal
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [metric, setMetric] = useState("revenue");
  const [operator, setOperator] = useState("<");
  const [threshold, setThreshold] = useState("10000");
  const [severity, setSeverity] = useState("critical");
  const [channel, setChannel] = useState("in_app");
  const [saving, setSaving] = useState(false);

  async function loadAlertsData() {
    setLoading(true);
    try {
      const [rulesData, notifData] = await Promise.all([
        api("/api/alerts").catch(() => []),
        api(`/api/alerts/notifications?dataset_id=${encodeURIComponent(datasetId || "demo-sales")}`).catch(() => [])
      ]);
      setRules(Array.isArray(rulesData) ? rulesData : []);
      setNotifications(Array.isArray(notifData) ? notifData : []);
    } catch (err) {
      console.warn("Error loading alerts data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAlertsData();
  }, [datasetId, activeWorkspace]);

  async function handleToggleRule(ruleId) {
    try {
      const updated = await api(`/api/alerts/${ruleId}/toggle`, { method: "POST" });
      setRules(prev => prev.map(r => r.id === ruleId ? { ...r, is_active: updated.is_active } : r));
      addToast?.(`Rule "${updated.name}" is now ${updated.is_active ? "active" : "paused"}`, "success");
      // Refresh notifications
      const notifs = await api(`/api/alerts/notifications?dataset_id=${encodeURIComponent(datasetId || "demo-sales")}`);
      setNotifications(Array.isArray(notifs) ? notifs : []);
    } catch (err) {
      addToast?.(err.message || "Failed to toggle rule", "error");
    }
  }

  async function handleDeleteRule(ruleId, ruleName) {
    if (!window.confirm(`Delete alert rule "${ruleName}"?`)) return;
    try {
      await api(`/api/alerts/${ruleId}`, { method: "DELETE" });
      setRules(prev => prev.filter(r => r.id !== ruleId));
      addToast?.("Rule deleted", "success");
      loadAlertsData();
    } catch (err) {
      addToast?.(err.message || "Failed to delete rule", "error");
    }
  }

  async function handleCreateRule(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api("/api/alerts", {
        method: "POST",
        body: JSON.stringify({
          workspace_id: activeWorkspace?.id || "default-workspace",
          name: name.trim(),
          metric: metric.trim(),
          condition_operator: operator,
          threshold_value: Number(threshold) || 0,
          severity,
          notification_channel: channel,
          is_active: true
        })
      });
      setModalOpen(false);
      setName("");
      addToast?.("Alert rule created successfully!", "success");
      await loadAlertsData();
    } catch (err) {
      addToast?.(err.message || "Failed to create rule", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", paddingBottom: "40px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p className="eyebrow" style={{ margin: "0 0 4px 0", fontSize: "11px" }}>INTELLIGENT MONITORING & SLA</p>
          <h1 style={{ margin: "0", fontSize: "24px", fontWeight: "700" }}>Alerts Center</h1>
          <p style={{ margin: "4px 0 0 0", color: "#a49d89", fontSize: "14px" }}>
            Real-time threshold triggers, anomaly detectors, and automated metric monitors for business SLAs.
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button className="icon-action" onClick={loadAlertsData} title="Refresh alerts">
            <RefreshCw size={15} />
          </button>
          <button className="saas-action-btn primary" onClick={() => setModalOpen(true)}>
            <Plus size={16} /> New Alert Rule
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="studio-tabs" style={{ display: "flex", gap: "8px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <button
          className={activeTab === "feed" ? "selected" : ""}
          onClick={() => setActiveTab("feed")}
          style={{ padding: "10px 18px", background: "none", border: "none", cursor: "pointer", color: activeTab === "feed" ? "#e6c348" : "#a49d89", fontWeight: "600" }}
        >
          Live Triggered Feed ({notifications.length})
        </button>
        <button
          className={activeTab === "rules" ? "selected" : ""}
          onClick={() => setActiveTab("rules")}
          style={{ padding: "10px 18px", background: "none", border: "none", cursor: "pointer", color: activeTab === "rules" ? "#e6c348" : "#a49d89", fontWeight: "600" }}
        >
          Monitoring Rules ({rules.length})
        </button>
      </div>

      {/* Tab 1: Live Triggered Feed */}
      {activeTab === "feed" && (
        <div className="saas-panel">
          <div className="saas-panel-header">
            <h2><Bell size={18} color="#f87171" /> Triggered Alert Notifications</h2>
            <span style={{ fontSize: "12px", color: "#8a8370" }}>Active on Dataset: {datasetId || "sales.csv"}</span>
          </div>

          {loading ? (
            <div style={{ padding: "30px", textAlign: "center", color: "#8a8370" }}>Evaluating alert rules...</div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <CheckCircle2 size={36} color="#10b981" style={{ margin: "0 auto 10px auto" }} />
              <h3 style={{ margin: "0 0 4px 0", color: "#fff" }}>All Metrics Within SLA Bounds</h3>
              <p style={{ color: "#a49d89", fontSize: "13px" }}>
                No active rules have been breached on this dataset. You will see alerts here when thresholds are crossed.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {notifications.map((notif, index) => (
                <div
                  key={index}
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderLeft: `5px solid ${notif.severity === "critical" ? "#ef4444" : (notif.severity === "warning" ? "#f59e0b" : "#3b82f6")}`,
                    borderRadius: "8px",
                    padding: "16px 20px"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <strong style={{ fontSize: "15px", color: "#fff" }}>{notif.rule_name}</strong>
                        <span className={`saas-badge ${notif.severity}`}>{notif.severity}</span>
                      </div>
                      <p style={{ margin: "6px 0 0 0", color: "#ddd6c5", fontSize: "13px" }}>{notif.message}</p>
                    </div>
                    <span style={{ fontSize: "11px", color: "#8a8370" }}>
                      {notif.triggered_at ? new Date(notif.triggered_at).toLocaleTimeString() : "Just now"}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "24px", paddingTop: "10px", borderTop: "1px solid rgba(255,255,255,0.04)", fontSize: "12px", color: "#a49d89" }}>
                    <span>Metric: <strong style={{ color: "#fff" }}>{notif.metric}</strong></span>
                    <span>Triggered Value: <strong style={{ color: notif.severity === "critical" ? "#f87171" : "#e6c348" }}>{typeof notif.current_value === "number" ? notif.current_value.toLocaleString() : notif.current_value}</strong></span>
                    <span>Threshold: <strong style={{ color: "#fff" }}>{notif.operator} {typeof notif.threshold === "number" ? notif.threshold.toLocaleString() : notif.threshold}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Monitoring Rules */}
      {activeTab === "rules" && (
        <div className="saas-panel">
          <div className="saas-panel-header">
            <h2><ShieldAlert size={18} color="#e6c348" /> Configured Alert Rules</h2>
            <button className="saas-action-btn primary" onClick={() => setModalOpen(true)}>
              <Plus size={15} /> Add Rule
            </button>
          </div>

          {loading ? (
            <div style={{ padding: "30px", textAlign: "center", color: "#8a8370" }}>Loading rules...</div>
          ) : rules.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#8a8370" }}>No alert rules configured yet.</div>
          ) : (
            <table className="saas-table">
              <thead>
                <tr>
                  <th>Rule Name</th>
                  <th>Metric / Target</th>
                  <th>Condition</th>
                  <th>Severity</th>
                  <th>Channel</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map(rule => (
                  <tr key={rule.id}>
                    <td style={{ fontWeight: "600", color: "#fff" }}>{rule.name}</td>
                    <td><code>{rule.metric}</code></td>
                    <td>{rule.condition_operator} {rule.threshold_value?.toLocaleString()}</td>
                    <td><span className={`saas-badge ${rule.severity}`}>{rule.severity}</span></td>
                    <td>
                      <span style={{ fontSize: "12px", color: "#a49d89", display: "flex", alignItems: "center", gap: "4px" }}>
                        {rule.notification_channel === "email" ? <Mail size={13} /> : <Zap size={13} />}
                        {rule.notification_channel || "in_app"}
                      </span>
                    </td>
                    <td>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={rule.is_active}
                          onChange={() => handleToggleRule(rule.id)}
                        />
                        <span className="slider" />
                      </label>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="text-button"
                        style={{ color: "#f87171" }}
                        onClick={() => handleDeleteRule(rule.id, rule.name)}
                        title="Delete rule"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Create Alert Rule Modal */}
      {modalOpen && (
        <div className="saas-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="saas-modal" onClick={e => e.stopPropagation()}>
            <div className="saas-modal-header">
              <h3>Create Alert Rule</h3>
              <button className="text-button" onClick={() => setModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateRule}>
              <div className="saas-modal-body">
                <div className="saas-form-group">
                  <label>Rule Name *</label>
                  <input
                    type="text"
                    className="saas-input"
                    placeholder="e.g. Low Revenue Warning, High Duplicate Spike"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 2fr", gap: "10px" }}>
                  <div className="saas-form-group">
                    <label>Target Metric</label>
                    <input
                      type="text"
                      className="saas-input"
                      placeholder="e.g. revenue, quality_score, duplicates"
                      value={metric}
                      onChange={e => setMetric(e.target.value)}
                      required
                    />
                  </div>
                  <div className="saas-form-group">
                    <label>Operator</label>
                    <select className="saas-select" value={operator} onChange={e => setOperator(e.target.value)}>
                      <option value="<">&lt; Less than</option>
                      <option value=">">&gt; Greater than</option>
                      <option value="<=">&le; Less or equal</option>
                      <option value=">=">&ge; Greater or equal</option>
                      <option value="==">== Equal to</option>
                    </select>
                  </div>
                  <div className="saas-form-group">
                    <label>Threshold Value</label>
                    <input
                      type="number"
                      className="saas-input"
                      value={threshold}
                      onChange={e => setThreshold(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="saas-form-group">
                    <label>Severity Level</label>
                    <select className="saas-select" value={severity} onChange={e => setSeverity(e.target.value)}>
                      <option value="critical">Critical (Immediate SLA breach)</option>
                      <option value="warning">Warning (Noticeable deviation)</option>
                      <option value="info">Info (Informational trigger)</option>
                    </select>
                  </div>
                  <div className="saas-form-group">
                    <label>Notification Channel</label>
                    <select className="saas-select" value={channel} onChange={e => setChannel(e.target.value)}>
                      <option value="in_app">In-App Notification Feed</option>
                      <option value="email">Email Alert Notification</option>
                      <option value="slack">Slack / Webhook Notification</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="saas-modal-footer">
                <button type="button" className="saas-action-btn secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="saas-action-btn primary" disabled={saving}>
                  {saving ? "Saving..." : "Create Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
