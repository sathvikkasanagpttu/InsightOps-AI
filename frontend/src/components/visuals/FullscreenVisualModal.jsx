import React, { useState } from "react";
import { X, Download, FileSpreadsheet, Maximize2, Table as TableIcon, BarChart2 } from "lucide-react";
import PowerBIVisualCard from "./PowerBIVisualCard";
import { formatNumber, exportElementToPng, exportDataToCsv } from "./visualUtils";

export default function FullscreenVisualModal({ visual, onClose, paletteKey = "power_bi" }) {
  if (!visual) return null;
  const [activeTab, setActiveTab] = useState("chart");
  const modalChartId = `fullscreen-chart-${visual.id}`;

  const data = visual.data || [];
  const headers = data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <div className="bi-modal-backdrop" onClick={onClose}>
      <div className="bi-fullscreen-modal" onClick={e => e.stopPropagation()}>
        {/* Fullscreen Header */}
        <div className="bi-fs-header">
          <div className="bi-fs-title-box">
            <span className="bi-visual-type-badge">{(visual.kind || visual.chart_type || "chart").toUpperCase()}</span>
            <h3 className="bi-fs-title">{visual.title}</h3>
            {visual.source_columns && (
              <span className="bi-fs-sub">Source: {visual.source_columns.join(", ")}</span>
            )}
          </div>

          <div className="bi-fs-actions">
            <div className="bi-fs-tabs">
              <button
                type="button"
                className={`bi-fs-tab ${activeTab === "chart" ? "active" : ""}`}
                onClick={() => setActiveTab("chart")}
              >
                <BarChart2 size={14} /> Chart
              </button>
              <button
                type="button"
                className={`bi-fs-tab ${activeTab === "data" ? "active" : ""}`}
                onClick={() => setActiveTab("data")}
              >
                <TableIcon size={14} /> Data Inspect
              </button>
            </div>

            <button
              type="button"
              className="bi-btn-secondary"
              onClick={() => exportElementToPng(modalChartId, `${visual.title || "fullscreen_chart"}.png`)}
            >
              <Download size={14} /> Export PNG
            </button>

            <button
              type="button"
              className="bi-btn-secondary"
              onClick={() => exportDataToCsv(data, `${visual.title || "chart_data"}.csv`)}
            >
              <FileSpreadsheet size={14} /> Export CSV
            </button>

            <button type="button" className="bi-btn-icon" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Fullscreen Content */}
        <div className="bi-fs-body" id={modalChartId}>
          {activeTab === "chart" ? (
            <div className="bi-fs-chart-wrapper">
              <PowerBIVisualCard
                visual={{ ...visual, width: 12 }}
                paletteKey={paletteKey}
                onCrossFilter={() => {}}
              />
            </div>
          ) : (
            <div className="bi-fs-table-wrapper">
              <table className="bi-inspect-table">
                <thead>
                  <tr>
                    {headers.map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, rIdx) => (
                    <tr key={rIdx}>
                      {headers.map(h => (
                        <td key={h}>
                          {typeof row[h] === "number" ? formatNumber(row[h], false) : String(row[h] || "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
