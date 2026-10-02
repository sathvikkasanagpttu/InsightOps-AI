import React, { useEffect, useState } from "react";
import {
  Clock, Search, Filter, Download, ShieldCheck, ChevronDown,
  ChevronRight, RefreshCw, Activity, Terminal
} from "lucide-react";
import { api } from "../../lib/api";

export default function ActivityLogView({ addToast }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAction, setSelectedAction] = useState("all");
  const [expandedLogId, setExpandedLogId] = useState(null);

  async function loadLogs() {
    setLoading(true);
    try {
      const data = await api("/api/activity?limit=100");
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("Failed to fetch activity logs:", err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, []);

  const actionTypes = ["all", "user.login", "dataset.upload", "report.create", "report.export", "workspace.create"];

  const filteredLogs = logs.filter(log => {
    const matchesAction = selectedAction === "all" || log.action === selectedAction;
    const matchesQuery = !searchQuery ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.resource && log.resource.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (log.user_email && log.user_email.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesAction && matchesQuery;
  });

  function exportCSV() {
    if (filteredLogs.length === 0) return;
    const headers = ["Timestamp", "Action", "Resource", "User", "IP Address", "Status"];
    const rows = filteredLogs.map(l => [
      l.created_at || "",
      `"${l.action || ""}"`,
      `"${l.resource || ""}"`,
      `"${l.user_email || ""}"`,
      l.ip_address || "127.0.0.1",
      l.status || "success"
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `audit_log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast?.("Audit log exported to CSV", "success");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", paddingBottom: "40px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p className="eyebrow" style={{ margin: "0 0 4px 0", fontSize: "11px" }}>SECURITY & COMPLIANCE</p>
          <h1 style={{ margin: "0", fontSize: "24px", fontWeight: "700" }}>Activity & Audit Log</h1>
          <p style={{ margin: "4px 0 0 0", color: "#a49d89", fontSize: "14px" }}>
            Immutable chronological record of logins, dataset ingestions, report exports, and security actions.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="icon-action" onClick={loadLogs} title="Refresh audit log">
            <RefreshCw size={15} />
          </button>
          <button className="saas-action-btn secondary" onClick={exportCSV} disabled={filteredLogs.length === 0}>
            <Download size={15} /> Export Audit Log
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <div className="search-field" style={{ flex: 1, minWidth: "260px" }}>
          <Search size={16} color="#8a8370" />
          <input
            type="text"
            placeholder="Search by action, user, or resource..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", gap: "6px", overflowX: "auto" }}>
          {actionTypes.map(act => (
            <button
              key={act}
              className={`saas-badge ${selectedAction === act ? "admin" : "viewer"}`}
              style={{ cursor: "pointer", padding: "6px 12px", textTransform: "capitalize", fontSize: "12px" }}
              onClick={() => setSelectedAction(act)}
            >
              {act === "all" ? "All Events" : act.replace(".", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table */}
      <div className="saas-panel">
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#8a8370" }}>Loading audit records...</div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#8a8370" }}>
            No audit records match the current filters.
          </div>
        ) : (
          <table className="saas-table">
            <thead>
              <tr>
                <th style={{ width: "30px" }}></th>
                <th>Event Type</th>
                <th>Target Resource</th>
                <th>User / Actor</th>
                <th>IP Address</th>
                <th>Timestamp</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => {
                const isExpanded = expandedLogId === log.id;
                return (
                  <React.Fragment key={log.id}>
                    <tr
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <td style={{ color: "#8a8370" }}>
                        {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </td>
                      <td style={{ fontWeight: "600", color: "#fff" }}>
                        <span style={{ color: "#e6c348", fontFamily: "monospace" }}>{log.action}</span>
                      </td>
                      <td>{log.resource || "system"}</td>
                      <td style={{ color: "#ddd6c5" }}>{log.user_email || "System"}</td>
                      <td style={{ color: "#8a8370", fontSize: "12px" }}>{log.ip_address || "127.0.0.1"}</td>
                      <td style={{ color: "#8a8370", fontSize: "12px" }}>
                        {log.created_at ? new Date(log.created_at).toLocaleString() : "Just now"}
                      </td>
                      <td>
                        <span className="saas-badge viewer" style={{ color: "#10b981", borderColor: "#10b98144" }}>
                          Success
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} style={{ background: "rgba(0,0,0,0.3)", padding: "14px 20px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px", color: "#a49d89", fontSize: "12px" }}>
                            <Terminal size={14} /> <strong>Audit Event Details & Metadata Payload:</strong>
                          </div>
                          <pre style={{ margin: 0, padding: "10px", background: "#0b0c10", borderRadius: "6px", fontSize: "12px", color: "#e6c348", overflowX: "auto" }}>
                            {JSON.stringify(log.details || { action: log.action, resource: log.resource, timestamp: log.created_at }, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
