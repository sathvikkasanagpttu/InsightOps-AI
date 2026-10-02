import React, { useEffect, useRef, useState } from "react";
import { Search, X, FileText, Database, Layers, Bell, ArrowRight, CornerDownLeft } from "lucide-react";
import { api } from "../../lib/api";

export default function GlobalSearchBar({ isOpen, onClose, onNavigate }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api(`/api/search?q=${encodeURIComponent(query)}`);
        setResults(res.results || {});
      } catch (err) {
        console.warn("Global search error:", err);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalResults = results
    ? (results.reports?.length || 0) +
      (results.datasets?.length || 0) +
      (results.workspaces?.length || 0) +
      (results.alerts?.length || 0)
    : 0;

  return (
    <div className="saas-modal-backdrop" onClick={onClose}>
      <div className="saas-modal global-search-modal" onClick={e => e.stopPropagation()}>
        <div className="global-search-input-wrap">
          <Search size={20} color="#e6c348" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search reports, datasets, workspaces, alert rules... (Press Esc to close)"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button className="text-button" onClick={() => setQuery("")} aria-label="Clear query">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="search-results-list">
          {loading && (
            <div style={{ padding: "20px", textAlign: "center", color: "#a49d89" }}>
              Searching InsightOps AI...
            </div>
          )}

          {!loading && query && totalResults === 0 && (
            <div style={{ padding: "24px", textAlign: "center", color: "#8a8370" }}>
              No matches found for "{query}". Try searching for reports, sales, or workspaces.
            </div>
          )}

          {!query && (
            <div style={{ padding: "20px", color: "#8a8370", fontSize: "13px" }}>
              <p style={{ margin: "0 0 8px 0", fontWeight: "600", color: "#a49d89" }}>Quick Navigation</p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <span className="saas-badge viewer" onClick={() => { onNavigate("visuals"); onClose(); }} style={{ cursor: "pointer" }}>⚡ Power BI Studio</span>
                <span className="saas-badge viewer" onClick={() => { onNavigate("data"); onClose(); }} style={{ cursor: "pointer" }}>📁 Data Studio</span>
                <span className="saas-badge viewer" onClick={() => { onNavigate("reports"); onClose(); }} style={{ cursor: "pointer" }}>📊 Reports Library</span>
                <span className="saas-badge viewer" onClick={() => { onNavigate("alerts"); onClose(); }} style={{ cursor: "pointer" }}>🔔 Alerts Center</span>
                <span className="saas-badge viewer" onClick={() => { onNavigate("workspaces"); onClose(); }} style={{ cursor: "pointer" }}>🏢 Workspaces</span>
              </div>
            </div>
          )}

          {results?.reports?.length > 0 && (
            <div>
              <div className="search-result-group-title">Reports ({results.reports.length})</div>
              {results.reports.map(rep => (
                <div
                  key={rep.id}
                  className="search-result-item"
                  onClick={() => {
                    onNavigate("reports", { reportId: rep.id });
                    onClose();
                  }}
                >
                  <div className="search-result-title">
                    <FileText size={16} color="#e6c348" />
                    <span>{rep.title}</span>
                  </div>
                  <span className="saas-badge viewer" style={{ fontSize: "10px" }}>{rep.schedule || "Report"}</span>
                </div>
              ))}
            </div>
          )}

          {results?.datasets?.length > 0 && (
            <div>
              <div className="search-result-group-title">Datasets ({results.datasets.length})</div>
              {results.datasets.map(ds => (
                <div
                  key={ds.id}
                  className="search-result-item"
                  onClick={() => {
                    onNavigate("data", { datasetId: ds.id });
                    onClose();
                  }}
                >
                  <div className="search-result-title">
                    <Database size={16} color="#60a5fa" />
                    <span>{ds.filename || ds.name}</span>
                  </div>
                  <span style={{ fontSize: "11px", color: "#a49d89" }}>{ds.row_count ? `${ds.row_count} rows` : "Dataset"}</span>
                </div>
              ))}
            </div>
          )}

          {results?.workspaces?.length > 0 && (
            <div>
              <div className="search-result-group-title">Workspaces ({results.workspaces.length})</div>
              {results.workspaces.map(ws => (
                <div
                  key={ws.id}
                  className="search-result-item"
                  onClick={() => {
                    onNavigate("workspaces", { workspaceId: ws.id });
                    onClose();
                  }}
                >
                  <div className="search-result-title">
                    <Layers size={16} color="#34d399" />
                    <span>{ws.name}</span>
                  </div>
                  <span className="saas-badge admin" style={{ fontSize: "10px" }}>Workspace</span>
                </div>
              ))}
            </div>
          )}

          {results?.alerts?.length > 0 && (
            <div>
              <div className="search-result-group-title">Alert Rules ({results.alerts.length})</div>
              {results.alerts.map(al => (
                <div
                  key={al.id}
                  className="search-result-item"
                  onClick={() => {
                    onNavigate("alerts", { alertId: al.id });
                    onClose();
                  }}
                >
                  <div className="search-result-title">
                    <Bell size={16} color="#f87171" />
                    <span>{al.name}</span>
                  </div>
                  <span className={`saas-badge ${al.severity}`}>{al.severity}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
