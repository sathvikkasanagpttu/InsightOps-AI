import React, { useState } from "react";
import { Filter, Calendar, Sliders, X, RotateCcw, ChevronDown, Check } from "lucide-react";
import { formatNumber } from "./visualUtils";

export default function SlicerFilterBar({
  schema = [],
  activeFilters = [],
  onFilterChange,
  activeCrossFilter = null,
  onClearCrossFilter,
  onClearAllFilters,
  dimensions = []
}) {
  const [openDropdown, setOpenDropdown] = useState(null);

  // Identify top categorical dimensions for slicers (unique_count between 2 and 12)
  const slicerDims = schema.filter(
    col =>
      ["category", "region", "status", "channel", "department", "country"].includes(col.semantic_type) ||
      (col.unique_count >= 2 && col.unique_count <= 10 && col.semantic_type !== "datetime")
  ).slice(0, 4);

  // Identify date column for date slicer
  const dateCol = schema.find(c => c.semantic_type === "datetime" || c.inferred_type === "datetime");

  // Check if a category value is active in filters
  function isCategorySelected(colName, val) {
    const found = activeFilters.find(f => f.column === colName);
    if (!found) return false;
    if (found.operator === "in" && Array.isArray(found.value)) {
      return found.value.includes(val);
    }
    return found.value === val;
  }

  function toggleCategoryFilter(colName, val) {
    const existing = activeFilters.find(f => f.column === colName);
    let nextList = [...activeFilters.filter(f => f.column !== colName)];

    if (!existing) {
      nextList.push({ column: colName, operator: "in", value: [val] });
    } else {
      const currentVals = Array.isArray(existing.value) ? existing.value : [existing.value];
      const updated = currentVals.includes(val)
        ? currentVals.filter(v => v !== val)
        : [...currentVals, val];
      if (updated.length > 0) {
        nextList.push({ column: colName, operator: "in", value: updated });
      }
    }
    onFilterChange(nextList);
  }

  // Preset Date Slicers
  function applyDatePreset(preset) {
    if (!dateCol) return;
    const now = new Date();
    let startDate = null;

    if (preset === "30d") {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    } else if (preset === "90d") {
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    } else if (preset === "ytd") {
      startDate = `${now.getFullYear()}-01-01`;
    }

    let nextList = activeFilters.filter(f => f.column !== dateCol.name);
    if (startDate) {
      nextList.push({
        column: dateCol.name,
        operator: "date_range",
        value: [startDate, now.toISOString().slice(0, 10)],
        presetLabel: preset.toUpperCase()
      });
    }
    onFilterChange(nextList);
  }

  const hasAnyFilter = activeFilters.length > 0 || activeCrossFilter !== null;

  return (
    <div className="bi-slicer-container">
      {/* Top Slicers Bar */}
      <div className="bi-slicers-bar">
        <div className="bi-slicer-title">
          <Filter size={14} className="bi-icon-teal" />
          <span>Interactive Slicers</span>
        </div>

        {/* Date Preset Slicer */}
        {dateCol && (
          <div className="bi-slicer-group">
            <span className="bi-slicer-label">
              <Calendar size={12} /> Date Range:
            </span>
            <div className="bi-pill-group">
              <button
                type="button"
                className={`bi-slicer-pill ${!activeFilters.some(f => f.column === dateCol.name) ? "active" : ""}`}
                onClick={() => applyDatePreset("all")}
              >
                All Time
              </button>
              <button
                type="button"
                className={`bi-slicer-pill ${activeFilters.some(f => f.presetLabel === "30D") ? "active" : ""}`}
                onClick={() => applyDatePreset("30d")}
              >
                Last 30D
              </button>
              <button
                type="button"
                className={`bi-slicer-pill ${activeFilters.some(f => f.presetLabel === "90D") ? "active" : ""}`}
                onClick={() => applyDatePreset("90d")}
              >
                90D
              </button>
              <button
                type="button"
                className={`bi-slicer-pill ${activeFilters.some(f => f.presetLabel === "YTD") ? "active" : ""}`}
                onClick={() => applyDatePreset("ytd")}
              >
                YTD
              </button>
            </div>
          </div>
        )}

        {/* Category Slicers */}
        {slicerDims.map(dim => {
          const dimMeta = dimensions.find(d => d.column === dim.name);
          const sampleVals = dimMeta?.values ? dimMeta.values.map(v => v.label) : (dim.sample_values || []);
          const isOpen = openDropdown === dim.name;
          const activeFilterObj = activeFilters.find(f => f.column === dim.name);
          const activeCount = Array.isArray(activeFilterObj?.value)
            ? activeFilterObj.value.length
            : activeFilterObj ? 1 : 0;

          return (
            <div key={dim.name} className="bi-slicer-dropdown-wrapper">
              <button
                type="button"
                className={`bi-slicer-dropdown-btn ${activeCount > 0 ? "has-filter" : ""}`}
                onClick={() => setOpenDropdown(isOpen ? null : dim.name)}
              >
                <span>{dim.original_name || dim.name}</span>
                {activeCount > 0 && <span className="bi-filter-count-badge">{activeCount}</span>}
                <ChevronDown size={12} />
              </button>

              {isOpen && (
                <div className="bi-slicer-dropdown-menu">
                  <div className="bi-dropdown-head">
                    <span>Filter {dim.original_name || dim.name}</span>
                    <button
                      type="button"
                      className="bi-clear-dim-btn"
                      onClick={() => onFilterChange(activeFilters.filter(f => f.column !== dim.name))}
                    >
                      Reset
                    </button>
                  </div>
                  <div className="bi-dropdown-list">
                    {sampleVals.slice(0, 10).map((val, idx) => {
                      const selected = isCategorySelected(dim.name, val);
                      return (
                        <div
                          key={idx}
                          className={`bi-dropdown-item ${selected ? "selected" : ""}`}
                          onClick={() => toggleCategoryFilter(dim.name, val)}
                        >
                          <div className={`bi-checkbox ${selected ? "checked" : ""}`}>
                            {selected && <Check size={11} />}
                          </div>
                          <span className="bi-item-text">{val}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Clear All Filters Button */}
        {hasAnyFilter && (
          <button
            type="button"
            className="bi-clear-all-btn"
            onClick={() => {
              if (onClearAllFilters) onClearAllFilters();
              if (onClearCrossFilter) onClearCrossFilter();
            }}
          >
            <RotateCcw size={12} />
            <span>Clear Filters</span>
          </button>
        )}
      </div>

      {/* Cross-Filter Alert Banner (if user clicked any chart element) */}
      {activeCrossFilter && (
        <div className="bi-cross-filter-banner">
          <div className="bi-banner-left">
            <span className="bi-banner-pulse" />
            <span className="bi-banner-title">Cross-Filter Active:</span>
            <span className="bi-banner-pill">
              {activeCrossFilter.column} = <strong>{String(activeCrossFilter.value)}</strong>
            </span>
            <span className="bi-banner-note">(All dashboard visualizations are filtered to this segment)</span>
          </div>
          <button type="button" className="bi-banner-clear-btn" onClick={onClearCrossFilter}>
            <X size={13} /> Reset Cross-Filter
          </button>
        </div>
      )}
    </div>
  );
}
