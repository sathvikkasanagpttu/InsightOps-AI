import React, { useState, useEffect } from "react";
import {
  Database,
  Upload,
  FileSpreadsheet,
  Download,
  Trash2,
  Copy,
  Archive,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Sliders,
  Sparkles,
  ExternalLink,
  Edit2,
  Layers,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Check
} from "lucide-react";
import { api } from "../../lib/api";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const BUNDLED_SAMPLES = [
  { id: "sales", label: "Sales & Revenue", domain: "Sales" },
  { id: "hr", label: "HR & Workforce", domain: "HR" },
  { id: "finance", label: "Finance & Cash Flow", domain: "Finance" },
  { id: "ecommerce", label: "E-Commerce Orders", domain: "E-commerce" },
  { id: "healthcare", label: "Healthcare & Patients", domain: "Healthcare" },
  { id: "customer_operations", label: "Customer Operations", domain: "Operations" },
];

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function DataHubView({
  activeDatasetId = "demo-sales",
  onSelectDataset,
  onNavigate,
  onUploadClick,
  addToast
}) {
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all"); // "all" | "uploaded" | "sample" | "archived"
  const [actionLoading, setActionLoading] = useState(false);

  // Preview Modal
  const [previewDataset, setPreviewDataset] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Rename Modal
  const [renameModal, setRenameModal] = useState({ open: false, dataset: null, name: "" });

  // Delete Confirmation Modal
  const [deleteModal, setDeleteModal] = useState({ open: false, dataset: null });

  async function fetchDatasets() {
    setLoading(true);
    try {
      const data = await api("/api/datasets");
      setDatasets(Array.isArray(data) ? data : []);
    } catch (err) {
      addToast?.(`Failed to load datasets: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDatasets();
  }, []);

  async function handleLoadSample(sampleId) {
    setActionLoading(true);
    try {
      const res = await api(`/api/datasets/load-sample/${encodeURIComponent(sampleId)}`, {
        method: "POST"
      });
      addToast?.(`Loaded ${sampleId} dataset successfully!`, "success");
      await fetchDatasets();
      if (res.dataset_id) {
        onSelectDataset?.(res.dataset_id);
      }
    } catch (err) {
      addToast?.(`Could not load sample: ${err.message}`, "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDuplicate(dataset) {
    setActionLoading(true);
    try {
      const res = await api(`/api/datasets/${encodeURIComponent(dataset.dataset_id)}/duplicate`, {
        method: "POST"
      });
      addToast?.(`Duplicated "${dataset.name}" successfully!`, "success");
      await fetchDatasets();
      if (res.dataset_id) {
        onSelectDataset?.(res.dataset_id);
      }
    } catch (err) {
      addToast?.(`Failed to duplicate: ${err.message}`, "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleArchiveToggle(dataset) {
    const isCurrentlyArchived = dataset.status === "archived";
    setActionLoading(true);
    try {
      await api(`/api/datasets/${encodeURIComponent(dataset.dataset_id)}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !isCurrentlyArchived })
      });
      addToast?.(`Dataset ${isCurrentlyArchived ? "unarchived" : "archived"} successfully!`, "success");
      await fetchDatasets();
    } catch (err) {
      addToast?.(`Could not update archive status: ${err.message}`, "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReprocess(dataset) {
    setActionLoading(true);
    try {
      await api(`/api/datasets/${encodeURIComponent(dataset.dataset_id)}/reprocess`, {
        method: "POST"
      });
      addToast?.(`Reprocessed and re-indexed "${dataset.name}" successfully!`, "success");
      await fetchDatasets();
    } catch (err) {
      addToast?.(`Failed to reprocess dataset: ${err.message}`, "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRenameSubmit(e) {
    e.preventDefault();
    if (!renameModal.dataset || !renameModal.name.trim()) return;
    setActionLoading(true);
    try {
      await api(`/api/datasets/${encodeURIComponent(renameModal.dataset.dataset_id)}/rename`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameModal.name.trim() })
      });
      addToast?.(`Renamed to "${renameModal.name.trim()}"`, "success");
      setRenameModal({ open: false, dataset: null, name: "" });
      await fetchDatasets();
    } catch (err) {
      addToast?.(`Failed to rename: ${err.message}`, "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteModal.dataset) return;
    setActionLoading(true);
    try {
      await api(`/api/datasets/${encodeURIComponent(deleteModal.dataset.dataset_id)}`, {
        method: "DELETE"
      });
      addToast?.(`Deleted dataset "${deleteModal.dataset.name}"`, "success");
      setDeleteModal({ open: false, dataset: null });
      if (activeDatasetId === deleteModal.dataset.dataset_id) {
        onSelectDataset?.("demo-sales");
      }
      await fetchDatasets();
    } catch (err) {
      addToast?.(`Failed to delete: ${err.message}`, "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function openPreview(dataset) {
    setPreviewDataset(dataset);
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const res = await api(`/api/datasets/${encodeURIComponent(dataset.dataset_id)}/rows?page=1&page_size=25`);
      setPreviewData(res);
    } catch (err) {
      addToast?.(`Could not load preview: ${err.message}`, "error");
    } finally {
      setPreviewLoading(false);
    }
  }

  // Filter datasets
  const filteredDatasets = datasets.filter(ds => {
    const matchesSearch =
      (ds.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (ds.filename || "").toLowerCase().includes(search.toLowerCase()) ||
      (ds.dataset_type || "").toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === "uploaded") return !ds.is_demo && ds.status !== "archived";
    if (filterType === "sample") return ds.is_demo;
    if (filterType === "archived") return ds.status === "archived";
    return ds.status !== "archived" || filterType === "archived";
  });

  // Calculate summary statistics
  const totalDatasets = datasets.length;
  const totalRows = datasets.reduce((sum, d) => sum + (d.rows || 0), 0);
  const avgQuality = datasets.length
    ? Math.round(datasets.reduce((sum, d) => sum + (d.quality_score || 0), 0) / datasets.length)
    : 100;
  const totalStorage = datasets.reduce((sum, d) => sum + (d.file_size || 0), 0);

  return (
    <div className="data-hub-container saas-fade-in" style={{ padding: "1.5rem" }}>
      {/* Header and Hero Actions */}
      <div className="data-hub-header" style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "1rem",
        marginBottom: "1.5rem"
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase", color: "#e6c348" }}>
              ENTERPRISE DATA LAKE & HUB
            </span>
            <span className="saas-badge" style={{ background: "rgba(230, 195, 72, 0.15)", color: "#e6c348", fontSize: "11px" }}>
              {datasets.length} Active Stores
            </span>
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>
            Data Hub & Management
          </h1>
          <p style={{ fontSize: "13px", color: "#94a3b8", marginTop: "4px", marginBottom: 0 }}>
            Upload, inspect, clean, duplicate, version, and orchestrate datasets across your enterprise workspace.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {/* Sample dataset selector dropdown */}
          <div className="sample-picker" style={{ position: "relative" }}>
            <select
              className="enterprise-select"
              style={{
                background: "rgba(15, 23, 42, 0.7)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "#e2e8f0",
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "13px"
              }}
              onChange={e => {
                if (e.target.value) {
                  handleLoadSample(e.target.value);
                  e.target.value = "";
                }
              }}
              defaultValue=""
              disabled={actionLoading}
            >
              <option value="" disabled>Load Sample Dataset...</option>
              {BUNDLED_SAMPLES.map(s => (
                <option key={s.id} value={s.id}>{s.label} ({s.domain})</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="enterprise-btn primary"
            onClick={onUploadClick}
            disabled={actionLoading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              borderRadius: "8px",
              fontWeight: "600",
              cursor: "pointer"
            }}
          >
            <Upload size={16} /> Upload New Dataset
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="hub-stats-grid" style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "1rem",
        marginBottom: "1.5rem"
      }}>
        <div className="panel glass" style={{ padding: "14px 18px", borderRadius: "12px", background: "rgba(15, 23, 42, 0.6)" }}>
          <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>Total Datasets</div>
          <div style={{ fontSize: "22px", fontWeight: "700", color: "#f8fafc", marginTop: "4px" }}>{totalDatasets}</div>
          <div style={{ fontSize: "11px", color: "#e6c348", marginTop: "2px" }}>Across Workspace</div>
        </div>

        <div className="panel glass" style={{ padding: "14px 18px", borderRadius: "12px", background: "rgba(15, 23, 42, 0.6)" }}>
          <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>Total Rows Processed</div>
          <div style={{ fontSize: "22px", fontWeight: "700", color: "#38bdf8", marginTop: "4px" }}>{totalRows.toLocaleString()}</div>
          <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>Ready for Analysis</div>
        </div>

        <div className="panel glass" style={{ padding: "14px 18px", borderRadius: "12px", background: "rgba(15, 23, 42, 0.6)" }}>
          <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>Avg Data Quality</div>
          <div style={{ fontSize: "22px", fontWeight: "700", color: avgQuality >= 80 ? "#10b981" : "#f59e0b", marginTop: "4px" }}>
            {avgQuality}%
          </div>
          <div style={{ fontSize: "11px", color: "#10b981", marginTop: "2px" }}>Quality Checked</div>
        </div>

        <div className="panel glass" style={{ padding: "14px 18px", borderRadius: "12px", background: "rgba(15, 23, 42, 0.6)" }}>
          <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>Storage Utilized</div>
          <div style={{ fontSize: "22px", fontWeight: "700", color: "#a855f7", marginTop: "4px" }}>{formatBytes(totalStorage)}</div>
          <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>Parquet / In-Memory</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="hub-filter-bar panel glass" style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "1rem",
        padding: "12px 16px",
        borderRadius: "12px",
        marginBottom: "1.25rem",
        background: "rgba(15, 23, 42, 0.5)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: "1 1 250px" }}>
          <Search size={16} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search datasets by name, domain, format..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: "transparent",
              border: "none",
              color: "#f8fafc",
              fontSize: "13px",
              width: "100%",
              outline: "none"
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
            >
              ×
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: "6px" }}>
          {[
            { id: "all", label: "All Datasets" },
            { id: "uploaded", label: "Uploaded" },
            { id: "sample", label: "Bundled Demos" },
            { id: "archived", label: "Archived" }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              className={`saas-filter-chip ${filterType === tab.id ? "active" : ""}`}
              onClick={() => setFilterType(tab.id)}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: "500",
                background: filterType === tab.id ? "#e6c348" : "rgba(255,255,255,0.05)",
                color: filterType === tab.id ? "#000" : "#94a3b8",
                border: "none",
                cursor: "pointer"
              }}
            >
              {tab.label}
            </button>
          ))}
          <button
            type="button"
            className="icon-action"
            onClick={fetchDatasets}
            title="Refresh Dataset List"
            disabled={loading}
            style={{ padding: "6px", borderRadius: "6px" }}
          >
            <RefreshCw size={15} className={loading ? "spin-icon" : ""} />
          </button>
        </div>
      </div>

      {/* Dataset Grid / Table */}
      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>
          <RefreshCw size={24} className="spin-icon" style={{ margin: "0 auto 12px auto" }} />
          <div>Synchronizing Data Hub catalogs...</div>
        </div>
      ) : filteredDatasets.length === 0 ? (
        <div className="panel glass" style={{ padding: "48px 24px", textAlign: "center", borderRadius: "16px" }}>
          <Database size={40} color="#e6c348" style={{ margin: "0 auto 16px auto", opacity: 0.8 }} />
          <h3 style={{ fontSize: "18px", color: "#f8fafc", margin: "0 0 8px 0" }}>No datasets found</h3>
          <p style={{ fontSize: "13px", color: "#94a3b8", maxWidth: "400px", margin: "0 auto 20px auto" }}>
            {search ? "No datasets match your search query." : "Upload your first CSV/Excel file or choose one of our verified sample datasets."}
          </p>
          <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
            <button type="button" className="enterprise-btn primary" onClick={onUploadClick}>
              <Upload size={15} /> Upload Dataset
            </button>
            <button type="button" className="enterprise-btn secondary" onClick={() => handleLoadSample("sales")}>
              Load Sales Demo
            </button>
          </div>
        </div>
      ) : (
        <div className="dataset-table-wrapper" style={{ overflowX: "auto" }}>
          <table className="enterprise-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", textAlign: "left" }}>
                <th style={{ padding: "12px 14px", fontSize: "11px", fontWeight: "600", color: "#94a3b8" }}>DATASET</th>
                <th style={{ padding: "12px 14px", fontSize: "11px", fontWeight: "600", color: "#94a3b8" }}>TYPE</th>
                <th style={{ padding: "12px 14px", fontSize: "11px", fontWeight: "600", color: "#94a3b8" }}>ROWS × COLS</th>
                <th style={{ padding: "12px 14px", fontSize: "11px", fontWeight: "600", color: "#94a3b8" }}>SIZE</th>
                <th style={{ padding: "12px 14px", fontSize: "11px", fontWeight: "600", color: "#94a3b8" }}>QUALITY</th>
                <th style={{ padding: "12px 14px", fontSize: "11px", fontWeight: "600", color: "#94a3b8" }}>STATUS</th>
                <th style={{ padding: "12px 14px", fontSize: "11px", fontWeight: "600", color: "#94a3b8", textAlign: "right" }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredDatasets.map(ds => {
                const isActive = activeDatasetId === ds.dataset_id;
                const qScore = ds.quality_score ?? 100;
                const qualityColor = qScore >= 90 ? "#10b981" : qScore >= 70 ? "#f59e0b" : "#ef4444";

                return (
                  <tr
                    key={ds.dataset_id}
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                      background: isActive ? "rgba(230, 195, 72, 0.05)" : "transparent",
                      transition: "background 0.15s ease"
                    }}
                    className="hub-table-row"
                  >
                    {/* Dataset Name & Badges */}
                    <td style={{ padding: "14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "8px",
                          background: ds.file_type === "XLSX" || ds.file_type === "XLS" ? "rgba(16, 185, 129, 0.15)" : "rgba(230, 195, 72, 0.15)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: ds.file_type === "XLSX" || ds.file_type === "XLS" ? "#10b981" : "#e6c348",
                          flexShrink: 0
                        }}>
                          {ds.file_type === "XLSX" || ds.file_type === "XLS" ? <FileSpreadsheet size={18} /> : <Database size={18} />}
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <strong style={{ fontSize: "13px", color: "#f8fafc" }}>{ds.name}</strong>
                            {isActive && (
                              <span style={{
                                fontSize: "10px",
                                background: "rgba(230, 195, 72, 0.2)",
                                color: "#e6c348",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                fontWeight: "700"
                              }}>
                                ACTIVE
                              </span>
                            )}
                            {ds.is_demo && (
                              <span style={{
                                fontSize: "10px",
                                background: "rgba(56, 189, 248, 0.15)",
                                color: "#38bdf8",
                                padding: "2px 6px",
                                borderRadius: "4px"
                              }}>
                                Sample
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                            {ds.filename} • {ds.owner || "Workspace Member"}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Domain / Classification */}
                    <td style={{ padding: "14px", fontSize: "12px", color: "#cbd5e1" }}>
                      <span className="saas-badge" style={{ background: "rgba(255,255,255,0.06)", color: "#94a3b8" }}>
                        {ds.dataset_type || "Tabular"}
                      </span>
                    </td>

                    {/* Rows x Cols */}
                    <td style={{ padding: "14px", fontSize: "12px", color: "#cbd5e1" }}>
                      <span style={{ fontWeight: "600", color: "#f8fafc" }}>{ds.rows?.toLocaleString() || 0}</span> rows
                      <span style={{ color: "#64748b", margin: "0 4px" }}>×</span>
                      <span>{ds.columns || 0} cols</span>
                    </td>

                    {/* File Size */}
                    <td style={{ padding: "14px", fontSize: "12px", color: "#94a3b8" }}>
                      {formatBytes(ds.file_size)}
                    </td>

                    {/* Quality Score */}
                    <td style={{ padding: "14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{
                          display: "inline-block",
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: qualityColor
                        }} />
                        <span style={{ fontSize: "12px", fontWeight: "700", color: qualityColor }}>
                          {qScore}%
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: "14px" }}>
                      <span style={{
                        fontSize: "11px",
                        padding: "3px 8px",
                        borderRadius: "12px",
                        fontWeight: "600",
                        textTransform: "capitalize",
                        background: ds.status === "archived" ? "rgba(100, 116, 139, 0.2)" : "rgba(16, 185, 129, 0.15)",
                        color: ds.status === "archived" ? "#94a3b8" : "#10b981"
                      }}>
                        {ds.status || "Ready"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "14px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end", alignItems: "center" }}>
                        {/* Select as Active */}
                        {!isActive ? (
                          <button
                            type="button"
                            className="enterprise-btn secondary"
                            style={{ padding: "5px 10px", fontSize: "11px" }}
                            onClick={() => {
                              onSelectDataset?.(ds.dataset_id);
                              addToast?.(`Active dataset switched to "${ds.name}"`, "success");
                            }}
                            title="Set as Active Dataset"
                          >
                            Set Active
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="enterprise-btn primary"
                            style={{ padding: "5px 10px", fontSize: "11px" }}
                            onClick={() => onNavigate?.("overview")}
                            title="Go to Dashboard"
                          >
                            Analyze <ArrowRight size={12} />
                          </button>
                        )}

                        {/* Preview */}
                        <button
                          type="button"
                          className="icon-action"
                          onClick={() => openPreview(ds)}
                          title="Preview Data Records"
                        >
                          <Eye size={15} />
                        </button>

                        {/* Clean / Studio */}
                        <button
                          type="button"
                          className="icon-action"
                          onClick={() => {
                            onSelectDataset?.(ds.dataset_id);
                            onNavigate?.("data");
                          }}
                          title="Data Studio & Cleaning"
                        >
                          <Sliders size={15} />
                        </button>

                        {/* Download Clean CSV */}
                        <a
                          className="icon-action"
                          href={`${API_BASE}/api/dataset/export-clean?dataset_id=${encodeURIComponent(ds.dataset_id)}`}
                          title="Download Cleaned CSV"
                        >
                          <Download size={15} />
                        </a>

                        {/* Rename (for uploads) */}
                        {!ds.is_demo && (
                          <button
                            type="button"
                            className="icon-action"
                            onClick={() => setRenameModal({ open: true, dataset: ds, name: ds.name })}
                            title="Rename Dataset"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}

                        {/* Duplicate */}
                        <button
                          type="button"
                          className="icon-action"
                          onClick={() => handleDuplicate(ds)}
                          title="Duplicate Dataset"
                        >
                          <Copy size={14} />
                        </button>

                        {/* Reprocess */}
                        {!ds.is_demo && (
                          <button
                            type="button"
                            className="icon-action"
                            onClick={() => handleReprocess(ds)}
                            title="Reprocess from Raw File"
                          >
                            <RefreshCw size={14} />
                          </button>
                        )}

                        {/* Archive */}
                        {!ds.is_demo && (
                          <button
                            type="button"
                            className="icon-action"
                            onClick={() => handleArchiveToggle(ds)}
                            title={ds.status === "archived" ? "Unarchive Dataset" : "Archive Dataset"}
                          >
                            <Archive size={14} />
                          </button>
                        )}

                        {/* Delete */}
                        {!ds.is_demo && ds.dataset_id !== "demo-sales" && (
                          <button
                            type="button"
                            className="icon-action remove-dataset"
                            onClick={() => setDeleteModal({ open: true, dataset: ds })}
                            title="Delete Dataset"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {previewDataset && (
        <div className="enterprise-modal-overlay" style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "20px"
        }}>
          <div className="panel glass" style={{
            maxWidth: "960px",
            width: "100%",
            maxHeight: "85vh",
            display: "flex",
            flexDirection: "column",
            borderRadius: "16px",
            padding: "20px",
            background: "#0b121e",
            border: "1px solid rgba(255,255,255,0.12)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div>
                <span style={{ fontSize: "11px", color: "#e6c348", textTransform: "uppercase", fontWeight: "700" }}>
                  DATASET PREVIEW
                </span>
                <h3 style={{ fontSize: "18px", color: "#f8fafc", margin: "2px 0 0 0" }}>
                  {previewDataset.name}
                </h3>
              </div>
              <button
                type="button"
                className="icon-action"
                onClick={() => setPreviewDataset(null)}
                style={{ fontSize: "18px" }}
              >
                ×
              </button>
            </div>

            {previewLoading ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>
                <RefreshCw size={24} className="spin-icon" style={{ margin: "0 auto 12px auto" }} />
                <div>Reading sample records...</div>
              </div>
            ) : previewData ? (
              <div style={{ flex: 1, overflow: "auto" }}>
                <div style={{ marginBottom: "10px", fontSize: "12px", color: "#94a3b8" }}>
                  Showing first {previewData.rows?.length || 0} of {previewData.total?.toLocaleString() || 0} records
                </div>
                <table className="enterprise-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.04)", textAlign: "left" }}>
                      {previewData.columns?.map(col => (
                        <th key={col.name} style={{ padding: "8px 10px", color: "#e2e8f0", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                          <div>{col.name}</div>
                          <div style={{ fontSize: "10px", color: "#64748b", fontWeight: "normal" }}>{col.semantic_type}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.rows?.map((row, rIdx) => (
                      <tr key={rIdx} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                        {previewData.columns?.map(col => (
                          <td key={col.name} style={{ padding: "8px 10px", color: "#cbd5e1" }}>
                            {row[col.name] !== null && row[col.name] !== undefined ? String(row[col.name]) : <span style={{ color: "#64748b" }}>null</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: "20px", color: "#94a3b8" }}>No preview records available.</div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <button
                type="button"
                className="enterprise-btn secondary"
                onClick={() => setPreviewDataset(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="enterprise-btn primary"
                onClick={() => {
                  onSelectDataset?.(previewDataset.dataset_id);
                  onNavigate?.("data");
                  setPreviewDataset(null);
                }}
              >
                Open in Data Studio <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RENAME MODAL */}
      {renameModal.open && (
        <div className="enterprise-modal-overlay" style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "20px"
        }}>
          <form onSubmit={handleRenameSubmit} className="panel glass" style={{
            maxWidth: "420px",
            width: "100%",
            borderRadius: "16px",
            padding: "20px",
            background: "#0b121e",
            border: "1px solid rgba(255,255,255,0.12)"
          }}>
            <h3 style={{ fontSize: "16px", color: "#f8fafc", margin: "0 0 12px 0" }}>Rename Dataset</h3>
            <p style={{ fontSize: "12px", color: "#94a3b8", margin: "0 0 14px 0" }}>
              Give this dataset an identifiable name for reports, visual studio, and queries.
            </p>
            <input
              type="text"
              value={renameModal.name}
              onChange={e => setRenameModal(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Q4 Regional Performance.csv"
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "8px",
                color: "#f8fafc",
                fontSize: "13px",
                marginBottom: "16px",
                boxSizing: "border-box"
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                className="enterprise-btn secondary"
                onClick={() => setRenameModal({ open: false, dataset: null, name: "" })}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="enterprise-btn primary"
                disabled={actionLoading || !renameModal.name.trim()}
              >
                Save Name
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteModal.open && (
        <div className="enterprise-modal-overlay" style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "20px"
        }}>
          <div className="panel glass" style={{
            maxWidth: "420px",
            width: "100%",
            borderRadius: "16px",
            padding: "20px",
            background: "#0b121e",
            border: "1px solid rgba(239, 68, 68, 0.3)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <div style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.15)",
                color: "#ef4444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}>
                <Trash2 size={18} />
              </div>
              <h3 style={{ fontSize: "16px", color: "#f8fafc", margin: 0 }}>Delete Dataset?</h3>
            </div>
            <p style={{ fontSize: "13px", color: "#94a3b8", lineHeight: "1.5", margin: "0 0 16px 0" }}>
              Are you sure you want to permanently remove <strong>{deleteModal.dataset?.name}</strong>? This action cannot be undone.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                className="enterprise-btn secondary"
                onClick={() => setDeleteModal({ open: false, dataset: null })}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="enterprise-btn danger"
                onClick={handleDeleteConfirm}
                disabled={actionLoading}
                style={{ background: "#ef4444", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "8px", fontWeight: "600" }}
              >
                Delete Dataset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
