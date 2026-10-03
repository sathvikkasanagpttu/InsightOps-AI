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

  // Integrations & Dispatch Test State
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedRuleId, setSelectedRuleId] = useState("");
  const [slackUrl, setSlackUrl] = useState("https://hooks.slack.com/services/T000/B000/XXXXXX");
  const [customWebhookUrl, setCustomWebhookUrl] = useState("https://api.yourdomain.com/webhooks/alerts");
  const [dispatchEmail, setDispatchEmail] = useState("alerts-admin@company.com");
  const [dispatching, setDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState(null);

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
      const validRules = Array.isArray(rulesData) ? rulesData : [];
      setRules(validRules);
      if (validRules.length > 0 && !selectedRuleId) {
        setSelectedRuleId(validRules[0].id);
      }
      setNotifications(Array.isArray(notifData) ? notifData : []);
    } catch (err) {
      console.warn("Error loading alerts data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadHistoryLogs() {
    setHistoryLoading(true);
    try {
      const logs = await api("/api/alerts/history").catch(() => []);
      setHistoryLogs(Array.isArray(logs) ? logs : []);
    } catch (err) {
      console.warn("Error loading alert history:", err);
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    loadAlertsData();
    loadHistoryLogs();
  }, [datasetId, activeWorkspace]);

  async function handleTriggerDispatch(e) {
    e?.preventDefault();
    if (!selectedRuleId) {
      addToast?.("Please select an alert rule to dispatch.", "error");
      return;
    }
    setDispatching(true);
    setDispatchResult(null);
    try {
      const res = await api(`/api/alerts/${selectedRuleId}/dispatch`, {
        method: "POST",
        body: JSON.stringify({
          slack_webhook_url: slackUrl.trim() || undefined,
          custom_webhook_url: customWebhookUrl.trim() || undefined,
          email: dispatchEmail.trim() || undefined
        })
      });
      setDispatchResult(res);
      addToast?.("Alert notification dispatched across configured channels!", "success");
      loadHistoryLogs();
    } catch (err) {
      addToast?.(err.message || "Failed to dispatch alert", "error");
    } finally {
      setDispatching(false);
    }
  }

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
        <button
          className={activeTab === "integrations" ? "selected" : ""}
          onClick={() => setActiveTab("integrations")}
          style={{ padding: "10px 18px", background: "none", border: "none", cursor: "pointer", color: activeTab === "integrations" ? "#e6c348" : "#a49d89", fontWeight: "600" }}
        >
          Integrations & Dispatch Audit ({historyLogs.length})
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

      {/* Tab 3: Integrations & Dispatch Audit */}
      {activeTab === "integrations" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Channel Dispatch Test Card */}
          <div className="saas-panel">
            <div className="saas-panel-header">
              <h2><Zap size={18} color="#e6c348" /> Multi-Channel Dispatcher & Webhook Studio</h2>
              <span style={{ fontSize: "12px", color: "#8a8370" }}>Enterprise Real-time Notification Engine</span>
            </div>

            <form onSubmit={handleTriggerDispatch} style={{ padding: "16px 20px" }}>
              <p style={{ margin: "0 0 16px 0", color: "#a49d89", fontSize: "13px" }}>
                Test multi-channel notifications across Slack Incoming Webhooks, Custom REST Webhooks (HMAC-SHA256 authenticated), and Transactional Email.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                <div className="saas-form-group">
                  <label>Triggering Alert Rule</label>
                  <select
                    className="saas-select"
                    value={selectedRuleId}
                    onChange={e => setSelectedRuleId(e.target.value)}
                  >
                    {rules.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.metric_column} {r.condition} {r.threshold_value})
                      </option>
                    ))}
                    {rules.length === 0 && <option value="">No rules available (Create one first)</option>}
                  </select>
                </div>

                <div className="saas-form-group">
                  <label>Target Email Address</label>
                  <input
                    type="email"
                    className="saas-input"
                    value={dispatchEmail}
                    onChange={e => setDispatchEmail(e.target.value)}
                    placeholder="devops@company.com"
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                <div className="saas-form-group">
                  <label>Slack Incoming Webhook URL</label>
                  <input
                    type="text"
                    className="saas-input"
                    value={slackUrl}
                    onChange={e => setSlackUrl(e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                  />
                </div>

                <div className="saas-form-group">
                  <label>Custom Webhook Endpoint (HMAC-Signed)</label>
                  <input
                    type="text"
                    className="saas-input"
                    value={customWebhookUrl}
                    onChange={e => setCustomWebhookUrl(e.target.value)}
                    placeholder="https://api.yourdomain.com/webhooks/alerts"
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "12px", color: "#8a8370", display: "flex", alignItems: "center", gap: "6px" }}>
                  <ShieldAlert size={14} color="#10b981" />
                  <span>Payloads include X-InsightOps-Signature (HMAC-SHA256) and ISO-8601 telemetry.</span>
                </div>
                <button
                  type="submit"
                  className="saas-action-btn primary"
                  disabled={dispatching || !selectedRuleId}
                  style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
                >
                  {dispatching ? (
                    <>
                      <RefreshCw size={14} className="spin" /> Dispatching Test...
                    </>
                  ) : (
                    <>
                      <Zap size={14} /> Dispatch Multi-Channel Test
                    </>
                  )}
                </button>
              </div>

              {dispatchResult && (
                <div
                  style={{
                    marginTop: "16px",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    background: "rgba(16, 185, 129, 0.08)",
                    border: "1px solid rgba(16, 185, 129, 0.2)",
                    fontSize: "13px"
                  }}
                >
                  <strong style={{ color: "#34d399", display: "block", marginBottom: "4px" }}>
                    ✓ Notification Dispatch Completed:
                  </strong>
                  <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", color: "#cbd5e1" }}>
                    <span>Slack: <strong style={{ color: "#fff" }}>{dispatchResult.slack_status}</strong></span>
                    <span>Webhook: <strong style={{ color: "#fff" }}>{dispatchResult.webhook_status}</strong></span>
                    <span>Email: <strong style={{ color: "#fff" }}>{dispatchResult.email_status}</strong></span>
                    <span>Rule: <strong style={{ color: "#fff" }}>{dispatchResult.title}</strong></span>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Real-time Delivery Audit History Table */}
          <div className="saas-panel">
            <div className="saas-panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2>Delivery History & Audit Trail ({historyLogs.length})</h2>
              <button className="icon-action" onClick={loadHistoryLogs} title="Refresh audit log">
                <RefreshCw size={14} />
              </button>
            </div>

            {historyLoading ? (
              <div style={{ padding: "30px", textAlign: "center", color: "#8a8370" }}>Loading audit records...</div>
            ) : historyLogs.length === 0 ? (
              <div style={{ padding: "30px", textAlign: "center", color: "#8a8370" }}>
                No notifications logged yet. Trigger a test dispatch above to see delivery logs.
              </div>
            ) : (
              <table className="saas-table">
                <thead>
                  <tr>
                    <th>Alert Title</th>
                    <th>Channel</th>
                    <th>Status</th>
                    <th>HTTP Code</th>
                    <th style={{ textAlign: "right" }}>Dispatched At</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLogs.map(log => (
                    <tr key={log.id}>
                      <td style={{ fontWeight: "600", color: "#fff" }}>{log.title}</td>
                      <td>
                        <span className="saas-badge" style={{ textTransform: "uppercase", fontSize: "11px" }}>
                          {log.channel}
                        </span>
                      </td>
                      <td>
                        <span className={`saas-badge ${log.status === "delivered" ? "success" : (log.status === "failed" ? "critical" : "warning")}`}>
                          {log.status}
                        </span>
                      </td>
                      <td style={{ fontFamily: "monospace", fontSize: "12px", color: log.status_code === 200 ? "#34d399" : "#cbd5e1" }}>
                        {log.status_code || "200"}
                      </td>
                      <td style={{ textAlign: "right", color: "#8a8370", fontSize: "12px" }}>
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
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
