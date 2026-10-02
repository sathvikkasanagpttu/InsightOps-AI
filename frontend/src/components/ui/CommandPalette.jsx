import React, { useState, useEffect, useRef } from "react";
import {
  Search, BarChart3, Database, FileText, BrainCircuit, TrendingUp,
  AlertTriangle, Bell, Layers, Activity, Sliders, Moon, Sun, Upload,
  Download, ArrowRight, CornerDownLeft, Sparkles, X
} from "lucide-react";

/**
 * CommandPalette - Enterprise Command Interface (⌘K / Ctrl+K)
 */
export default function CommandPalette({
  isOpen,
  onClose,
  onNavigate,
  onAction,
  activeDataset,
  theme,
  onToggleTheme,
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  const commandItems = [
    // Navigation Views
    { id: "overview", label: "Go to Dashboard Overview", category: "Navigation", icon: BarChart3, action: () => onNavigate?.("overview") },
    { id: "visuals", label: "Go to BI Studio (Power BI Visuals)", category: "Navigation", icon: BarChart3, action: () => onNavigate?.("visuals") },
    { id: "data", label: "Go to Data Studio & Profiling", category: "Navigation", icon: Database, action: () => onNavigate?.("data") },
    { id: "reports", label: "Go to Reports Manager", category: "Navigation", icon: FileText, action: () => onNavigate?.("reports") },
    { id: "analyst", label: "Ask AI Analyst", category: "Navigation", icon: BrainCircuit, action: () => onNavigate?.("analyst") },
    { id: "forecast", label: "View Predictive Forecasts", category: "Navigation", icon: TrendingUp, action: () => onNavigate?.("forecast") },
    { id: "anomalies", label: "View Detected Anomalies", category: "Navigation", icon: AlertTriangle, action: () => onNavigate?.("anomalies") },
    { id: "alerts", label: "Go to Alerts Center", category: "Navigation", icon: Bell, action: () => onNavigate?.("alerts") },
    { id: "workspaces", label: "Manage Workspaces & Roles", category: "Navigation", icon: Layers, action: () => onNavigate?.("workspaces") },
    { id: "activity", label: "View Audit & Activity Log", category: "Navigation", icon: Activity, action: () => onNavigate?.("activity") },
    { id: "settings", label: "Open Settings & Preferences", category: "Navigation", icon: Sliders, action: () => onNavigate?.("settings") },

    // Actions
    { id: "upload", label: "Upload New Dataset (CSV / Excel)", category: "Actions", icon: Upload, action: () => onAction?.("upload") },
    { id: "export-clean", label: "Download Cleaned CSV", category: "Actions", icon: Download, action: () => onAction?.("export-clean") },
    { id: "view-diff", label: "View Data Cleaning Diff Report", category: "Actions", icon: Sparkles, action: () => onAction?.("view-diff") },
    { id: "toggle-theme", label: `Switch to ${theme === "light" ? "Dark" : "Light"} Theme`, category: "Preferences", icon: theme === "light" ? Moon : Sun, action: () => onToggleTheme?.() },

    // Sample Datasets
    { id: "ds-sales", label: "Load Sample: Sales & Revenue", category: "Sample Datasets", icon: Database, action: () => onAction?.("load-sample", "sales.csv") },
    { id: "ds-hr", label: "Load Sample: HR & Workforce", category: "Sample Datasets", icon: Database, action: () => onAction?.("load-sample", "hr.csv") },
    { id: "ds-ecom", label: "Load Sample: E-Commerce Orders", category: "Sample Datasets", icon: Database, action: () => onAction?.("load-sample", "ecommerce.csv") },
    { id: "ds-finance", label: "Load Sample: Finance Cash Flow", category: "Sample Datasets", icon: Database, action: () => onAction?.("load-sample", "finance.csv") },
    { id: "ds-health", label: "Load Sample: Healthcare Patients", category: "Sample Datasets", icon: Database, action: () => onAction?.("load-sample", "healthcare.csv") },
  ];

  // Filter commands by search query
  const filtered = commandItems.filter(item => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      item.label.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard navigation inside palette
  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((idx) => (idx + 1) % Math.max(filtered.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((idx) => (idx - 1 + filtered.length) % Math.max(filtered.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = filtered[selectedIndex];
      if (selected) {
        selected.action();
        onClose();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="command-palette-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="command-palette-card" role="dialog" aria-modal="true" aria-label="Command Palette">
        <div className="command-input-row">
          <Search size={18} className="command-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="command-input"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, search views, or switch datasets..."
          />
          <button type="button" className="command-close-btn" onClick={onClose} aria-label="Close command palette">
            <X size={16} />
          </button>
        </div>

        <div className="command-results-list" role="listbox">
          {filtered.length === 0 ? (
            <div className="command-empty-state">
              <p>No matching commands or views found for "{query}".</p>
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = item.icon;

              return (
                <div
                  key={item.id}
                  className={`command-item ${isSelected ? "selected" : ""}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <span className="command-item-icon">
                    <Icon size={16} />
                  </span>
                  <div className="command-item-info">
                    <span className="command-item-label">{item.label}</span>
                    <span className="command-item-category">{item.category}</span>
                  </div>
                  {isSelected && (
                    <span className="command-enter-indicator">
                      <CornerDownLeft size={13} /> Enter
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="command-palette-footer">
          <div className="command-keys-hint">
            <span><kbd>↑</kbd><kbd>↓</kbd> to navigate</span>
            <span><kbd>↵</kbd> to select</span>
            <span><kbd>esc</kbd> to dismiss</span>
          </div>
          {activeDataset && (
            <span className="command-active-ds">
              Active: <b>{activeDataset}</b>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
