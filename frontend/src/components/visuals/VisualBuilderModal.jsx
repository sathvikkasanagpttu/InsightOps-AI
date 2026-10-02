import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  BarChart3,
  BarChart2,
  LineChart as LineIcon,
  PieChart as PieIcon,
  Layers,
  Activity,
  TrendingUp,
  Grid,
  Compass,
  Sliders,
  Filter,
  Table as TableIcon,
  Check,
  Search,
  Plus,
  RefreshCw
} from "lucide-react";
import { VISUAL_TYPES, suggestVisualType } from "./visualUtils";
import PowerBIVisualCard from "./PowerBIVisualCard";
import { api } from "../../lib/api";

const ICON_MAP = {
  BarChart3,
  BarChart2,
  LineChart: LineIcon,
  PieChart: PieIcon,
  Layers,
  Activity,
  TrendingUp,
  Grid,
  Compass,
  Sliders,
  Filter,
  Sparkles,
  Table: TableIcon
};

export default function VisualBuilderModal({
  isOpen,
  onClose,
  onSave,
  initialVisual = null,
  schema = [],
  datasetId = "demo-sales"
}) {
  if (!isOpen) return null;

  // Visual configuration state
  const [chartType, setChartType] = useState(initialVisual?.kind || initialVisual?.chart_type || "column");
  const [title, setTitle] = useState(initialVisual?.title || "New Visualization");
  const [xCol, setXCol] = useState(initialVisual?.x_key || initialVisual?.x_axis || initialVisual?.category_column || "");
  const [yCols, setYCols] = useState(
    initialVisual?.y_key ? [initialVisual.y_key] : (initialVisual?.metric ? [initialVisual.metric] : [])
  );
  const [legendCol, setLegendCol] = useState(initialVisual?.legend || "");
  const [aggregation, setAggregation] = useState(initialVisual?.aggregation || "sum");
  const [dateHierarchy, setDateHierarchy] = useState(initialVisual?.date_hierarchy || "auto");
  const [sortBy, setSortBy] = useState(initialVisual?.sort_by || "value");
  const [sortOrder, setSortOrder] = useState(initialVisual?.sort_order || "desc");
  const [topN, setTopN] = useState(initialVisual?.top_n || 10);
  const [paletteKey, setPaletteKey] = useState(initialVisual?.paletteKey || "power_bi");
  const [fieldSearch, setFieldSearch] = useState("");
  const [focusedWell, setFocusedWell] = useState("x");

  // Live preview data state
  const [previewVisual, setPreviewVisual] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  // Categorize schema into Measures & Dimensions
  const numericTypes = new Set(["numeric", "currency", "percentage"]);
  const measures = schema.filter(c => numericTypes.has(c.semantic_type) || numericTypes.has(c.inferred_type));
  const dimensions = schema.filter(c => !numericTypes.has(c.semantic_type) && !numericTypes.has(c.inferred_type));

  // Auto-select initial defaults if creating a new visual
  useEffect(() => {
    if (!initialVisual && schema.length > 0) {
      const defaultDim = dimensions[0]?.name || schema[0]?.name || "";
      const defaultMeas = measures[0]?.name || "";
      setXCol(defaultDim);
      if (defaultMeas) setYCols([defaultMeas]);
      setTitle(`${defaultMeas || "Records"} by ${defaultDim || "Category"}`);
    }
  }, [initialVisual, schema]);

  // Execute dynamic visual query whenever configuration changes
  useEffect(() => {
    let isCancelled = false;
    async function fetchPreview() {
      setPreviewLoading(true);
      setPreviewError("");
      try {
        const queryBody = {
          chart_type: chartType,
          x_col: xCol || undefined,
          y_col: yCols.length === 1 ? yCols[0] : (yCols.length > 1 ? yCols : undefined),
          legend_col: legendCol || undefined,
          aggregation,
          date_hierarchy: dateHierarchy,
          sort_by: sortBy,
          sort_order: sortOrder,
          top_n: topN ? Number(topN) : undefined
        };

        const res = await api(`/api/dataset/visualize/query?dataset_id=${encodeURIComponent(datasetId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(queryBody)
        });

        if (!isCancelled) {
          setPreviewVisual({
            ...res,
            id: "preview-card",
            title: title || `${chartType.toUpperCase()} Chart`,
            source_columns: [xCol, ...yCols, legendCol].filter(Boolean),
            width: 12
          });
        }
      } catch (err) {
        if (!isCancelled) {
          setPreviewError(err.message || "Failed to generate visual preview");
        }
      } finally {
        if (!isCancelled) setPreviewLoading(false);
      }
    }

    fetchPreview();
    return () => {
      isCancelled = true;
    };
  }, [chartType, xCol, yCols, legendCol, aggregation, dateHierarchy, sortBy, sortOrder, topN, datasetId, title]);

  // Handle Drag and Drop
  function handleDragStart(e, fieldName) {
    e.dataTransfer.setData("text/plain", fieldName);
  }

  function handleDrop(e, targetWell) {
    e.preventDefault();
    const fieldName = e.dataTransfer.getData("text/plain");
    assignFieldToWell(fieldName, targetWell);
  }

  function assignFieldToWell(fieldName, targetWell) {
    if (targetWell === "x") {
      setXCol(fieldName);
    } else if (targetWell === "y") {
      setYCols(prev => (prev.includes(fieldName) ? prev : [...prev, fieldName]));
    } else if (targetWell === "legend") {
      setLegendCol(fieldName);
    }
  }

  // Auto-Select Visual Type
  function handleAutoSelect() {
    const suggested = suggestVisualType({ xCol, yCols, legendCol, schema });
    setChartType(suggested);
  }

  // Save handler
  function handleSaveVisual() {
    const newVisual = {
      id: initialVisual?.id || `custom-visual-${Date.now()}`,
      kind: chartType,
      chart_type: chartType,
      title: title || `${chartType.toUpperCase()} Chart`,
      x_key: xCol,
      x_axis: xCol,
      y_key: yCols[0],
      metric: yCols[0],
      secondary_metric: yCols[1],
      legend: legendCol,
      aggregation,
      date_hierarchy: dateHierarchy,
      sort_by: sortBy,
      sort_order: sortOrder,
      top_n: topN,
      paletteKey,
      width: initialVisual?.width || 6,
      source_columns: [xCol, ...yCols, legendCol].filter(Boolean),
      data: previewVisual?.data || [],
      ...previewVisual
    };
    onSave(newVisual);
    onClose();
  }

  const isXDate = schema.find(c => c.name === xCol)?.semantic_type === "datetime";

  return (
    <div className="bi-modal-backdrop" onClick={onClose}>
      <div className="bi-builder-modal" onClick={e => e.stopPropagation()}>
        {/* Modal Top Bar */}
        <div className="bi-builder-topbar">
          <div className="bi-builder-title-group">
            <Sparkles size={18} className="bi-glow-icon" />
            <input
              type="text"
              className="bi-builder-title-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Enter Visualization Title..."
            />
          </div>
          <div className="bi-builder-actions">
            <button type="button" className="bi-btn-secondary" onClick={handleAutoSelect}>
              <Sparkles size={14} /> Auto-Select Visual
            </button>
            <button type="button" className="bi-btn-primary" onClick={handleSaveVisual}>
              <Check size={14} /> Save Visual
            </button>
            <button type="button" className="bi-btn-icon" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body: 3-Column Layout */}
        <div className="bi-builder-body">
          {/* Column 1: Fields Explorer */}
          <div className="bi-fields-panel">
            <div className="bi-panel-title">Fields</div>
            <div className="bi-field-search-box">
              <Search size={14} />
              <input
                type="text"
                placeholder="Search columns..."
                value={fieldSearch}
                onChange={e => setFieldSearch(e.target.value)}
              />
            </div>

            {/* Measures */}
            <div className="bi-field-section">
              <div className="bi-field-section-head">
                <span>∑ Measures ({measures.length})</span>
              </div>
              <div className="bi-field-list">
                {measures
                  .filter(m => m.name.toLowerCase().includes(fieldSearch.toLowerCase()))
                  .map(m => (
                    <div
                      key={m.name}
                      className="bi-field-item measure"
                      draggable
                      onDragStart={e => handleDragStart(e, m.name)}
                      onClick={() => assignFieldToWell(m.name, focusedWell)}
                    >
                      <span className="bi-field-tag">∑</span>
                      <span className="bi-field-name">{m.original_name || m.name}</span>
                      <Plus size={12} className="bi-add-icon" />
                    </div>
                  ))}
              </div>
            </div>

            {/* Dimensions */}
            <div className="bi-field-section">
              <div className="bi-field-section-head">
                <span>🔤 Dimensions ({dimensions.length})</span>
              </div>
              <div className="bi-field-list">
                {dimensions
                  .filter(d => d.name.toLowerCase().includes(fieldSearch.toLowerCase()))
                  .map(d => (
                    <div
                      key={d.name}
                      className="bi-field-item dimension"
                      draggable
                      onDragStart={e => handleDragStart(e, d.name)}
                      onClick={() => assignFieldToWell(d.name, focusedWell)}
                    >
                      <span className="bi-field-tag">
                        {d.semantic_type === "datetime" ? "📅" : "🔤"}
                      </span>
                      <span className="bi-field-name">{d.original_name || d.name}</span>
                      <Plus size={12} className="bi-add-icon" />
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Column 2: Visual Types & Field Wells */}
          <div className="bi-wells-panel">
            {/* Visual Type Selector Matrix */}
            <div className="bi-type-matrix">
              {VISUAL_TYPES.map(vt => {
                const IconComp = ICON_MAP[vt.icon] || BarChart3;
                return (
                  <button
                    key={vt.id}
                    type="button"
                    className={`bi-type-btn ${chartType === vt.id ? "active" : ""}`}
                    onClick={() => setChartType(vt.id)}
                    title={`${vt.label}: ${vt.desc}`}
                  >
                    <IconComp size={16} />
                    <span>{vt.label.split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>

            {/* Wells Form */}
            <div className="bi-wells-container">
              {/* X-Axis / Category Well */}
              <div
                className={`bi-well-card ${focusedWell === "x" ? "focused" : ""}`}
                onClick={() => setFocusedWell("x")}
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDrop(e, "x")}
              >
                <div className="bi-well-label">
                  <span>X-Axis / Category</span>
                  {xCol && (
                    <button type="button" className="bi-chip-clear" onClick={() => setXCol("")}>
                      ✕
                    </button>
                  )}
                </div>
                {xCol ? (
                  <div className="bi-well-chip">
                    <span>{xCol}</span>
                  </div>
                ) : (
                  <div className="bi-well-dropzone">Drag dimension here or click field</div>
                )}
              </div>

              {/* Y-Axis / Values Well */}
              <div
                className={`bi-well-card ${focusedWell === "y" ? "focused" : ""}`}
                onClick={() => setFocusedWell("y")}
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDrop(e, "y")}
              >
                <div className="bi-well-label">
                  <span>Y-Axis / Measure(s)</span>
                  {yCols.length > 0 && (
                    <button type="button" className="bi-chip-clear" onClick={() => setYCols([])}>
                      ✕
                    </button>
                  )}
                </div>
                {yCols.length > 0 ? (
                  <div className="bi-chip-list">
                    {yCols.map((y, idx) => (
                      <span key={idx} className="bi-well-chip">
                        {y}
                        <button
                          type="button"
                          className="bi-chip-remove"
                          onClick={() => setYCols(prev => prev.filter(c => c !== y))}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="bi-well-dropzone">Drag measure(s) here</div>
                )}
              </div>

              {/* Legend / Breakdown Well */}
              <div
                className={`bi-well-card ${focusedWell === "legend" ? "focused" : ""}`}
                onClick={() => setFocusedWell("legend")}
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDrop(e, "legend")}
              >
                <div className="bi-well-label">
                  <span>Legend / Secondary Dimension</span>
                  {legendCol && (
                    <button type="button" className="bi-chip-clear" onClick={() => setLegendCol("")}>
                      ✕
                    </button>
                  )}
                </div>
                {legendCol ? (
                  <div className="bi-well-chip">
                    <span>{legendCol}</span>
                  </div>
                ) : (
                  <div className="bi-well-dropzone">Optional grouping dimension</div>
                )}
              </div>

              {/* Aggregation Control */}
              <div className="bi-option-row">
                <label>Aggregation</label>
                <select value={aggregation} onChange={e => setAggregation(e.target.value)}>
                  <option value="sum">Sum</option>
                  <option value="avg">Average</option>
                  <option value="count">Count (Records)</option>
                  <option value="distinct_count">Distinct Count</option>
                  <option value="min">Min</option>
                  <option value="max">Max</option>
                  <option value="median">Median</option>
                  <option value="pct">Percentage of Total</option>
                </select>
              </div>

              {/* Date Hierarchy (if X is date) */}
              {isXDate && (
                <div className="bi-option-row">
                  <label>Date Hierarchy</label>
                  <select value={dateHierarchy} onChange={e => setDateHierarchy(e.target.value)}>
                    <option value="auto">Auto Granularity</option>
                    <option value="year">Year</option>
                    <option value="quarter">Quarter</option>
                    <option value="month">Month</option>
                    <option value="day">Day</option>
                  </select>
                </div>
              )}

              {/* Sort & Top-N */}
              <div className="bi-option-row">
                <label>Sort By</label>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
                  <option value="value">Value</option>
                  <option value="label">Alphabetical / Label</option>
                </select>
              </div>

              <div className="bi-option-row">
                <label>Order & Limit</label>
                <div className="bi-inline-group">
                  <select value={sortOrder} onChange={e => setSortOrder(e.target.value)}>
                    <option value="desc">Desc (Highest first)</option>
                    <option value="asc">Asc (Lowest first)</option>
                  </select>
                  <select value={topN} onChange={e => setTopN(e.target.value)}>
                    <option value="5">Top 5</option>
                    <option value="10">Top 10</option>
                    <option value="20">Top 20</option>
                    <option value="">All</option>
                  </select>
                </div>
              </div>

              {/* Color Palette */}
              <div className="bi-option-row">
                <label>Palette Theme</label>
                <select value={paletteKey} onChange={e => setPaletteKey(e.target.value)}>
                  <option value="power_bi">Classic Power BI</option>
                  <option value="emerald">Emerald Horizon</option>
                  <option value="neon">Cyberpunk Neon</option>
                  <option value="amber">Warm Amber</option>
                  <option value="ocean">Ocean Breeze</option>
                </select>
              </div>
            </div>
          </div>

          {/* Column 3: Live Preview Canvas */}
          <div className="bi-preview-panel">
            <div className="bi-preview-header">
              <span>Live Visual Preview</span>
              {previewLoading && <RefreshCw size={13} className="bi-spin" />}
            </div>

            <div className="bi-preview-content">
              {previewError ? (
                <div className="bi-preview-error">{previewError}</div>
              ) : previewVisual ? (
                <PowerBIVisualCard
                  visual={previewVisual}
                  paletteKey={paletteKey}
                  onCrossFilter={() => {}}
                />
              ) : (
                <div className="bi-preview-empty">Select fields to generate visual</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
