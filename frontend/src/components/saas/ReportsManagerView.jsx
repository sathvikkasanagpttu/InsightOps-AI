import React, { useEffect, useState } from "react";
import {
  FileText, Plus, Copy, Share2, Calendar, Trash2, ArrowRight,
  ExternalLink, Check, Download, Search, Edit3, X, Eye, Lock
} from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

export default function ReportsManagerView({ onNavigate, addToast }) {
  const { activeWorkspace } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newSchedule, setNewSchedule] = useState("none");
  const [creating, setCreating] = useState(false);

  const [shareModalReport, setShareModalReport] = useState(null);
  const [isShared, setIsShared] = useState(false);
  const [shareRole, setShareRole] = useState("Viewer");
  const [copiedLink, setCopiedLink] = useState(false);

  const [scheduleModalReport, setScheduleModalReport] = useState(null);
  const [scheduleFreq, setScheduleFreq] = useState("weekly");
  const [scheduleRecipients, setScheduleRecipients] = useState("");

  async function loadReports() {
    setLoading(true);
    try {
      const data = await api("/api/reports");
      setReports(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("Failed to load reports:", err);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, [activeWorkspace]);

  async function handleCreateReport(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const created = await api("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          workspace_id: activeWorkspace?.id || "default-workspace",
          title: newTitle.trim(),
          description: newDesc.trim(),
          schedule_frequency: newSchedule,
          pages: [
            { id: "page_1", title: "Executive Overview", visuals: [] },
            { id: "page_2", title: "Performance Analysis", visuals: [] }
          ]
        })
      });
      setCreateModalOpen(false);
      setNewTitle("");
      setNewDesc("");
      addToast?.("Report created! Launching in Power BI Studio...", "success");
      await loadReports();
      onNavigate("visuals", { reportId: created.id });
    } catch (err) {
      addToast?.(err.message || "Failed to create report", "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleDuplicateReport(reportId) {
    try {
      const dup = await api(`/api/reports/${reportId}/duplicate`, { method: "POST" });
      addToast?.(`Duplicated report: "${dup.title}"`, "success");
      await loadReports();
    } catch (err) {
      addToast?.(err.message || "Failed to duplicate report", "error");
    }
  }

  async function handleDeleteReport(reportId, title) {
    if (!window.confirm(`Are you sure you want to delete report "${title}"?`)) return;
    try {
      await api(`/api/reports/${reportId}`, { method: "DELETE" });
      setReports(prev => prev.filter(r => r.id !== reportId));
      addToast?.("Report deleted successfully", "success");
    } catch (err) {
      addToast?.(err.message || "Failed to delete report", "error");
    }
  }

  async function handleSaveShare(e) {
    e.preventDefault();
    if (!shareModalReport) return;
    try {
      const updated = await api(`/api/reports/${shareModalReport.id}/share`, {
        method: "POST",
        body: JSON.stringify({ is_shared: isShared, share_role: shareRole })
      });
      setReports(prev => prev.map(r => r.id === shareModalReport.id ? { ...r, is_shared: isShared, share_role: shareRole } : r));
      setShareModalReport(null);
      addToast?.("Share settings updated!", "success");
    } catch (err) {
      addToast?.(err.message || "Failed to update sharing", "error");
    }
  }

  async function handleSaveSchedule(e) {
    e.preventDefault();
    if (!scheduleModalReport) return;
    try {
      await api(`/api/reports/${scheduleModalReport.id}`, {
        method: "PUT",
        body: JSON.stringify({
          schedule_frequency: scheduleFreq,
          description: scheduleRecipients ? `${scheduleModalReport.description || ""} [Delivery: ${scheduleRecipients}]` : scheduleModalReport.description
        })
      });
      setReports(prev => prev.map(r => r.id === scheduleModalReport.id ? { ...r, schedule_frequency: scheduleFreq } : r));
      setScheduleModalReport(null);
      addToast?.(`Scheduled report for ${scheduleFreq} delivery`, "success");
    } catch (err) {
      addToast?.(err.message || "Failed to update schedule", "error");
    }
  }

  const filteredReports = reports.filter(r =>
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", paddingBottom: "40px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p className="eyebrow" style={{ margin: "0 0 4px 0", fontSize: "11px" }}>PRODUCTION REPORT SUITE</p>
          <h1 style={{ margin: "0", fontSize: "24px", fontWeight: "700" }}>Reports Library</h1>
          <p style={{ margin: "4px 0 0 0", color: "#a49d89", fontSize: "14px" }}>
            Design, schedule, share and export multi-page BI dashboards and corporate reports.
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button className="saas-action-btn primary" onClick={() => setCreateModalOpen(true)}>
            <Plus size={16} /> New Report
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
        <div className="search-field" style={{ flex: 1, maxWidth: "400px" }}>
          <Search size={16} color="#8a8370" />
          <input
            type="text"
            placeholder="Filter reports by title or keywords..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <span style={{ fontSize: "13px", color: "#8a8370" }}>
          Showing {filteredReports.length} of {reports.length} Reports
        </span>
      </div>

      {/* Reports Table / Grid */}
      <div className="saas-panel">
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#8a8370" }}>Loading reports library...</div>
        ) : filteredReports.length === 0 ? (
          <div style={{ padding: "50px 20px", textAlign: "center" }}>
            <FileText size={40} color="#a49d89" style={{ margin: "0 auto 12px auto", opacity: 0.5 }} />
            <h3 style={{ margin: "0 0 6px 0", color: "#fff" }}>No reports found</h3>
            <p style={{ color: "#a49d89", fontSize: "13px", maxWidth: "420px", margin: "0 auto 16px auto" }}>
              {searchQuery ? `No reports matched "${searchQuery}".` : "Create your first multi-page BI report with Power BI visuals, filters, and slicers."}
            </p>
            <button className="saas-action-btn primary" onClick={() => setCreateModalOpen(true)} style={{ margin: "0 auto" }}>
              <Plus size={15} /> Create Report
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
                <th>Created</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map(rep => (
                <tr key={rep.id}>
                  <td style={{ fontWeight: "600", color: "#fff" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div className="saas-stat-icon" style={{ width: "32px", height: "32px" }}>
                        <FileText size={16} />
                      </div>
                      <div>
                        <div style={{ fontSize: "14px" }}>{rep.title}</div>
                        <small style={{ color: "#8a8370", fontWeight: "400" }}>{rep.description || "Executive BI Report"}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="saas-badge viewer">
                      {Array.isArray(rep.pages) ? `${rep.pages.length} Pages` : "1 Page"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="text-button"
                      style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}
                      onClick={() => {
                        setScheduleModalReport(rep);
                        setScheduleFreq(rep.schedule_frequency || "weekly");
                      }}
                    >
                      <Calendar size={13} />
                      <span>{rep.schedule_frequency && rep.schedule_frequency !== "none" ? rep.schedule_frequency.toUpperCase() : "Set Schedule"}</span>
                    </button>
                  </td>
                  <td>
                    <button
                      className="text-button"
                      style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}
                      onClick={() => {
                        setShareModalReport(rep);
                        setIsShared(Boolean(rep.is_shared));
                        setShareRole(rep.share_role || "Viewer");
                      }}
                    >
                      {rep.is_shared ? <Share2 size={13} color="#10b981" /> : <Lock size={13} color="#8a8370" />}
                      <span style={{ color: rep.is_shared ? "#10b981" : "#a49d89" }}>
                        {rep.is_shared ? `Shared (${rep.share_role || "Viewer"})` : "Private"}
                      </span>
                    </button>
                  </td>
                  <td style={{ color: "#8a8370", fontSize: "12px" }}>
                    {rep.created_at ? new Date(rep.created_at).toLocaleDateString() : "Active"}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                      <button
                        className="saas-action-btn primary"
                        style={{ padding: "4px 10px", fontSize: "12px" }}
                        onClick={() => onNavigate("visuals", { reportId: rep.id })}
                        title="Edit in Power BI Studio"
                      >
                        Design <ArrowRight size={13} />
                      </button>
                      <button
                        className="icon-action"
                        style={{ padding: "6px" }}
                        onClick={() => handleDuplicateReport(rep.id)}
                        title="Duplicate report"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        className="icon-action"
                        style={{ padding: "6px", color: "#f87171" }}
                        onClick={() => handleDeleteReport(rep.id, rep.title)}
                        title="Delete report"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Report Modal */}
      {createModalOpen && (
        <div className="saas-modal-backdrop" onClick={() => setCreateModalOpen(false)}>
          <div className="saas-modal" onClick={e => e.stopPropagation()}>
            <div className="saas-modal-header">
              <h3>Create Multi-Page Report</h3>
              <button className="text-button" onClick={() => setCreateModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateReport}>
              <div className="saas-modal-body">
                <div className="saas-form-group">
                  <label>Report Title *</label>
                  <input
                    type="text"
                    className="saas-input"
                    placeholder="e.g. Executive Q3 Financial Review"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="saas-form-group">
                  <label>Description</label>
                  <textarea
                    className="saas-textarea"
                    rows={2}
                    placeholder="Brief description of the report's purpose and audience..."
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                  />
                </div>
                <div className="saas-form-group">
                  <label>Automated Delivery Schedule</label>
                  <select
                    className="saas-select"
                    value={newSchedule}
                    onChange={e => setNewSchedule(e.target.value)}
                  >
                    <option value="none">No Automated Schedule</option>
                    <option value="daily">Daily Briefing (Every morning at 08:00 AM)</option>
                    <option value="weekly">Weekly Executive Digest (Every Monday)</option>
                    <option value="monthly">Monthly Board Review (1st of each month)</option>
                  </select>
                </div>
              </div>
              <div className="saas-modal-footer">
                <button type="button" className="saas-action-btn secondary" onClick={() => setCreateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="saas-action-btn primary" disabled={creating}>
                  {creating ? "Creating..." : "Launch in Studio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share Report Modal */}
      {shareModalReport && (
        <div className="saas-modal-backdrop" onClick={() => setShareModalReport(null)}>
          <div className="saas-modal" onClick={e => e.stopPropagation()}>
            <div className="saas-modal-header">
              <h3>Share Report: {shareModalReport.title}</h3>
              <button className="text-button" onClick={() => setShareModalReport(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveShare}>
              <div className="saas-modal-body">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", padding: "12px", background: "rgba(255,255,255,0.03)", borderRadius: "8px" }}>
                  <div>
                    <strong style={{ color: "#fff", display: "block" }}>Enable Public Access Link</strong>
                    <small style={{ color: "#a49d89" }}>Anyone with this secure link can view this report</small>
                  </div>
                  <label className="switch">
                    <input type="checkbox" checked={isShared} onChange={e => setIsShared(e.target.checked)} />
                    <span className="slider" />
                  </label>
                </div>

                {isShared && (
                  <>
                    <div className="saas-form-group">
                      <label>Access Permission Level</label>
                      <select
                        className="saas-select"
                        value={shareRole}
                        onChange={e => setShareRole(e.target.value)}
                      >
                        <option value="Viewer">Viewer (Read-only interactive slicers and filters)</option>
                        <option value="Editor">Editor (Can edit visuals and rearrange layout)</option>
                      </select>
                    </div>

                    <div className="saas-form-group">
                      <label>Shareable URL</label>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <input
                          type="text"
                          readOnly
                          className="saas-input"
                          value={`${window.location.origin}/report/${shareModalReport.id}`}
                        />
                        <button
                          type="button"
                          className="saas-action-btn secondary"
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/report/${shareModalReport.id}`);
                            setCopiedLink(true);
                            setTimeout(() => setCopiedLink(false), 2000);
                          }}
                        >
                          {copiedLink ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="saas-modal-footer">
                <button type="button" className="saas-action-btn secondary" onClick={() => setShareModalReport(null)}>
                  Cancel
                </button>
                <button type="submit" className="saas-action-btn primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Report Modal */}
      {scheduleModalReport && (
        <div className="saas-modal-backdrop" onClick={() => setScheduleModalReport(null)}>
          <div className="saas-modal" onClick={e => e.stopPropagation()}>
            <div className="saas-modal-header">
              <h3>Schedule Automated Delivery: {scheduleModalReport.title}</h3>
              <button className="text-button" onClick={() => setScheduleModalReport(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveSchedule}>
              <div className="saas-modal-body">
                <div className="saas-form-group">
                  <label>Delivery Frequency</label>
                  <select
                    className="saas-select"
                    value={scheduleFreq}
                    onChange={e => setScheduleFreq(e.target.value)}
                  >
                    <option value="none">Disabled</option>
                    <option value="daily">Daily at 08:00 AM</option>
                    <option value="weekly">Weekly on Mondays</option>
                    <option value="monthly">Monthly on 1st</option>
                  </select>
                </div>
                <div className="saas-form-group">
                  <label>Recipient Email Addresses (comma separated)</label>
                  <input
                    type="text"
                    className="saas-input"
                    placeholder="exec@company.com, cfo@company.com"
                    value={scheduleRecipients}
                    onChange={e => setScheduleRecipients(e.target.value)}
                  />
                </div>
                <p style={{ fontSize: "12px", color: "#a49d89", margin: "8px 0 0 0" }}>
                  Automated runs generate high-resolution PNG & PDF snapshots of the active dashboard pages with live dataset metrics.
                </p>
              </div>
              <div className="saas-modal-footer">
                <button type="button" className="saas-action-btn secondary" onClick={() => setScheduleModalReport(null)}>
                  Cancel
                </button>
                <button type="submit" className="saas-action-btn primary">
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
