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
  FileSpreadsheet,
  ShieldCheck,
  Activity,
  Undo2,
  Redo2,
  Play,
  Save,
  Layers,
  ListOrdered,
  X
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
  const [activeTool, setActiveTool] = useState("deep_quality"); // "deep_quality" | "quick_fixes" | "rename" | "remove" | "filter" | "replace" | "missing" | "duplicates" | "convert" | "calculated"
  const [history, setHistory] = useState([]);
  const [applying, setApplying] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [deepQuality, setDeepQuality] = useState(null);
  const [deepQualityLoading, setDeepQualityLoading] = useState(false);

  // Fetch deep quality and drift analysis
  useEffect(() => {
    async function loadDeepQuality() {
      setDeepQualityLoading(true);
      try {
        const res = await api(`/api/quality/deep-analysis?dataset_id=${encodeURIComponent(datasetId)}`);
        setDeepQuality(res);
      } catch (err) {
        console.warn("Error fetching deep quality analysis:", err);
      } finally {
        setDeepQualityLoading(false);
      }
    }
    loadDeepQuality();
  }, [datasetId]);

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

  // Pipeline Studio State & Undo/Redo Stacks
  const [pipelineSteps, setPipelineSteps] = useState([]);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [newRecipeName, setNewRecipeName] = useState("");
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [executingPipeline, setExecutingPipeline] = useState(false);

  // New step builder in pipeline
  const [stepType, setStepType] = useState("filter_rows");
  const [stepCol, setStepCol] = useState("");
  const [stepParam1, setStepParam1] = useState("");
  const [stepParam2, setStepParam2] = useState("");

  async function loadRecipes() {
    try {
      const data = await api("/api/datasets/recipes");
      setSavedRecipes(Array.isArray(data) ? data : []);
    } catch {
      setSavedRecipes([]);
    }
  }

  useEffect(() => {
    loadRecipes();
  }, []);

  function pushPipelineStep(newStep) {
    setUndoStack(prev => [...prev, pipelineSteps]);
    setRedoStack([]);
    setPipelineSteps(prev => [...prev, newStep]);
  }

  function handleUndo() {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, pipelineSteps]);
    setPipelineSteps(previous);
  }

  function handleRedo() {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, pipelineSteps]);
    setPipelineSteps(next);
  }

  function handleRemoveStep(index) {
    setUndoStack(prev => [...prev, pipelineSteps]);
    setRedoStack([]);
    setPipelineSteps(prev => prev.filter((_, i) => i !== index));
  }

  async function handleExecutePipeline() {
    if (pipelineSteps.length === 0) {
      addToast?.("Add at least one transformation step to the pipeline.", "error");
      return;
    }
    setExecutingPipeline(true);
    try {
      const res = await api(`/api/datasets/${encodeURIComponent(datasetId)}/transform`, {
        method: "POST",
        body: JSON.stringify({ operations: pipelineSteps })
      });
      addToast?.(`Pipeline executed! ${res.actions?.length || pipelineSteps.length} operations applied.`, "success");
      onDatasetUpdated?.();
      fetchHistory();
    } catch (err) {
      addToast?.(err.message || "Failed to execute transformation pipeline", "error");
    } finally {
      setExecutingPipeline(false);
    }
  }

  async function handleSaveRecipe(e) {
    e?.preventDefault();
    if (!newRecipeName.trim() || pipelineSteps.length === 0) return;
    setSavingRecipe(true);
    try {
      await api("/api/datasets/recipes", {
        method: "POST",
        body: JSON.stringify({
          name: newRecipeName.trim(),
          description: `Reusable pipeline with ${pipelineSteps.length} operations`,
          operations: pipelineSteps
        })
      });
      addToast?.(`Recipe "${newRecipeName}" saved successfully!`, "success");
      setNewRecipeName("");
      loadRecipes();
    } catch (err) {
      addToast?.(err.message || "Failed to save recipe", "error");
    } finally {
      setSavingRecipe(false);
    }
  }

  function handleLoadRecipe(recipeId) {
    const r = savedRecipes.find(x => x.id === recipeId);
    if (!r) return;
    setUndoStack(prev => [...prev, pipelineSteps]);
    setRedoStack([]);
    setPipelineSteps(r.operations || []);
    addToast?.(`Loaded ${r.operations?.length || 0} steps from "${r.name}"`, "success");
  }

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
            { id: "deep_quality", label: "Quality & Drift Radar", icon: ShieldCheck, badge: "RADAR" },
            { id: "pipeline", label: "Transformation Pipeline", icon: Layers, badge: "RECIPE" },
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
          {/* 0. Deep Quality & Drift Radar */}
          {activeTool === "deep_quality" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <ShieldCheck size={20} color="#10b981" />
                  <h3 style={{ fontSize: "16px", color: "#f8fafc", margin: 0 }}>Deep Quality Scorecard & Drift Radar</h3>
                </div>
                {deepQuality && (
                  <span className={`saas-badge ${deepQuality.quality_tier === "Excellent" ? "admin" : "viewer"}`}>
                    Tier: {deepQuality.quality_tier} ({deepQuality.overall_score}%)
                  </span>
                )}
              </div>

              {deepQualityLoading ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>
                  <RefreshCw size={24} className="spin-fast" style={{ margin: "0 auto 12px auto" }} />
                  <p>Computing statistical multi-dimensional quality index and drift telemetry...</p>
                </div>
              ) : deepQuality ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  {/* 5-Dimension Radar Scorecard */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                    gap: "10px"
                  }}>
                    {Object.entries(deepQuality.dimensions || {}).map(([dim, score]) => (
                      <div key={dim} className="panel glass" style={{ padding: "12px", borderRadius: "8px", textAlign: "center" }}>
                        <span style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "600" }}>{dim}</span>
                        <div style={{ fontSize: "20px", fontWeight: "700", color: score >= 90 ? "#10b981" : score >= 75 ? "#e6c348" : "#f43f5e", margin: "4px 0" }}>
                          {score}%
                        </div>
                        <div style={{ height: "4px", width: "100%", background: "rgba(255,255,255,0.08)", borderRadius: "2px", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${score}%`, background: score >= 90 ? "#10b981" : score >= 75 ? "#e6c348" : "#f43f5e" }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Feature Distribution Drift Section */}
                  <div className="panel glass" style={{ padding: "16px", borderRadius: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <strong style={{ fontSize: "13px", color: "#f8fafc" }}>Feature Distribution Drift Detection</strong>
                      <span style={{ fontSize: "11px", color: deepQuality.drift_detected ? "#fbbf24" : "#10b981" }}>
                        {deepQuality.drift_detected ? "Distribution Shifts Detected" : "Stable Across Segments"}
                      </span>
                    </div>

                    {deepQuality.drift_detection && deepQuality.drift_detection.length > 0 ? (
                      <div className="table-responsive-wrapper">
                        <table className="saas-table modern-table" style={{ fontSize: "12px" }}>
                          <thead>
                            <tr>
                              <th>Feature</th>
                              <th>Baseline Mean</th>
                              <th>Recent Mean</th>
                              <th>Shift %</th>
                              <th>Variance Ratio</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {deepQuality.drift_detection.map((d, i) => (
                              <tr key={i}>
                                <td><b>{d.column}</b></td>
                                <td>{Number(d.baseline_mean).toLocaleString()}</td>
                                <td>{Number(d.recent_mean).toLocaleString()}</td>
                                <td>{d.mean_shift_pct}%</td>
                                <td>{d.variance_ratio}x</td>
                                <td>
                                  <span className={`saas-badge ${d.status === "Stable" ? "viewer" : "admin"}`}>
                                    {d.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p style={{ fontSize: "12px", color: "#94a3b8" }}>No significant drift detected across dataset feature distribution.</p>
                    )}
                  </div>

                  {/* Actionable Quality Recommendations */}
                  {deepQuality.recommendations && deepQuality.recommendations.length > 0 && (
                    <div>
                      <strong style={{ fontSize: "13px", color: "#f8fafc", display: "block", marginBottom: "8px" }}>
                        Actionable Quality Remediation
                      </strong>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {deepQuality.recommendations.map((rec, i) => (
                          <div
                            key={i}
                            className="panel glass"
                            style={{
                              padding: "12px 14px",
                              borderRadius: "8px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              borderLeft: "3px solid #e6c348"
                            }}
                          >
                            <div>
                              <span style={{ fontSize: "13px", color: "#f8fafc", fontWeight: "500", display: "block" }}>{rec.action}</span>
                              <small style={{ color: "#34d399", fontSize: "11px" }}>{rec.impact}</small>
                            </div>
                            {rec.pipeline_operation !== "none" && (
                              <button
                                type="button"
                                className="enterprise-btn secondary"
                                style={{ fontSize: "11px", padding: "4px 10px" }}
                                onClick={() => setActiveTool(rec.pipeline_operation === "remove_duplicates" ? "duplicates" : "missing")}
                              >
                                Fix in Tool →
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ color: "#94a3b8" }}>No deep quality analysis available.</p>
              )}
            </div>
          )}

          {/* Transformation Pipeline Studio */}
          {activeTool === "pipeline" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Layers size={20} color="#e6c348" />
                  <h3 style={{ fontSize: "16px", color: "#f8fafc", margin: 0 }}>Visual Transformation Pipeline Studio</h3>
                </div>

                {/* Toolbar: Undo, Redo, Clear, Execute */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button
                    type="button"
                    className="enterprise-btn secondary"
                    onClick={handleUndo}
                    disabled={undoStack.length === 0}
                    title="Undo last step change"
                    style={{ padding: "5px 10px", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}
                  >
                    <Undo2 size={13} /> Undo
                  </button>
                  <button
                    type="button"
                    className="enterprise-btn secondary"
                    onClick={handleRedo}
                    disabled={redoStack.length === 0}
                    title="Redo step change"
                    style={{ padding: "5px 10px", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}
                  >
                    <Redo2 size={13} /> Redo
                  </button>
                  <button
                    type="button"
                    className="enterprise-btn secondary"
                    onClick={() => {
                      setUndoStack(prev => [...prev, pipelineSteps]);
                      setRedoStack([]);
                      setPipelineSteps([]);
                    }}
                    disabled={pipelineSteps.length === 0}
                    title="Clear all staged steps"
                    style={{ padding: "5px 10px", fontSize: "12px", color: "#f87171" }}
                  >
                    <Trash2 size={13} /> Clear
                  </button>
                  <button
                    type="button"
                    className="enterprise-btn primary"
                    onClick={handleExecutePipeline}
                    disabled={executingPipeline || pipelineSteps.length === 0}
                    style={{ padding: "5px 14px", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    {executingPipeline ? (
                      <>
                        <RefreshCw size={13} className="spin-fast" /> Executing Pipeline...
                      </>
                    ) : (
                      <>
                        <Play size={13} fill="currentColor" /> Apply Pipeline ({pipelineSteps.length})
                      </>
                    )}
                  </button>
                </div>
              </div>

              <p style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "16px" }}>
                Construct multi-step data preparation pipelines with interactive preview, step-by-step undo/redo, and reusable recipe templates.
              </p>

              {/* Recipe Preset Loader & Saver */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                padding: "10px 14px",
                background: "rgba(255,255,255,0.03)",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.08)",
                marginBottom: "18px"
              }}>
                {/* Load Recipe */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "12px", color: "#cbd5e1" }}>Pre-built Recipes:</span>
                  <select
                    className="saas-select"
                    style={{ fontSize: "12px", padding: "4px 8px", minWidth: "180px" }}
                    value={selectedRecipeId}
                    onChange={e => {
                      setSelectedRecipeId(e.target.value);
                      if (e.target.value) handleLoadRecipe(e.target.value);
                    }}
                  >
                    <option value="">Load saved recipe...</option>
                    {savedRecipes.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.operations?.length || 0} steps)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Save Current Pipeline as Recipe */}
                <form onSubmit={handleSaveRecipe} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="text"
                    className="saas-input"
                    placeholder="Recipe name (e.g. Sales Sanitization)"
                    value={newRecipeName}
                    onChange={e => setNewRecipeName(e.target.value)}
                    style={{ fontSize: "12px", padding: "4px 8px", width: "220px" }}
                    required
                  />
                  <button
                    type="submit"
                    className="enterprise-btn secondary"
                    disabled={savingRecipe || !newRecipeName.trim() || pipelineSteps.length === 0}
                    style={{ fontSize: "12px", padding: "4px 10px", display: "flex", alignItems: "center", gap: "4px" }}
                  >
                    <Save size={13} /> Save Recipe
                  </button>
                </form>
              </div>

              {/* Staged Pipeline Steps List */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "12px", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
                  Staged Pipeline Steps ({pipelineSteps.length})
                </div>

                {pipelineSteps.length === 0 ? (
                  <div style={{
                    padding: "24px",
                    textAlign: "center",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px dashed rgba(255,255,255,0.12)",
                    borderRadius: "8px",
                    color: "#94a3b8",
                    fontSize: "13px"
                  }}>
                    No transformation steps staged yet. Add an operation below or load a recipe to build your transformation pipeline.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {pipelineSteps.map((step, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "10px 14px",
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: "6px"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{
                            width: "22px",
                            height: "22px",
                            borderRadius: "50%",
                            background: "#e6c348",
                            color: "#000",
                            fontSize: "11px",
                            fontWeight: "700",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}>
                            {idx + 1}
                          </span>
                          <span className="saas-badge primary" style={{ textTransform: "uppercase", fontSize: "10.5px" }}>
                            {step.type?.replace("_", " ")}
                          </span>
                          <span style={{ fontSize: "13px", color: "#f8fafc" }}>
                            {step.type === "filter_rows" && `Filter '${step.column}' ${step.operator} '${step.value}'`}
                            {step.type === "handle_missing" && `Impute '${step.column}' using strategy: ${step.strategy} ${step.strategy === "constant" ? `('${step.constant_value}')` : ""}`}
                            {step.type === "rename_column" && `Rename '${step.old_name}' → '${step.new_name}'`}
                            {step.type === "remove_column" && `Drop column '${step.column}'`}
                            {step.type === "replace_value" && `Replace '${step.find}' with '${step.replace}' in '${step.column}'`}
                            {step.type === "convert_type" && `Cast '${step.column}' to ${step.target_type}`}
                            {step.type === "remove_duplicates" && `Remove duplicate records across dataset`}
                            {step.type === "calculated_column" && `Calculate new column '${step.new_column}'`}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="icon-action"
                          onClick={() => handleRemoveStep(idx)}
                          title="Remove this step"
                          style={{ color: "#94a3b8", padding: "4px" }}
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add New Step Form Box */}
              <div style={{
                padding: "16px",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "10px"
              }}>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "#f8fafc", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Plus size={15} color="#e6c348" /> Add Transformation Step to Pipeline
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 1fr", gap: "10px", alignItems: "end", marginBottom: "12px" }}>
                  <div className="saas-form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: "11px" }}>Operation</label>
                    <select
                      className="saas-select"
                      style={{ fontSize: "12px" }}
                      value={stepType}
                      onChange={e => setStepType(e.target.value)}
                    >
                      <option value="filter_rows">Filter Rows</option>
                      <option value="handle_missing">Handle Missing Values</option>
                      <option value="rename_column">Rename Column</option>
                      <option value="replace_value">Replace Values</option>
                      <option value="remove_column">Remove Column</option>
                      <option value="convert_type">Convert Type</option>
                      <option value="remove_duplicates">Remove Duplicates</option>
                    </select>
                  </div>

                  <div className="saas-form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: "11px" }}>Target Column</label>
                    <select
                      className="saas-select"
                      style={{ fontSize: "12px" }}
                      value={stepCol || (schema[0]?.name || "")}
                      onChange={e => setStepCol(e.target.value)}
                    >
                      {schema.map(c => (
                        <option key={c.name} value={c.name}>{c.name} ({c.semantic_type || c.inferred_type})</option>
                      ))}
                    </select>
                  </div>

                  {/* Dynamic Parameter 1 */}
                  {stepType === "filter_rows" && (
                    <div className="saas-form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: "11px" }}>Filter Condition & Value</label>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <select
                          className="saas-select"
                          style={{ width: "90px", fontSize: "12px" }}
                          value={stepParam1 || "gt"}
                          onChange={e => setStepParam1(e.target.value)}
                        >
                          <option value="gt">&gt; Greater</option>
                          <option value="lt">&lt; Less</option>
                          <option value="eq">== Equal</option>
                          <option value="contains">Contains</option>
                        </select>
                        <input
                          type="text"
                          className="saas-input"
                          style={{ fontSize: "12px" }}
                          placeholder="Value..."
                          value={stepParam2}
                          onChange={e => setStepParam2(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {stepType === "handle_missing" && (
                    <div className="saas-form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: "11px" }}>Imputation Strategy</label>
                      <select
                        className="saas-select"
                        style={{ fontSize: "12px" }}
                        value={stepParam1 || "median"}
                        onChange={e => setStepParam1(e.target.value)}
                      >
                        <option value="median">Median Value</option>
                        <option value="mean">Mean Value</option>
                        <option value="mode">Most Frequent (Mode)</option>
                        <option value="constant">Custom Constant</option>
                        <option value="drop">Drop Null Rows</option>
                      </select>
                    </div>
                  )}

                  {stepType === "rename_column" && (
                    <div className="saas-form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: "11px" }}>New Column Name</label>
                      <input
                        type="text"
                        className="saas-input"
                        style={{ fontSize: "12px" }}
                        placeholder="new_column_name"
                        value={stepParam1}
                        onChange={e => setStepParam1(e.target.value)}
                      />
                    </div>
                  )}

                  {stepType === "replace_value" && (
                    <div className="saas-form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: "11px" }}>Find & Replace With</label>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <input
                          type="text"
                          className="saas-input"
                          style={{ fontSize: "12px" }}
                          placeholder="Find..."
                          value={stepParam1}
                          onChange={e => setStepParam1(e.target.value)}
                        />
                        <input
                          type="text"
                          className="saas-input"
                          style={{ fontSize: "12px" }}
                          placeholder="Replace with..."
                          value={stepParam2}
                          onChange={e => setStepParam2(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {stepType === "convert_type" && (
                    <div className="saas-form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: "11px" }}>Target Data Type</label>
                      <select
                        className="saas-select"
                        style={{ fontSize: "12px" }}
                        value={stepParam1 || "numeric"}
                        onChange={e => setStepParam1(e.target.value)}
                      >
                        <option value="numeric">Numeric (Float/Int)</option>
                        <option value="datetime">Datetime (Timestamp)</option>
                        <option value="string">String (Text)</option>
                      </select>
                    </div>
                  )}

                  {stepType === "remove_column" && (
                    <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                      Column will be dropped from resulting dataset.
                    </div>
                  )}

                  {stepType === "remove_duplicates" && (
                    <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                      Identical duplicate rows will be pruned.
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="enterprise-btn primary"
                  onClick={() => {
                    const col = stepCol || (schema[0]?.name || "");
                    let newStep = null;
                    if (stepType === "filter_rows") {
                      newStep = { type: "filter_rows", column: col, operator: stepParam1 || "gt", value: stepParam2 || "0" };
                    } else if (stepType === "handle_missing") {
                      newStep = { type: "handle_missing", column: col, strategy: stepParam1 || "median", constant_value: stepParam2 };
                    } else if (stepType === "rename_column") {
                      if (!stepParam1.trim()) return addToast?.("Please specify a new column name.", "error");
                      newStep = { type: "rename_column", old_name: col, new_name: stepParam1.trim() };
                    } else if (stepType === "remove_column") {
                      newStep = { type: "remove_column", column: col };
                    } else if (stepType === "replace_value") {
                      newStep = { type: "replace_value", column: col, find: stepParam1, replace: stepParam2 };
                    } else if (stepType === "convert_type") {
                      newStep = { type: "convert_type", column: col, target_type: stepParam1 || "numeric" };
                    } else if (stepType === "remove_duplicates") {
                      newStep = { type: "remove_duplicates" };
                    }

                    if (newStep) {
                      pushPipelineStep(newStep);
                      setStepParam1("");
                      setStepParam2("");
                      addToast?.("Step added to pipeline recipe.", "success");
                    }
                  }}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", padding: "6px 14px" }}
                >
                  <Plus size={14} /> Stage Step in Recipe
                </button>
              </div>
            </div>
          )}

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
