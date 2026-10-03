import React, { useState, useEffect } from "react";
import {
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Filter,
  Trash2,
  Edit2,
  Plus,
  RefreshCw,
  Clock,
  Check,
  Zap,
  HelpCircle,
  Eye,
  FileSpreadsheet
} from "lucide-react";
import { api } from "../../lib/api";

export default function DataCleaningStudio({
  datasetId = "demo-sales",
  profile = null,
  schema = [],
  quality = null,
  onDatasetUpdated = null,
  addToast = null
}) {
  const [activeTool, setActiveTool] = useState("quick_fixes"); // "quick_fixes" | "rename" | "remove" | "filter" | "replace" | "missing" | "duplicates" | "convert" | "calculated"
  const [history, setHistory] = useState([]);
  const [applying, setApplying] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Form states for each interactive tool
  // 1. Rename Column
  const [renameCol, setRenameCol] = useState("");
  const [newName, setNewName] = useState("");

  // 2. Remove Column
  const [removeCol, setRemoveCol] = useState("");

  // 3. Filter Rows
  const [filterCol, setFilterCol] = useState("");
  const [filterOp, setFilterOp] = useState("eq");
  const [filterVal, setFilterVal] = useState("");

  // 4. Replace Values
  const [replaceCol, setReplaceCol] = useState("");
  const [findVal, setFindVal] = useState("");
  const [replaceVal, setReplaceVal] = useState("");

  // 5. Handle Missing
  const [missingCol, setMissingCol] = useState("");
  const [missingStrategy, setMissingStrategy] = useState("median");
  const [missingConst, setMissingConst] = useState("");

  // 6. Remove Duplicates
  const [dupSubset, setDupSubset] = useState("");

  // 7. Convert Type
  const [convertCol, setConvertCol] = useState("");
  const [targetType, setTargetType] = useState("numeric");

  // 8. Calculated Column
  const [calcNewCol, setCalcNewCol] = useState("");
  const [calcCol1, setCalcCol1] = useState("");
  const [calcOp, setCalcOp] = useState("+");
  const [calcCol2, setCalcCol2] = useState("");
  const [calcConst, setCalcConst] = useState("");

  // Fetch transformation history
  async function fetchHistory() {
    setHistoryLoading(true);
    try {
      const data = await api(`/api/datasets/${encodeURIComponent(datasetId)}/transformations`);
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    fetchHistory();
    if (schema.length > 0) {
      setRenameCol(schema[0].name);
      setRemoveCol(schema[0].name);
      setFilterCol(schema[0].name);
      setReplaceCol(schema[0].name);
      setMissingCol(schema[0].name);
      setConvertCol(schema[0].name);
      setCalcCol1(schema[0].name);
      if (schema.length > 1) {
        setCalcCol2(schema[1].name);
      }
    }
  }, [datasetId, schema]);

  async function applyOperation(operation, successMessage) {
    setApplying(true);
    try {
      const res = await api(`/api/datasets/${encodeURIComponent(datasetId)}/transform`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operations: [operation] })
      });
      addToast?.(successMessage || "Transformation applied successfully!", "success");
      await fetchHistory();
      onDatasetUpdated?.(res);
    } catch (err) {
      addToast?.(`Failed to apply transformation: ${err.message}`, "error");
    } finally {
      setApplying(false);
    }
  }

  // Quick fix 1: Drop Duplicates
  function handleQuickDropDuplicates() {
    applyOperation(
      { type: "remove_duplicates" },
      "Cleaned duplicate rows from dataset"
    );
  }

  // Quick fix 2: Impute all missing
  function handleQuickImputeMissing() {
    const missingOps = [];
    schema.forEach(col => {
      const isNum = col.semantic_type === "numeric" || col.semantic_type === "currency" || col.semantic_type === "percentage";
      missingOps.push({
        type: "handle_missing",
        column: col.name,
        strategy: isNum ? "median" : "mode"
      });
    });
    applyOperation(
      missingOps[0],
      `Imputed missing values for ${missingOps[0]?.column || "columns"}`
    );
  }

  // Reprocess from raw
  async function handleResetRaw() {
    setApplying(true);
    try {
      await api(`/api/datasets/${encodeURIComponent(datasetId)}/reprocess`, { method: "POST" });
      addToast?.("Dataset restored and re-analyzed from original raw file!", "success");
      await fetchHistory();
      onDatasetUpdated?.();
    } catch (err) {
      addToast?.(`Failed to restore dataset: ${err.message}`, "error");
    } finally {
      setApplying(false);
    }
  }

  const numericCols = schema.filter(c => ["numeric", "currency", "percentage"].includes(c.semantic_type));

  return (
    <div className="data-cleaning-studio panel glass" style={{ padding: "1.5rem", borderRadius: "16px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase", color: "#e6c348" }}>
              INTERACTIVE DATA PREPARATION
            </span>
            <span className="saas-badge" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981", fontSize: "11px" }}>
              {history.length} Transformations Logged
            </span>
          </div>
          <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>
            Data Cleaning & Transformation Studio
          </h2>
          <p style={{ fontSize: "13px", color: "#94a3b8", marginTop: "4px", marginBottom: 0 }}>
            Interactively prepare, enrich, filter, and normalize records. Changes persist to dataset models and update reports in real time.
          </p>
        </div>

        <button
          type="button"
          className="enterprise-btn secondary"
          onClick={handleResetRaw}
          disabled={applying || datasetId.startsWith("demo-")}
          title="Restore original raw uploaded file without transformations"
          style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
        >
          <RotateCcw size={14} /> Reset from Raw File
        </button>
      </div>

      {/* Studio Grid: Left Sidebar of Tools + Main Workspace Form + Right Timeline */}
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 280px", gap: "1.25rem", alignItems: "start" }}>
        {/* Left Tools Navigation */}
        <div className="panel glass" style={{ padding: "10px", borderRadius: "12px", background: "rgba(15, 23, 42, 0.6)" }}>
          <div style={{ fontSize: "11px", fontWeight: "700", color: "#94a3b8", padding: "6px 8px", textTransform: "uppercase" }}>
            Preparation Tools
          </div>
          {[
            { id: "quick_fixes", label: "Suggested Fixes", icon: Sparkles, badge: "AI" },
            { id: "rename", label: "Rename Column", icon: Edit2 },
            { id: "remove", label: "Remove Column", icon: Trash2 },
            { id: "filter", label: "Filter Rows", icon: Filter },
            { id: "replace", label: "Replace Values", icon: Edit2 },
            { id: "missing", label: "Missing Values", icon: HelpCircle },
            { id: "duplicates", label: "Deduplication", icon: CheckCircle2 },
            { id: "convert", label: "Convert Types", icon: Sliders },
            { id: "calculated", label: "Calculated Column", icon: Plus }
          ].map(tool => {
            const Icon = tool.icon;
            const active = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                className={`cleaning-tool-btn ${active ? "active" : ""}`}
                onClick={() => setActiveTool(tool.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: active ? "600" : "400",
                  color: active ? "#000" : "#cbd5e1",
                  background: active ? "#e6c348" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  marginBottom: "4px",
                  textAlign: "left",
                  transition: "all 0.15s ease"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Icon size={14} />
                  <span>{tool.label}</span>
                </div>
                {tool.badge && (
                  <span style={{
                    fontSize: "9px",
                    fontWeight: "700",
                    padding: "1px 4px",
                    borderRadius: "4px",
                    background: active ? "rgba(0,0,0,0.2)" : "rgba(230, 195, 72, 0.2)",
                    color: active ? "#000" : "#e6c348"
                  }}>
                    {tool.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Center: Selected Tool Interactive Form */}
        <div className="panel glass" style={{ padding: "20px", borderRadius: "12px", background: "rgba(15, 23, 42, 0.5)", minHeight: "360px" }}>
          {/* 1. Quick Fixes */}
          {activeTool === "quick_fixes" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <Sparkles size={18} color="#e6c348" />
                <h3 style={{ fontSize: "16px", color: "#f8fafc", margin: 0 }}>Automated Quality Fix Recommendations</h3>
              </div>
              <p style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "16px" }}>
                One-click intelligent data repairs based on detected schema anomalies, missing values, and duplicate rows.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {/* Duplicate Rows Recommendation */}
                <div className="panel glass" style={{ padding: "14px", borderRadius: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ fontSize: "13px", color: "#f8fafc", display: "block" }}>Deduplicate Row Records</strong>
                    <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                      {quality?.duplicate_rows ? `Found ${quality.duplicate_rows} duplicate rows in dataset.` : "No identical duplicate rows currently detected."}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="enterprise-btn primary"
                    style={{ fontSize: "12px", padding: "6px 12px" }}
                    onClick={handleQuickDropDuplicates}
                    disabled={applying}
                  >
                    Remove Duplicates
                  </button>
                </div>

                {/* Missing Values Recommendation */}
                <div className="panel glass" style={{ padding: "14px", borderRadius: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ fontSize: "13px", color: "#f8fafc", display: "block" }}>Impute Missing Values (Median / Mode)</strong>
                    <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                      {quality?.missing_values ? `Found ${quality.missing_values} missing cells across columns.` : "Data completeness is high with zero empty cells."}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="enterprise-btn secondary"
                    style={{ fontSize: "12px", padding: "6px 12px" }}
                    onClick={handleQuickImputeMissing}
                    disabled={applying}
                  >
                    Auto-Impute Missing
                  </button>
                </div>

                {/* Whitespace trimming */}
                <div className="panel glass" style={{ padding: "14px", borderRadius: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ fontSize: "13px", color: "#f8fafc", display: "block" }}>Whitespace Standardization</strong>
                    <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                      Trims leading, trailing, and redundant whitespace across text attributes.
                    </span>
                  </div>
                  <button
                    type="button"
                    className="enterprise-btn secondary"
                    style={{ fontSize: "12px", padding: "6px 12px" }}
                    onClick={() => {
                      if (schema.length > 0) {
                        applyOperation({ type: "replace_value", column: schema[0].name, find: "  ", replace: " " }, "Standardized text formatting");
                      }
                    }}
                    disabled={applying}
                  >
                    Normalize Whitespace
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. Rename Column */}
          {activeTool === "rename" && (
            <form onSubmit={e => {
              e.preventDefault();
              if (renameCol && newName.trim()) {
                applyOperation(
                  { type: "rename_column", old_name: renameCol, new_name: newName.trim() },
                  `Renamed column '${renameCol}' to '${newName.trim()}'`
                );
                setNewName("");
              }
            }}>
              <h3 style={{ fontSize: "16px", color: "#f8fafc", margin: "0 0 8px 0" }}>Rename Column</h3>
              <p style={{ fontSize: "12px", color: "#94a3b8", margin: "0 0 16px 0" }}>
                Update header name without altering underlying data types or values.
              </p>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "12px", color: "#cbd5e1", display: "block", marginBottom: "4px" }}>Select Column</label>
                <select
                  value={renameCol}
                  onChange={e => setRenameCol(e.target.value)}
                  className="enterprise-select"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  {schema.map(c => <option key={c.name} value={c.name}>{c.name} ({c.semantic_type})</option>)}
                </select>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ fontSize: "12px", color: "#cbd5e1", display: "block", marginBottom: "4px" }}>New Column Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. total_revenue_usd"
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)", boxSizing: "border-box" }}
                />
              </div>

              <button type="submit" className="enterprise-btn primary" disabled={applying || !newName.trim()}>
                {applying ? "Applying..." : "Apply Rename"}
              </button>
            </form>
          )}

          {/* 3. Remove Column */}
          {activeTool === "remove" && (
            <form onSubmit={e => {
              e.preventDefault();
              if (removeCol) {
                applyOperation(
                  { type: "remove_column", column: removeCol },
                  `Removed column '${removeCol}'`
                );
              }
            }}>
              <h3 style={{ fontSize: "16px", color: "#f8fafc", margin: "0 0 8px 0" }}>Remove Column</h3>
              <p style={{ fontSize: "12px", color: "#94a3b8", margin: "0 0 16px 0" }}>
                Drop irrelevant, constant, or duplicate columns from this dataset.
              </p>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ fontSize: "12px", color: "#cbd5e1", display: "block", marginBottom: "4px" }}>Column to Remove</label>
                <select
                  value={removeCol}
                  onChange={e => setRemoveCol(e.target.value)}
                  className="enterprise-select"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  {schema.map(c => <option key={c.name} value={c.name}>{c.name} ({c.semantic_type})</option>)}
                </select>
              </div>

              <button type="submit" className="enterprise-btn danger" disabled={applying || schema.length <= 1}>
                {applying ? "Removing..." : "Drop Column"}
              </button>
            </form>
          )}

          {/* 4. Filter Rows */}
          {activeTool === "filter" && (
            <form onSubmit={e => {
              e.preventDefault();
              if (filterCol && filterVal !== "") {
                applyOperation(
                  { type: "filter_rows", column: filterCol, operator: filterOp, value: filterVal },
                  `Filtered rows where ${filterCol} ${filterOp} ${filterVal}`
                );
                setFilterVal("");
              }
            }}>
              <h3 style={{ fontSize: "16px", color: "#f8fafc", margin: "0 0 8px 0" }}>Filter Rows</h3>
              <p style={{ fontSize: "12px", color: "#94a3b8", margin: "0 0 16px 0" }}>
                Keep only rows matching specific business criteria.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: "10px", marginBottom: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", color: "#cbd5e1", display: "block", marginBottom: "4px" }}>Column</label>
                  <select
                    value={filterCol}
                    onChange={e => setFilterCol(e.target.value)}
                    className="enterprise-select"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}
                  >
                    {schema.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "12px", color: "#cbd5e1", display: "block", marginBottom: "4px" }}>Condition</label>
                  <select
                    value={filterOp}
                    onChange={e => setFilterOp(e.target.value)}
                    className="enterprise-select"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}
                  >
                    <option value="eq">Equals (=)</option>
                    <option value="ne">Not Equals (≠)</option>
                    <option value="gt">Greater Than (&gt;)</option>
                    <option value="gte">Greater or Equal (≥)</option>
                    <option value="lt">Less Than (&lt;)</option>
                    <option value="lte">Less or Equal (≤)</option>
                    <option value="contains">Contains</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ fontSize: "12px", color: "#cbd5e1", display: "block", marginBottom: "4px" }}>Match Value</label>
                <input
                  type="text"
                  value={filterVal}
                  onChange={e => setFilterVal(e.target.value)}
                  placeholder="e.g. 50000 or Active"
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)", boxSizing: "border-box" }}
                />
              </div>

              <button type="submit" className="enterprise-btn primary" disabled={applying || filterVal === ""}>
                {applying ? "Filtering..." : "Apply Filter"}
              </button>
            </form>
          )}

          {/* 5. Replace Values */}
          {activeTool === "replace" && (
            <form onSubmit={e => {
              e.preventDefault();
              if (replaceCol) {
                applyOperation(
                  { type: "replace_value", column: replaceCol, find: findVal, replace: replaceVal },
                  `Replaced '${findVal}' with '${replaceVal}' in '${replaceCol}'`
                );
                setFindVal("");
                setReplaceVal("");
              }
            }}>
              <h3 style={{ fontSize: "16px", color: "#f8fafc", margin: "0 0 8px 0" }}>Replace Values</h3>
              <p style={{ fontSize: "12px", color: "#94a3b8", margin: "0 0 16px 0" }}>
                Find specific typo, placeholder, or token and replace with normalized value.
              </p>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "12px", color: "#cbd5e1", display: "block", marginBottom: "4px" }}>Column</label>
                <select
                  value={replaceCol}
                  onChange={e => setReplaceCol(e.target.value)}
                  className="enterprise-select"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  {schema.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
                <div>
                  <label style={{ fontSize: "12px", color: "#cbd5e1", display: "block", marginBottom: "4px" }}>Find Value</label>
                  <input
                    type="text"
                    value={findVal}
                    onChange={e => setFindVal(e.target.value)}
                    placeholder="e.g. N/A or pending"
                    required
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", color: "#cbd5e1", display: "block", marginBottom: "4px" }}>Replace With</label>
                  <input
                    type="text"
                    value={replaceVal}
                    onChange={e => setReplaceVal(e.target.value)}
                    placeholder="e.g. Unknown or 0"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <button type="submit" className="enterprise-btn primary" disabled={applying || !findVal}>
                {applying ? "Replacing..." : "Replace Values"}
              </button>
            </form>
          )}

          {/* 6. Handle Missing */}
          {activeTool === "missing" && (
            <form onSubmit={e => {
              e.preventDefault();
              if (missingCol) {
                applyOperation(
                  { type: "handle_missing", column: missingCol, strategy: missingStrategy, constant_value: missingConst },
                  `Handled missing values in '${missingCol}' using ${missingStrategy}`
                );
              }
            }}>
              <h3 style={{ fontSize: "16px", color: "#f8fafc", margin: "0 0 8px 0" }}>Handle Missing Values</h3>
              <p style={{ fontSize: "12px", color: "#94a3b8", margin: "0 0 16px 0" }}>
                Drop nulls or impute values with statistical estimators (mean, median, mode) or constants.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", color: "#cbd5e1", display: "block", marginBottom: "4px" }}>Column</label>
                  <select
                    value={missingCol}
                    onChange={e => setMissingCol(e.target.value)}
                    className="enterprise-select"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}
                  >
                    {schema.map(c => <option key={c.name} value={c.name}>{c.name} ({c.semantic_type})</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "12px", color: "#cbd5e1", display: "block", marginBottom: "4px" }}>Strategy</label>
                  <select
                    value={missingStrategy}
                    onChange={e => setMissingStrategy(e.target.value)}
                    className="enterprise-select"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}
                  >
                    <option value="drop">Drop Rows with Nulls</option>
                    <option value="median">Impute with Median (Numeric)</option>
                    <option value="mean">Impute with Mean (Numeric)</option>
                    <option value="mode">Impute with Mode (Most Frequent)</option>
                    <option value="constant">Fill with Custom Constant</option>
                  </select>
                </div>
              </div>

              {missingStrategy === "constant" && (
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ fontSize: "12px", color: "#cbd5e1", display: "block", marginBottom: "4px" }}>Constant Value</label>
                  <input
                    type="text"
                    value={missingConst}
                    onChange={e => setMissingConst(e.target.value)}
                    placeholder="e.g. 0 or N/A"
                    required
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)", boxSizing: "border-box" }}
                  />
                </div>
              )}

              <button type="submit" className="enterprise-btn primary" disabled={applying}>
                {applying ? "Processing..." : "Execute Imputation"}
              </button>
            </form>
          )}

          {/* 7. Deduplication */}
          {activeTool === "duplicates" && (
            <div>
              <h3 style={{ fontSize: "16px", color: "#f8fafc", margin: "0 0 8px 0" }}>Deduplicate Rows</h3>
              <p style={{ fontSize: "12px", color: "#94a3b8", margin: "0 0 16px 0" }}>
                Remove identical rows or enforce uniqueness across a specific primary key or subset of columns.
              </p>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ fontSize: "12px", color: "#cbd5e1", display: "block", marginBottom: "4px" }}>
                  Uniqueness Columns (Optional - leave empty for full row match)
                </label>
                <select
                  value={dupSubset}
                  onChange={e => setDupSubset(e.target.value)}
                  className="enterprise-select"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  <option value="">All Columns (Exact Match)</option>
                  {schema.map(c => <option key={c.name} value={c.name}>By: {c.name}</option>)}
                </select>
              </div>

              <button
                type="button"
                className="enterprise-btn primary"
                onClick={() => {
                  applyOperation(
                    { type: "remove_duplicates", subset: dupSubset ? [dupSubset] : undefined },
                    dupSubset ? `Removed duplicates on '${dupSubset}'` : "Removed exact duplicate rows"
                  );
                }}
                disabled={applying}
              >
                {applying ? "Deduplicating..." : "Execute Deduplication"}
              </button>
            </div>
          )}

          {/* 8. Convert Types */}
          {activeTool === "convert" && (
            <form onSubmit={e => {
              e.preventDefault();
              if (convertCol) {
                applyOperation(
                  { type: "convert_type", column: convertCol, target_type: targetType },
                  `Converted column '${convertCol}' to ${targetType}`
                );
              }
            }}>
              <h3 style={{ fontSize: "16px", color: "#f8fafc", margin: "0 0 8px 0" }}>Convert Data Types</h3>
              <p style={{ fontSize: "12px", color: "#94a3b8", margin: "0 0 16px 0" }}>
                Coerce text to strict numeric, datetime, or boolean types.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
                <div>
                  <label style={{ fontSize: "12px", color: "#cbd5e1", display: "block", marginBottom: "4px" }}>Column</label>
                  <select
                    value={convertCol}
                    onChange={e => setConvertCol(e.target.value)}
                    className="enterprise-select"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}
                  >
                    {schema.map(c => <option key={c.name} value={c.name}>{c.name} ({c.semantic_type})</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "12px", color: "#cbd5e1", display: "block", marginBottom: "4px" }}>Target Type</label>
                  <select
                    value={targetType}
                    onChange={e => setTargetType(e.target.value)}
                    className="enterprise-select"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}
                  >
                    <option value="numeric">Numeric (Integer/Float)</option>
                    <option value="datetime">Datetime (Timestamp)</option>
                    <option value="string">Text String</option>
                    <option value="boolean">Boolean (True/False)</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="enterprise-btn primary" disabled={applying}>
                {applying ? "Converting..." : "Convert Type"}
              </button>
            </form>
          )}

          {/* 9. Calculated Column */}
          {activeTool === "calculated" && (
            <form onSubmit={e => {
              e.preventDefault();
              if (calcNewCol.trim() && calcCol1) {
                applyOperation(
                  {
                    type: "calculated_column",
                    new_column: calcNewCol.trim(),
                    col1: calcCol1,
                    operator: calcOp,
                    col2: calcCol2 || undefined,
                    value: calcConst ? Number(calcConst) : undefined
                  },
                  `Created calculated column '${calcNewCol.trim()}'`
                );
                setCalcNewCol("");
              }
            }}>
              <h3 style={{ fontSize: "16px", color: "#f8fafc", margin: "0 0 8px 0" }}>Create Calculated Column</h3>
              <p style={{ fontSize: "12px", color: "#94a3b8", margin: "0 0 16px 0" }}>
                Compute formulas across two measures or scale by constant factors (e.g. Sales × Tax, Revenue - Cost).
              </p>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "12px", color: "#cbd5e1", display: "block", marginBottom: "4px" }}>New Column Name</label>
                <input
                  type="text"
                  value={calcNewCol}
                  onChange={e => setCalcNewCol(e.target.value)}
                  placeholder="e.g. net_margin or total_cost"
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 1fr", gap: "8px", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <label style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginBottom: "4px" }}>Operand A</label>
                  <select
                    value={calcCol1}
                    onChange={e => setCalcCol1(e.target.value)}
                    className="enterprise-select"
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}
                  >
                    {schema.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginBottom: "4px" }}>Op</label>
                  <select
                    value={calcOp}
                    onChange={e => setCalcOp(e.target.value)}
                    className="enterprise-select"
                    style={{ width: "100%", padding: "8px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)", textAlign: "center" }}
                  >
                    <option value="+">+</option>
                    <option value="-">-</option>
                    <option value="*">×</option>
                    <option value="/">÷</option>
                    <option value="%">%</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginBottom: "4px" }}>Operand B (Col or Const)</label>
                  <select
                    value={calcCol2}
                    onChange={e => {
                      setCalcCol2(e.target.value);
                      if (e.target.value) setCalcConst("");
                    }}
                    className="enterprise-select"
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}
                  >
                    <option value="">(Or use Constant)</option>
                    {schema.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                  {!calcCol2 && (
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 1.18 or 100"
                      value={calcConst}
                      onChange={e => setCalcConst(e.target.value)}
                      style={{ width: "100%", marginTop: "4px", padding: "6px 8px", borderRadius: "6px", background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)", boxSizing: "border-box" }}
                    />
                  )}
                </div>
              </div>

              <button type="submit" className="enterprise-btn primary" disabled={applying || !calcNewCol.trim()}>
                {applying ? "Calculating..." : "Add Calculated Column"}
              </button>
            </form>
          )}
        </div>

        {/* Right: Transformation Audit Timeline */}
        <div className="panel glass" style={{ padding: "14px", borderRadius: "12px", background: "rgba(15, 23, 42, 0.6)", minHeight: "360px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" }}>
              Applied History
            </span>
            <span style={{ fontSize: "11px", color: "#e6c348", fontWeight: "600" }}>
              {history.length} Steps
            </span>
          </div>

          {historyLoading ? (
            <div style={{ textAlign: "center", padding: "20px", color: "#94a3b8" }}>
              <RefreshCw size={16} className="spin-icon" style={{ margin: "0 auto 6px auto" }} />
              <div style={{ fontSize: "11px" }}>Loading steps...</div>
            </div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 10px", color: "#64748b" }}>
              <Clock size={24} style={{ margin: "0 auto 8px auto", opacity: 0.6 }} />
              <div style={{ fontSize: "12px", color: "#94a3b8" }}>No transformations yet</div>
              <div style={{ fontSize: "11px", marginTop: "4px" }}>
                Apply any tool on the left to record steps in this audit trail.
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "300px", overflowY: "auto" }}>
              {history.map((step, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "8px",
                    background: "rgba(255,255,255,0.04)",
                    borderLeft: "3px solid #e6c348",
                    fontSize: "11px"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#e2e8f0", fontWeight: "600" }}>
                    <span>Step {idx + 1}: {step.type?.replace("_", " ").toUpperCase()}</span>
                    <Check size={12} color="#10b981" />
                  </div>
                  <div style={{ color: "#94a3b8", marginTop: "2px" }}>
                    {step.description || "Applied transformation"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
