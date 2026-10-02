import React, { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";
import {
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
  Sparkles,
  Table as TableIcon,
  Maximize2,
  Copy,
  Trash2,
  Edit3,
  ArrowUp,
  ArrowDown,
  Download,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { PALETTES, formatNumber, formatPercentage, exportElementToPng, exportDataToCsv } from "./visualUtils";

export default function PowerBIVisualCard({
  visual,
  onEdit,
  onDuplicate,
  onDelete,
  onFullscreen,
  onCrossFilter,
  activeCrossFilter,
  onDrillDown,
  onDrillUp,
  onResize,
  onMoveLeft,
  onMoveRight,
  paletteKey = "power_bi"
}) {
  const [drillLevel, setDrillLevel] = useState(visual.date_hierarchy || "auto");
  const palette = PALETTES[paletteKey] || PALETTES.power_bi;
  const chartId = `visual-chart-${visual.id}`;

  const isCrossFilterSource = activeCrossFilter && activeCrossFilter.visualId === visual.id;

  // Custom Recharts tooltip
  function CustomTooltip({ active, payload, label }) {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="bi-tooltip-card">
        <div className="bi-tooltip-header">{label || payload[0]?.name || "Metric"}</div>
        <div className="bi-tooltip-body">
          {payload.map((entry, idx) => (
            <div key={idx} className="bi-tooltip-row">
              <span className="bi-tooltip-dot" style={{ background: entry.color || entry.fill || palette[0] }} />
              <span className="bi-tooltip-label">{entry.name || visual.metric || "Value"}:</span>
              <span className="bi-tooltip-val">{formatNumber(entry.value, false)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Handle bar / slice click for cross-filtering
  function handleElementClick(dataPoint) {
    if (!onCrossFilter) return;
    const catCol = visual.x_key || visual.category_column || visual.x_axis || visual.source_columns?.[0];
    const clickedVal = dataPoint.label || dataPoint.x || dataPoint.name || dataPoint.category;
    if (catCol && clickedVal !== undefined) {
      onCrossFilter({
        column: catCol,
        value: clickedVal,
        visualId: visual.id
      });
    }
  }

  // Check if an item is dimmed by active cross-filter
  function getItemOpacity(itemLabel) {
    if (!activeCrossFilter) return 1.0;
    const catCol = visual.x_key || visual.category_column || visual.x_axis || visual.source_columns?.[0];
    if (activeCrossFilter.column === catCol) {
      return String(activeCrossFilter.value) === String(itemLabel) ? 1.0 : 0.28;
    }
    return 1.0;
  }

  const kind = visual.kind || visual.chart_type || "column";
  const data = visual.data || [];
  const widthClass = visual.width === 12 ? "col-span-12" : visual.width === 8 ? "col-span-8" : visual.width === 4 ? "col-span-4" : "col-span-6";

  return (
    <div
      id={chartId}
      className={`bi-visual-card ${widthClass} ${isCrossFilterSource ? "filter-source-glow" : ""}`}
    >
      {/* Visual Header */}
      <div className="bi-visual-header">
        <div className="bi-visual-title-box">
          <span className="bi-visual-type-badge">{kind.replace("_", " ").toUpperCase()}</span>
          <h4 className="bi-visual-title" title={visual.title}>{visual.title}</h4>
          {visual.source_columns && (
            <span className="bi-visual-sub">
              {visual.source_columns.join(" • ")}
            </span>
          )}
        </div>

        {/* Action Toolbar */}
        <div className="bi-visual-toolbar">
          {/* Hierarchy Drill Buttons */}
          {(visual.is_date || visual.date_hierarchy) && (
            <div className="bi-drill-group">
              <button
                type="button"
                className="bi-tool-btn"
                title="Drill Up"
                onClick={() => onDrillUp && onDrillUp(visual)}
              >
                <ArrowUp size={13} />
              </button>
              <button
                type="button"
                className="bi-tool-btn"
                title="Drill Down"
                onClick={() => onDrillDown && onDrillDown(visual)}
              >
                <ArrowDown size={13} />
              </button>
            </div>
          )}

          {/* Width / Size Switcher */}
          <div className="bi-size-select">
            <button
              type="button"
              className={`bi-size-btn ${visual.width === 4 ? "active" : ""}`}
              title="1/3 Width"
              onClick={() => onResize && onResize(visual.id, 4)}
            >
              1/3
            </button>
            <button
              type="button"
              className={`bi-size-btn ${visual.width === 6 || !visual.width ? "active" : ""}`}
              title="1/2 Width"
              onClick={() => onResize && onResize(visual.id, 6)}
            >
              1/2
            </button>
            <button
              type="button"
              className={`bi-size-btn ${visual.width === 12 ? "active" : ""}`}
              title="Full Width"
              onClick={() => onResize && onResize(visual.id, 12)}
            >
              Full
            </button>
          </div>

          {/* Move Reorder */}
          <button type="button" className="bi-tool-btn" title="Move Left" onClick={() => onMoveLeft && onMoveLeft(visual.id)}>
            <ChevronLeft size={13} />
          </button>
          <button type="button" className="bi-tool-btn" title="Move Right" onClick={() => onMoveRight && onMoveRight(visual.id)}>
            <ChevronRight size={13} />
          </button>

          {/* Fullscreen Expand */}
          <button type="button" className="bi-tool-btn" title="Fullscreen" onClick={() => onFullscreen && onFullscreen(visual)}>
            <Maximize2 size={13} />
          </button>

          {/* Export PNG */}
          <button
            type="button"
            className="bi-tool-btn"
            title="Export PNG"
            onClick={() => exportElementToPng(chartId, `${visual.title || "chart"}.png`)}
          >
            <Download size={13} />
          </button>

          {/* Export CSV */}
          <button
            type="button"
            className="bi-tool-btn"
            title="Export CSV"
            onClick={() => exportDataToCsv(data, `${visual.title || "chart_data"}.csv`)}
          >
            <FileSpreadsheet size={13} />
          </button>

          {/* Edit */}
          <button type="button" className="bi-tool-btn" title="Edit in Visual Builder" onClick={() => onEdit && onEdit(visual)}>
            <Edit3 size={13} />
          </button>

          {/* Duplicate */}
          <button type="button" className="bi-tool-btn" title="Duplicate Visual" onClick={() => onDuplicate && onDuplicate(visual)}>
            <Copy size={13} />
          </button>

          {/* Delete */}
          <button type="button" className="bi-tool-btn danger" title="Delete Visual" onClick={() => onDelete && onDelete(visual.id)}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Visual Body / Chart Canvas */}
      <div className="bi-visual-canvas">
        {/* 1. COLUMN CHART */}
        {kind === "column" && (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} onClick={e => e && e.activePayload && handleElementClick(e.activePayload[0].payload)}>
              <CartesianGrid stroke="#ffffff0a" vertical={false} />
              <XAxis dataKey={visual.x_key || "label"} tick={{ fill: "#8291a8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#8291a8", fontSize: 11 }} tickFormatter={v => formatNumber(v, true)} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey={visual.y_key || "value"} radius={[4, 4, 0, 0]}>
                {data.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={palette[idx % palette.length]}
                    opacity={getItemOpacity(entry.label || entry.x)}
                    cursor="pointer"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* 2. BAR CHART (Horizontal) */}
        {kind === "bar" && (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={data}
              layout="vertical"
              onClick={e => e && e.activePayload && handleElementClick(e.activePayload[0].payload)}
            >
              <CartesianGrid stroke="#ffffff0a" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#8291a8", fontSize: 11 }} tickFormatter={v => formatNumber(v, true)} />
              <YAxis dataKey={visual.x_key || "label"} type="category" width={90} tick={{ fill: "#8291a8", fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey={visual.y_key || "value"} radius={[0, 4, 4, 0]}>
                {data.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={palette[idx % palette.length]}
                    opacity={getItemOpacity(entry.label || entry.x)}
                    cursor="pointer"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* 3. STACKED BAR / COLUMN */}
        {kind === "stacked_bar" && (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data}>
              <CartesianGrid stroke="#ffffff0a" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#8291a8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#8291a8", fontSize: 11 }} tickFormatter={v => formatNumber(v, true)} />
              <Tooltip contentStyle={{ background: "#0b1524", border: "1px solid #1f2d42", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#8291a8" }} />
              {(visual.series || Object.keys(data[0] || {}).filter(k => !["label", "total"].includes(k))).map((sKey, sIdx) => (
                <Bar key={sKey} dataKey={sKey} stackId="stack" fill={palette[sIdx % palette.length]} radius={[2, 2, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* 4. LINE CHART */}
        {kind === "line" && (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} onClick={e => e && e.activePayload && handleElementClick(e.activePayload[0].payload)}>
              <CartesianGrid stroke="#ffffff0a" vertical={false} />
              <XAxis dataKey={visual.x_key || "period" || "label"} tick={{ fill: "#8291a8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#8291a8", fontSize: 11 }} tickFormatter={v => formatNumber(v, true)} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey={visual.y_key || "value"}
                stroke={palette[0]}
                strokeWidth={2.5}
                dot={{ fill: palette[0], r: 3 }}
                activeDot={{ r: 6, fill: "#fff" }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}

        {/* 5. AREA CHART */}
        {kind === "area" && (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data} onClick={e => e && e.activePayload && handleElementClick(e.activePayload[0].payload)}>
              <defs>
                <linearGradient id={`areaGrad-${visual.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={palette[0]} stopOpacity={0.5} />
                  <stop offset="95%" stopColor={palette[0]} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#ffffff0a" vertical={false} />
              <XAxis dataKey={visual.x_key || "period" || "label"} tick={{ fill: "#8291a8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#8291a8", fontSize: 11 }} tickFormatter={v => formatNumber(v, true)} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey={visual.y_key || "value"}
                stroke={palette[0]}
                strokeWidth={2.5}
                fill={`url(#areaGrad-${visual.id})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {/* 6. COMBO CHART (Bar + Line) */}
        {kind === "combo" && (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={data}>
              <CartesianGrid stroke="#ffffff0a" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#8291a8", fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fill: "#8291a8", fontSize: 11 }} tickFormatter={v => formatNumber(v, true)} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: "#8291a8", fontSize: 11 }} tickFormatter={v => formatNumber(v, true)} />
              <Tooltip contentStyle={{ background: "#0b1524", border: "1px solid #1f2d42", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#8291a8" }} />
              <Bar yAxisId="left" dataKey={visual.primary_metric || Object.keys(data[0] || {})[1]} fill={palette[0]} radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey={visual.secondary_metric || Object.keys(data[0] || {})[2]} stroke={palette[3] || "#e76f51"} strokeWidth={3} dot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}

        {/* 7. PIE & 8. DONUT CHART */}
        {(kind === "pie" || kind === "donut") && (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#8291a8" }} />
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius={kind === "donut" ? 55 : 0}
                outerRadius={85}
                paddingAngle={2}
                onClick={entry => handleElementClick(entry)}
              >
                {data.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={palette[idx % palette.length]}
                    opacity={getItemOpacity(entry.label)}
                    cursor="pointer"
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}

        {/* 9. TREEMAP */}
        {kind === "treemap" && (
          <div className="bi-treemap-grid">
            {data.slice(0, 10).map((node, nIdx) => (
              <div
                key={node.name || nIdx}
                className="bi-treemap-tile"
                style={{
                  background: palette[nIdx % palette.length],
                  opacity: getItemOpacity(node.name),
                  flexGrow: Math.max(1, Math.round(node.pct || 10))
                }}
                onClick={() => handleElementClick(node)}
                title={`${node.name}: ${node.formatted || node.value} (${node.pct}%)`}
              >
                <div className="bi-tile-name">{node.name}</div>
                <div className="bi-tile-val">{formatNumber(node.value)}</div>
                <div className="bi-tile-pct">{node.pct}%</div>
              </div>
            ))}
          </div>
        )}

        {/* 10. SCATTER & 11. BUBBLE */}
        {(kind === "scatter" || kind === "bubble") && (
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart>
              <CartesianGrid stroke="#ffffff0a" />
              <XAxis type="number" dataKey="x" name={visual.x_label || visual.x_axis || "X"} tick={{ fill: "#8291a8", fontSize: 11 }} tickFormatter={v => formatNumber(v, true)} />
              <YAxis type="number" dataKey="y" name={visual.y_label || visual.y_axis || "Y"} tick={{ fill: "#8291a8", fontSize: 11 }} tickFormatter={v => formatNumber(v, true)} />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ background: "#0b1524", border: "1px solid #1f2d42", borderRadius: 8 }} />
              <Scatter name={visual.title} data={data} fill={palette[0]}>
                {data.map((entry, idx) => (
                  <Cell key={idx} fill={palette[idx % palette.length]} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        )}

        {/* 12. HISTOGRAM */}
        {kind === "histogram" && (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data}>
              <CartesianGrid stroke="#ffffff0a" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#8291a8", fontSize: 10 }} />
              <YAxis tick={{ fill: "#8291a8", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#0b1524", border: "1px solid #1f2d42", borderRadius: 8 }} />
              <Bar dataKey="value" fill={palette[1]} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* 13. BOX PLOT */}
        {kind === "box_plot" && (
          <div className="bi-boxplot-container">
            {data.map((box, bIdx) => {
              const maxVal = Math.max(...data.map(d => d.max || 100));
              const scale = v => Math.min(100, Math.max(0, (v / maxVal) * 100));
              return (
                <div key={bIdx} className="bi-boxplot-row">
                  <span className="bi-boxplot-cat">{box.category}</span>
                  <div className="bi-boxplot-track">
                    <div
                      className="bi-box-whisker"
                      style={{ left: `${scale(box.min)}%`, width: `${scale(box.max) - scale(box.min)}%` }}
                    />
                    <div
                      className="bi-box-body"
                      style={{
                        left: `${scale(box.q1)}%`,
                        width: `${Math.max(4, scale(box.q3) - scale(box.q1))}%`,
                        background: palette[bIdx % palette.length]
                      }}
                    >
                      <div className="bi-box-median" style={{ left: "50%" }} />
                    </div>
                  </div>
                  <span className="bi-boxplot-stat">
                    Med: {formatNumber(box.median)} | Q1: {formatNumber(box.q1)} | Q3: {formatNumber(box.q3)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* 14. HEATMAP */}
        {kind === "heatmap" && (
          <div className="bi-heatmap-container">
            <div className="bi-heatmap-grid-scroll">
              <table className="bi-heatmap-table">
                <thead>
                  <tr>
                    <th className="bi-hm-corner">{visual.x_categories?.[0] ? "Dim" : ""}</th>
                    {(visual.y_categories || []).map(y => (
                      <th key={y} className="bi-hm-col-header">{y}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(visual.x_categories || []).map(x => (
                    <tr key={x}>
                      <td className="bi-hm-row-header">{x}</td>
                      {(visual.y_categories || []).map(y => {
                        const cell = data.find(c => c.x === x && c.y === y) || { value: 0, intensity: 0 };
                        const alpha = Math.max(0.12, Math.min(0.95, cell.intensity || 0.2));
                        return (
                          <td
                            key={y}
                            className="bi-hm-cell"
                            style={{ backgroundColor: `rgba(0, 180, 216, ${alpha})` }}
                            onClick={() => onCrossFilter && onCrossFilter({ column: visual.x_axis || "category", value: x })}
                            title={`${x} × ${y}: ${formatNumber(cell.value)}`}
                          >
                            {formatNumber(cell.value)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 15. FUNNEL */}
        {kind === "funnel" && (
          <div className="bi-funnel-container">
            {data.map((stg, sIdx) => {
              const widthPct = Math.max(20, Math.min(100, stg.pct_of_first || 100));
              return (
                <div key={stg.stage || sIdx} className="bi-funnel-row" onClick={() => handleElementClick({ label: stg.stage })}>
                  <div className="bi-funnel-label-col">
                    <span className="bi-funnel-name">{stg.stage}</span>
                    <span className="bi-funnel-val">{formatNumber(stg.value)}</span>
                  </div>
                  <div className="bi-funnel-bar-col">
                    <div
                      className="bi-funnel-bar"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: palette[sIdx % palette.length],
                        opacity: getItemOpacity(stg.stage)
                      }}
                    >
                      <span className="bi-funnel-bar-text">{stg.pct_of_first}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 16. GAUGE */}
        {kind === "gauge" && (
          <div className="bi-gauge-container">
            <svg viewBox="0 0 200 110" className="bi-gauge-svg">
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="#1f2d42"
                strokeWidth="16"
                strokeLinecap="round"
              />
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke={palette[0]}
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={`${(visual.pct || 50) * 2.51} 300`}
              />
              <text x="100" y="85" textAnchor="middle" className="bi-gauge-val">
                {formatNumber(visual.value)}
              </text>
              <text x="100" y="105" textAnchor="middle" className="bi-gauge-sub">
                Target: {formatNumber(visual.target)} ({visual.pct || 0}%)
              </text>
            </svg>
          </div>
        )}

        {/* 17. KPI CARD */}
        {kind === "kpi_card" && (
          <div className="bi-kpi-card-content">
            <div className="bi-kpi-main-val">
              {formatNumber(visual.value)}
            </div>
            <div className="bi-kpi-meta-row">
              {visual.variance_pct !== null && visual.variance_pct !== undefined && (
                <span className={`bi-kpi-badge ${visual.variance_pct >= 0 ? "positive" : "negative"}`}>
                  {visual.variance_pct >= 0 ? "▲" : "▼"} {formatPercentage(visual.variance_pct)}
                </span>
              )}
              {visual.target && (
                <span className="bi-kpi-target">
                  Target: {formatNumber(visual.target)} ({visual.achievement_pct || 0}%)
                </span>
              )}
            </div>
            {/* Sparkline */}
            {visual.sparkline && visual.sparkline.length > 0 && (
              <div className="bi-kpi-sparkline">
                <ResponsiveContainer width="100%" height={50}>
                  <AreaChart data={visual.sparkline}>
                    <defs>
                      <linearGradient id={`kpiSpark-${visual.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={palette[0]} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={palette[0]} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke={palette[0]} strokeWidth={2} fill={`url(#kpiSpark-${visual.id})`} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* 18. TABLE MATRIX */}
        {kind === "table" && (
          <div className="bi-mini-table-scroll">
            <table className="bi-mini-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Value</th>
                  <th>Proportion</th>
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 10).map((row, rIdx) => {
                  const maxV = Math.max(...data.map(d => d.value || 1));
                  const pct = Math.round((row.value / maxV) * 100);
                  return (
                    <tr key={rIdx} onClick={() => handleElementClick(row)}>
                      <td>{row.label}</td>
                      <td className="bold">{formatNumber(row.value)}</td>
                      <td>
                        <div className="bi-table-bar-track">
                          <div className="bi-table-bar-fill" style={{ width: `${pct}%`, background: palette[0] }} />
                          <span className="bi-table-bar-pct">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
