import React, { useState, useEffect } from "react";
import {
  Plus,
  RotateCcw,
  Palette,
  Printer,
  FileDown,
  Sparkles,
  LayoutGrid
} from "lucide-react";
import PowerBIVisualCard from "./PowerBIVisualCard";
import VisualBuilderModal from "./VisualBuilderModal";
import SlicerFilterBar from "./SlicerFilterBar";
import ReportPageManager from "./ReportPageManager";
import FullscreenVisualModal from "./FullscreenVisualModal";
import { api } from "../../lib/api";
import "./powerbi.css";

export default function PowerBIDashboard({
  datasetId = "demo-sales",
  schema = [],
  dimensions = [],
  baseCharts = [],
  kpis = [],
  profile = null,
  onNavigateToDataset = null
}) {
  // Theme palette
  const [paletteKey, setPaletteKey] = useState("power_bi");

  // Multi-page report state
  const [pages, setPages] = useState([]);
  const [activePageId, setActivePageId] = useState("page-1");

  // Slicers & Cross-filtering state
  const [activeFilters, setActiveFilters] = useState([]);
  const [activeCrossFilter, setActiveCrossFilter] = useState(null);

  // Modals state
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingVisual, setEditingVisual] = useState(null);
  const [fullscreenVisual, setFullscreenVisual] = useState(null);

  // Generate intelligent initial multi-page dashboard when dataset charts or schema change
  useEffect(() => {
    if (!baseCharts || baseCharts.length === 0) return;

    // Convert raw backend charts into enhanced Power BI visual items
    const allVisuals = baseCharts.map((chart, idx) => ({
      ...chart,
      id: chart.id || `visual-${idx}-${Date.now()}`,
      width: chart.width || (["kpi_card", "gauge"].includes(chart.kind) ? 4 : idx === 0 ? 8 : 6),
      kind: chart.kind || "column",
      title: chart.title || `Visual ${idx + 1}`,
      data: chart.data || [],
      initialData: chart.data || []
    }));

    // Split into 3 default pages
    // Page 1: Executive Summary
    const page1Visuals = allVisuals.slice(0, 4);
    // Page 2: Dimensional Breakdown
    const page2Visuals = allVisuals.slice(4, 8);
    // Page 3: Deep Dive & Diagnostics
    const page3Visuals = allVisuals.slice(8);

    setPages([
      {
        id: "page-1",
        title: "Executive Overview",
        visuals: page1Visuals.length > 0 ? page1Visuals : allVisuals
      },
      {
        id: "page-2",
        title: "Dimensional Breakdown",
        visuals: page2Visuals.length > 0 ? page2Visuals : allVisuals.slice(1, 5)
      },
      {
        id: "page-3",
        title: "Statistical Diagnostics",
        visuals: page3Visuals.length > 0 ? page3Visuals : allVisuals.slice(2, 6)
      }
    ]);
    setActivePageId("page-1");
  }, [baseCharts, datasetId]);

  // Dynamically update visuals when slicer filters or cross-filters change
  useEffect(() => {
    if (!datasetId || !activePage.visuals || activePage.visuals.length === 0) return;

    if (activeFilters.length === 0 && activeCrossFilter === null) {
      setPages(prev =>
        prev.map(p => {
          if (p.id !== activePageId) return p;
          const restored = p.visuals.map(v => ({
            ...v,
            data: v.initialData || v.data
          }));
          return { ...p, visuals: restored };
        })
      );
      return;
    }

    let cancelled = false;

    async function applyFiltersToPage() {
      try {
        const updated = await Promise.all(
          activePage.visuals.map(async visual => {
            const xCol = visual.source_columns?.[0] || visual.x_key;
            const yCol = visual.source_columns?.[1] || visual.y_key;
            if (!xCol) return visual;

            try {
              const res = await api(`/api/dataset/visualize/query?dataset_id=${encodeURIComponent(datasetId)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chart_type: visual.kind || visual.chart_type || "column",
                  x_col: xCol,
                  y_col: yCol,
                  date_hierarchy: visual.date_hierarchy || "auto",
                  filters: activeFilters,
                  cross_filter: activeCrossFilter
                })
              });
              if (res && res.data) {
                return {
                  ...visual,
                  data: res.data,
                  kpi_summary: res.kpi_summary || visual.kpi_summary
                };
              }
            } catch (err) {
              console.warn("Visual query update failed:", err);
            }
            return visual;
          })
        );

        if (!cancelled) {
          setPages(prev =>
            prev.map(p => (p.id === activePageId ? { ...p, visuals: updated } : p))
          );
        }
      } catch (err) {
        console.error("Filter update failed:", err);
      }
    }

    applyFiltersToPage();

    return () => {
      cancelled = true;
    };
  }, [activeFilters, activeCrossFilter, activePageId, datasetId]);

  // Current active page
  const activePage = pages.find(p => p.id === activePageId) || pages[0] || { visuals: [] };

  // Page Management Handlers
  function handleAddPage() {
    const newPageNum = pages.length + 1;
    const newPage = {
      id: `page-${Date.now()}`,
      title: `Page ${newPageNum}`,
      visuals: []
    };
    setPages(prev => [...prev, newPage]);
    setActivePageId(newPage.id);
  }

  function handleRenamePage(pageId, newTitle) {
    setPages(prev =>
      prev.map(p => (p.id === pageId ? { ...p, title: newTitle } : p))
    );
  }

  function handleDuplicatePage(pageId) {
    const target = pages.find(p => p.id === pageId);
    if (!target) return;
    const dup = {
      id: `page-${Date.now()}`,
      title: `${target.title} (Copy)`,
      visuals: target.visuals.map(v => ({ ...v, id: `visual-${Date.now()}-${Math.random()}` }))
    };
    setPages(prev => [...prev, dup]);
    setActivePageId(dup.id);
  }

  function handleDeletePage(pageId) {
    if (pages.length <= 1) return;
    const remaining = pages.filter(p => p.id !== pageId);
    setPages(remaining);
    setActivePageId(remaining[0].id);
  }

  // Visual CRUD in Active Page
  function handleSaveVisual(savedVisual) {
    setPages(prev =>
      prev.map(p => {
        if (p.id !== activePageId) return p;
        const exists = p.visuals.some(v => v.id === savedVisual.id);
        const nextVisuals = exists
          ? p.visuals.map(v => (v.id === savedVisual.id ? savedVisual : v))
          : [savedVisual, ...p.visuals];
        return { ...p, visuals: nextVisuals };
      })
    );
    setEditingVisual(null);
  }

  function handleDuplicateVisual(visual) {
    const dup = {
      ...visual,
      id: `visual-${Date.now()}`,
      title: `${visual.title} (Copy)`
    };
    setPages(prev =>
      prev.map(p => (p.id === activePageId ? { ...p, visuals: [...p.visuals, dup] } : p))
    );
  }

  function handleDeleteVisual(visualId) {
    setPages(prev =>
      prev.map(p =>
        p.id === activePageId
          ? { ...p, visuals: p.visuals.filter(v => v.id !== visualId) }
          : p
      )
    );
  }

  function handleResizeVisual(visualId, newWidth) {
    setPages(prev =>
      prev.map(p =>
        p.id === activePageId
          ? {
              ...p,
              visuals: p.visuals.map(v => (v.id === visualId ? { ...v, width: newWidth } : v))
            }
          : p
      )
    );
  }

  function handleMoveVisual(visualId, direction) {
    setPages(prev =>
      prev.map(p => {
        if (p.id !== activePageId) return p;
        const index = p.visuals.findIndex(v => v.id === visualId);
        if (index < 0) return p;
        const targetIndex = direction === "left" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= p.visuals.length) return p;
        const nextVisuals = [...p.visuals];
        const [moved] = nextVisuals.splice(index, 1);
        nextVisuals.splice(targetIndex, 0, moved);
        return { ...p, visuals: nextVisuals };
      })
    );
  }

  // Cross-filtering trigger
  function handleCrossFilter(filterObj) {
    if (
      activeCrossFilter &&
      activeCrossFilter.column === filterObj.column &&
      String(activeCrossFilter.value) === String(filterObj.value)
    ) {
      setActiveCrossFilter(null);
    } else {
      setActiveCrossFilter(filterObj);
    }
  }

  // Hierarchy Drill Handlers
  async function handleDrillDown(visual) {
    const currentGranularity = visual.date_hierarchy || "auto";
    const nextGranularity =
      currentGranularity === "year"
        ? "quarter"
        : currentGranularity === "quarter"
        ? "month"
        : "day";

    try {
      const res = await api(`/api/dataset/visualize/query?dataset_id=${encodeURIComponent(datasetId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chart_type: visual.kind || visual.chart_type,
          x_col: visual.x_key || visual.source_columns?.[0],
          y_col: visual.y_key || visual.source_columns?.[1],
          date_hierarchy: nextGranularity,
          filters: activeFilters,
          cross_filter: activeCrossFilter
        })
      });

      handleSaveVisual({
        ...visual,
        ...res,
        date_hierarchy: nextGranularity,
        title: `${visual.title} (${nextGranularity.toUpperCase()})`
      });
    } catch (err) {
      console.error("Drill-down failed:", err);
    }
  }

  async function handleDrillUp(visual) {
    const currentGranularity = visual.date_hierarchy || "month";
    const nextGranularity =
      currentGranularity === "day"
        ? "month"
        : currentGranularity === "month"
        ? "quarter"
        : "year";

    try {
      const res = await api(`/api/dataset/visualize/query?dataset_id=${encodeURIComponent(datasetId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chart_type: visual.kind || visual.chart_type,
          x_col: visual.x_key || visual.source_columns?.[0],
          y_col: visual.y_key || visual.source_columns?.[1],
          date_hierarchy: nextGranularity,
          filters: activeFilters,
          cross_filter: activeCrossFilter
        })
      });

      handleSaveVisual({
        ...visual,
        ...res,
        date_hierarchy: nextGranularity,
        title: `${visual.title} (${nextGranularity.toUpperCase()})`
      });
    } catch (err) {
      console.error("Drill-up failed:", err);
    }
  }

  // Export entire dashboard configuration
  function exportDashboardJson() {
    const config = {
      dataset_id: datasetId,
      exported_at: new Date().toISOString(),
      palette: paletteKey,
      pages
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dashboard_${datasetId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="bi-dashboard-container">
      {/* Top Action Bar */}
      <div className="bi-top-action-bar">
        <div className="bi-top-actions-left">
          <button
            type="button"
            className="bi-btn-primary"
            onClick={() => {
              setEditingVisual(null);
              setBuilderOpen(true);
            }}
          >
            <Plus size={15} /> Add Visual
          </button>

          <button
            type="button"
            className="bi-btn-secondary"
            onClick={() => {
              // Trigger reload / reset to default
              setActiveFilters([]);
              setActiveCrossFilter(null);
            }}
          >
            <RotateCcw size={13} /> Reset View
          </button>
        </div>

        <div className="bi-top-actions-right">
          {/* Palette Selector */}
          <div className="bi-palette-selector">
            <Palette size={14} className="bi-icon-teal" />
            <select
              value={paletteKey}
              onChange={e => setPaletteKey(e.target.value)}
              className="bi-select-ghost"
            >
              <option value="power_bi">Classic Power BI</option>
              <option value="emerald">Emerald Horizon</option>
              <option value="neon">Cyberpunk Neon</option>
              <option value="amber">Warm Amber</option>
              <option value="ocean">Ocean Breeze</option>
            </select>
          </div>

          {/* Export PDF / Print */}
          <button
            type="button"
            className="bi-btn-secondary"
            title="Export Dashboard PDF"
            onClick={() => window.print()}
          >
            <Printer size={14} /> Print / PDF
          </button>

          {/* Export JSON */}
          <button
            type="button"
            className="bi-btn-secondary"
            title="Export Dashboard Config"
            onClick={exportDashboardJson}
          >
            <FileDown size={14} /> Export JSON
          </button>
        </div>
      </div>

      {/* Slicers & Interactive Filters Bar */}
      <SlicerFilterBar
        schema={schema}
        dimensions={dimensions}
        activeFilters={activeFilters}
        onFilterChange={setActiveFilters}
        activeCrossFilter={activeCrossFilter}
        onClearCrossFilter={() => setActiveCrossFilter(null)}
        onClearAllFilters={() => {
          setActiveFilters([]);
          setActiveCrossFilter(null);
        }}
      />

      {/* Report Pages Navigation Tabs */}
      <ReportPageManager
        pages={pages}
        activePageId={activePageId}
        onSelectPage={setActivePageId}
        onAddPage={handleAddPage}
        onRenamePage={handleRenamePage}
        onDuplicatePage={handleDuplicatePage}
        onDeletePage={handleDeletePage}
      />

      {/* Visualizations Grid for Active Page */}
      <div className="bi-visual-grid">
        {activePage.visuals && activePage.visuals.length > 0 ? (
          activePage.visuals.map(visual => (
            <PowerBIVisualCard
              key={visual.id}
              visual={visual}
              paletteKey={paletteKey}
              activeCrossFilter={activeCrossFilter}
              onCrossFilter={handleCrossFilter}
              onEdit={v => {
                setEditingVisual(v);
                setBuilderOpen(true);
              }}
              onDuplicate={handleDuplicateVisual}
              onDelete={handleDeleteVisual}
              onResize={handleResizeVisual}
              onMoveLeft={id => handleMoveVisual(id, "left")}
              onMoveRight={id => handleMoveVisual(id, "right")}
              onFullscreen={setFullscreenVisual}
              onDrillDown={handleDrillDown}
              onDrillUp={handleDrillUp}
            />
          ))
        ) : (
          <div className="col-span-12 bi-empty-page-state">
            <LayoutGrid size={36} className="bi-empty-icon" />
            <h3>This dashboard page is empty</h3>
            <p>Click "Add Visual" to design and build a new chart for this report page.</p>
            <button
              type="button"
              className="bi-btn-primary"
              onClick={() => {
                setEditingVisual(null);
                setBuilderOpen(true);
              }}
            >
              <Plus size={15} /> Add First Visual
            </button>
          </div>
        )}
      </div>

      {/* Visual Builder Modal */}
      {builderOpen && (
        <VisualBuilderModal
          isOpen={builderOpen}
          onClose={() => {
            setBuilderOpen(false);
            setEditingVisual(null);
          }}
          onSave={handleSaveVisual}
          initialVisual={editingVisual}
          schema={schema}
          datasetId={datasetId}
        />
      )}

      {/* Fullscreen Inspection Modal */}
      {fullscreenVisual && (
        <FullscreenVisualModal
          visual={fullscreenVisual}
          paletteKey={paletteKey}
          onClose={() => setFullscreenVisual(null)}
        />
      )}
    </div>
  );
}
