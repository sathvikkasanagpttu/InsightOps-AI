import React, { useState, useEffect, useRef } from "react";
import { Filter, Calendar, Sliders, X, RotateCcw, ChevronDown, Check, Search } from "lucide-react";
import { formatNumber } from "./visualUtils";

const DIMENSION_SEMANTICS_LIST = [
  "category", "region", "status", "channel", "department", "country",
  "source", "location", "delivery_mode", "person", "gender", "segment",
  "priority", "stage", "type"
];

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
  const [searchQueries, setSearchQueries] = useState({});
  const barRef = useRef(null);

  // Close dropdown on click outside or Escape
  useEffect(() => {
    function handleClickOutside(event) {
      if (barRef.current && !barRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpenDropdown(null);
      }
    }

    if (openDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openDropdown]);

  // Identify top categorical dimensions for slicers (up to 8 dimensions)
  const slicerDims = schema.filter(
    col =>
      DIMENSION_SEMANTICS_LIST.includes(col.semantic_type?.toLowerCase()) ||
      (col.unique_count >= 2 && col.unique_count <= 40 && !["datetime", "identifier", "email", "phone"].includes(col.semantic_type))
  ).slice(0, 8);

  // Identify date column for date slicer
  const dateCol = schema.find(c => c.semantic_type === "datetime" || c.inferred_type === "datetime");

  // Get distinct values for a dimension
  function getDimensionValues(dim) {
    const dimMeta = dimensions.find(
      d => d.column?.toLowerCase() === dim.name?.toLowerCase() ||
           d.column?.toLowerCase() === dim.original_name?.toLowerCase()
    );

    if (dimMeta?.values && dimMeta.values.length > 0) {
      return dimMeta.values.map(v => typeof v === "object" ? v.label : String(v));
    }
    if (dim.sample_values && dim.sample_values.length > 0) {
      return dim.sample_values.map(String);
    }
    return [];
  }

  // Check if a category value is active in filters
  function isCategorySelected(colName, val) {
    const found = activeFilters.find(f => f.column === colName);
    if (!found) return false;
    if (found.operator === "in" && Array.isArray(found.value)) {
      return found.value.map(String).includes(String(val));
    }
    return String(found.value) === String(val);
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

  function selectAllValues(colName, vals) {
    let nextList = [...activeFilters.filter(f => f.column !== colName)];
    nextList.push({ column: colName, operator: "in", value: vals });
    onFilterChange(nextList);
  }

  function clearDimFilter(colName) {
    onFilterChange(activeFilters.filter(f => f.column !== colName));
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
    <div className="bi-slicer-container" ref={barRef}>
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
        {slicerDims.map((dim, dimIdx) => {
          const allVals = getDimensionValues(dim);
          const isOpen = openDropdown === dim.name;
          const activeFilterObj = activeFilters.find(f => f.column === dim.name);
          const activeCount = Array.isArray(activeFilterObj?.value)
            ? activeFilterObj.value.length
            : activeFilterObj ? 1 : 0;

          const searchQuery = searchQueries[dim.name] || "";
          const filteredVals = searchQuery.trim()
            ? allVals.filter(v => String(v).toLowerCase().includes(searchQuery.toLowerCase()))
            : allVals;

          // Align right if it's among the last 3 items
          const alignRight = dimIdx >= Math.max(1, slicerDims.length - 2);

          return (
            <div
              key={dim.name}
              className={`bi-slicer-dropdown-wrapper ${isOpen ? "open" : ""}`}
            >
              <button
                type="button"
                className={`bi-slicer-dropdown-btn ${activeCount > 0 ? "has-filter" : ""} ${isOpen ? "active-open" : ""}`}
                onClick={() => {
                  setOpenDropdown(isOpen ? null : dim.name);
                  if (!isOpen) {
                    setSearchQueries(prev => ({ ...prev, [dim.name]: "" }));
                  }
                }}
              >
                <span>{dim.original_name || dim.name}</span>
                {activeCount > 0 && <span className="bi-filter-count-badge">{activeCount}</span>}
                <ChevronDown size={12} className={isOpen ? "rotate-180" : ""} />
              </button>

              {isOpen && (
                <div className={`bi-slicer-dropdown-menu ${alignRight ? "align-right" : ""}`}>
                  <div className="bi-dropdown-head">
                    <span className="bi-dropdown-title">
                      Filter {dim.original_name || dim.name}
                      {activeCount > 0 && <small> ({activeCount} active)</small>}
                    </span>
                    <button
                      type="button"
                      className="bi-clear-dim-btn"
                      onClick={() => clearDimFilter(dim.name)}
                      disabled={activeCount === 0}
                    >
                      Reset
                    </button>
                  </div>

                  {/* Search box within dropdown */}
                  {allVals.length > 5 && (
                    <div className="bi-dropdown-search-row">
                      <Search size={11} className="bi-search-icon" />
                      <input
                        type="text"
                        className="bi-dropdown-search-input"
                        placeholder="Search values..."
                        value={searchQuery}
                        onChange={e => setSearchQueries({ ...searchQueries, [dim.name]: e.target.value })}
                        autoFocus
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          className="bi-search-clear"
                          onClick={() => setSearchQueries({ ...searchQueries, [dim.name]: "" })}
                        >
                          <X size={10} />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Quick Select All / Clear action bar */}
                  <div className="bi-dropdown-quick-bar">
                    <button
                      type="button"
                      className="bi-quick-btn"
                      onClick={() => selectAllValues(dim.name, allVals)}
                    >
                      Select All
                    </button>
                    <span className="bi-quick-sep">·</span>
                    <button
                      type="button"
                      className="bi-quick-btn"
                      onClick={() => clearDimFilter(dim.name)}
                    >
                      Deselect All
                    </button>
                  </div>

                  {/* Checkbox List */}
                  <div className="bi-dropdown-list">
                    {filteredVals.length > 0 ? (
                      filteredVals.map((val, idx) => {
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
                            <span className="bi-item-text" title={String(val)}>{val}</span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="bi-dropdown-empty">No matching values</div>
                    )}
                  </div>

                  {/* Footer with summary */}
                  <div className="bi-dropdown-footer">
                    <span>{filteredVals.length} available</span>
                    {activeCount > 0 && <span className="bi-selected-note">{activeCount} selected</span>}
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
