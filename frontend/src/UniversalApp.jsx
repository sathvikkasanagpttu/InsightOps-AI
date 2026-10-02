import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle, ArrowDown, ArrowUp, BarChart3, BrainCircuit, Check, CheckCircle2,
  ChevronDown, ChevronLeft, ChevronRight, Copy, Database, Download, Eye, FileSpreadsheet,
  FileText, Filter, HelpCircle, Info, Layers, LayoutGrid, LogOut, Maximize2, RefreshCw, Search,
  Send, Share2, ShieldCheck, Sliders, Sparkles, Table, Trash2, TrendingDown, TrendingUp,
  Upload, X, Zap
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis
} from "recharts";
import { api } from "./lib/api";
import PowerBIDashboard from "./components/visuals/PowerBIDashboard";
import "./universal.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const navItems = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "visuals", label: "BI Studio", icon: LayoutGrid },
  { id: "data", label: "Data Studio", icon: Database },
  { id: "analyst", label: "AI Analyst", icon: BrainCircuit },
  { id: "explore", label: "Explore", icon: Search },
  { id: "forecast", label: "Forecasts", icon: TrendingUp },
  { id: "anomalies", label: "Anomalies", icon: AlertTriangle },
  { id: "alerts", label: "Alerts", icon: Info },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "dataset", label: "Dataset", icon: Layers },
  { id: "settings", label: "Settings", icon: Sliders }
];

const studioSections = [
  "Overview", "Schema", "Quality", "Missing Values", "Duplicates",
  "Data Types", "Sensitive Data", "Cleaning Actions", "Data Table"
];

const edaTabs = [
  "Overview", "Distributions", "Correlations", "Relationships", "Categories", "Time Series", "Outliers"
];

const sampleDatasets = [
  { id: "sales.csv", label: "Sales & Revenue", domain: "Sales" },
  { id: "hr.csv", label: "HR & Workforce", domain: "HR" },
  { id: "ecommerce.csv", label: "E-Commerce", domain: "E-commerce" },
  { id: "finance.csv", label: "Finance & Cash Flow", domain: "Finance" },
  { id: "healthcare.csv", label: "Healthcare & Patients", domain: "Healthcare" },
];

const analystQuestions = [
  "Why did sales decline?",
  "What is the largest category?",
  "Which region performs best?",
  "Show unusual values",
  "What columns have missing data?",
  "What is the average salary?",
  "What are the strongest correlations?",
  "Forecast next month",
  "Summarize this dataset"
];

const uploadStages = ["File uploaded", "Schema detected", "Data cleaned", "Quality checked", "Analytics generated"];

function formatValue(kpi, compact = false) {
  const value = Number(kpi.value ?? 0);
  const countFormat = compact ? { notation: "compact", maximumFractionDigits: 1 } : { maximumFractionDigits: 1 };
  if (kpi.format === "currency") {
    return `₹${value.toLocaleString("en-IN", compact ? { notation: "compact", maximumFractionDigits: 1 } : { maximumFractionDigits: 2 })}`;
  }
  if (kpi.format === "percent") {
    return `${value.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`;
  }
  return value.toLocaleString("en-IN", countFormat);
}

function KpiCard({ item, compact }) {
  return (
    <div className="stat glass" title={item.calculation ? `Formula: ${item.calculation}` : undefined}>
      <div className="icon"><Database size={18} /></div>
      <div>
        <span>{item.label}</span>
        <strong>{formatValue(item, compact)}</strong>
        <small>{item.source_columns?.length ? item.source_columns.join(", ") : "Dataset profile"}</small>
      </div>
    </div>
  );
}

function ChartPanel({ chart }) {
  const line = chart.kind === "line" || chart.kind === "area";
  const pie = chart.kind === "pie";
  const scatter = chart.kind === "scatter";
  const histogram = chart.kind === "histogram";
  const palette = ["#e6c348", "#b98d28", "#f0cf55", "#8d7132", "#d8bb68", "#75602b", "#5cdbb5", "#ffaa5a"];

  const formatter = value => {
    if (chart.y_label === "revenue") {
      return `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
    }
    return Number(value).toLocaleString("en-IN", { maximumFractionDigits: 1 });
  };

  return (
    <section className="panel glass data-chart-panel">
      <span>{line ? "TIME SERIES" : (scatter ? "RELATIONSHIP" : (histogram ? "DISTRIBUTION" : "DIMENSION ANALYSIS"))}</span>
      <h2>{chart.title}</h2>
      <div className="chart">
        <ResponsiveContainer>
          {line ? (
            <AreaChart data={chart.data}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#e6c348" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#e6c348" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#ffffff10" vertical={false} />
              <XAxis dataKey={chart.x_key} tick={{ fill: "#8291a8", fontSize: 10 }} />
              <YAxis hide />
              <Tooltip formatter={formatter} contentStyle={{ background: "#0c1827", border: "1px solid #ffffff20", borderRadius: 8 }} />
              <Area type="monotone" dataKey={chart.y_key} name={chart.y_label === "revenue" ? "Revenue" : "Records"} stroke="#e6c348" strokeWidth={3} fillOpacity={1} fill="url(#areaGrad)" />
            </AreaChart>
          ) : pie ? (
            <PieChart>
              <Tooltip formatter={formatter} contentStyle={{ background: "#0c1827", border: "1px solid #ffffff20", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#a49d89" }} />
              <Pie data={chart.data} dataKey="value" nameKey="label" innerRadius={45} outerRadius={78} paddingAngle={2}>
                {chart.data.map((item, index) => <Cell key={item.label || index} fill={palette[index % palette.length]} />)}
              </Pie>
            </PieChart>
          ) : scatter ? (
            <ScatterChart>
              <CartesianGrid stroke="#ffffff10" />
              <XAxis type="number" dataKey="x" name={chart.x_label || "X"} tick={{ fill: "#a49d89", fontSize: 10 }} />
              <YAxis type="number" dataKey="y" name={chart.y_label || "Y"} tick={{ fill: "#a49d89", fontSize: 10 }} />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ background: "#0c1827", border: "1px solid #ffffff20", borderRadius: 8 }} />
              <Scatter name={`${chart.x_label || "X"} / ${chart.y_label || "Y"}`} data={chart.data} fill="#e6c348" />
            </ScatterChart>
          ) : (
            <BarChart data={chart.data}>
              <CartesianGrid stroke="#ffffff10" vertical={false} />
              <XAxis dataKey={chart.x_key} tick={{ fill: "#8291a8", fontSize: 10 }} />
              <YAxis hide allowDecimals={false} />
              <Tooltip formatter={formatter} contentStyle={{ background: "#0c1827", border: "1px solid #ffffff20", borderRadius: 8 }} />
              <Bar dataKey={chart.y_key} name={chart.y_label === "revenue" ? "Revenue" : "Records"} fill="#e6c348" radius={[5, 5, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <small className="source-note">Source: {chart.source_columns?.join(", ") || "Calculated measure"}</small>
    </section>
  );
}

export default function UniversalApp({ onSignOut }) {
  const [activeView, setActiveView] = useState("overview");
  const [activeSection, setActiveSection] = useState("Overview");
  const [edaTab, setEdaTab] = useState("Overview");
  const [datasetId, setDatasetId] = useState(() => localStorage.getItem("insightops.datasetId") || "demo-sales");

  // Dataset analysis states
  const [profile, setProfile] = useState(null);
  const [schema, setSchema] = useState([]);
  const [quality, setQuality] = useState(null);
  const [kpis, setKpis] = useState([]);
  const [charts, setCharts] = useState([]);
  const [insights, setInsights] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [anomalies, setAnomalies] = useState([]);

  // AI Analyst state
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState("");

  // Loading, upload & preview states
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [stagedFile, setStagedFile] = useState(null);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [uploadReady, setUploadReady] = useState(false);
  const [error, setError] = useState("");

  // Filter & table explorer states
  const [search, setSearch] = useState("");
  const [semanticFilter, setSemanticFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [tablePage, setTablePage] = useState(1);
  const [tableSearch, setTableSearch] = useState("");
  const [tableSort, setTableSort] = useState("");
  const [tableSortOrder, setTableSortOrder] = useState("asc");
  const [tableData, setTableData] = useState(null);
  const [hiddenColumns, setHiddenColumns] = useState([]);
  const [compactNumbers, setCompactNumbers] = useState(() => localStorage.getItem("insightops.compactNumbers") === "true");

  // EDA interactive selectors
  const [selectedDistCol, setSelectedDistCol] = useState("");
  const [selectedScatterX, setSelectedScatterX] = useState("");
  const [selectedScatterY, setSelectedScatterY] = useState("");

  // Modals & drawers
  const [viewChangesOpen, setViewChangesOpen] = useState(false);
  const [investigatingAnomaly, setInvestigatingAnomaly] = useState(null);
  const [toasts, setToasts] = useState([]);

  const fileInput = useRef(null);
  const datasetQuery = `?dataset_id=${encodeURIComponent(datasetId)}`;

  function addToast(message, type = "success") {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }

  async function loadDataset(id) {
    setLoading(true);
    setError("");
    try {
      const query = `?dataset_id=${encodeURIComponent(id)}`;
      const [nextProfile, nextSchema, nextQuality, nextKpis, nextCharts, nextInsights, nextForecast, nextAlerts, nextAnomalies] = await Promise.all([
        api(`/api/dataset/profile${query}`),
        api(`/api/dataset/schema${query}`),
        api(`/api/dataset/quality${query}`),
        api(`/api/dataset/kpis${query}`),
        api(`/api/dataset/charts${query}`),
        api(`/api/dataset/insights${query}`),
        api(`/api/dataset/forecast${query}`),
        api(`/api/dataset/alerts${query}`),
        api(`/api/datasets/${encodeURIComponent(id)}/anomalies`).catch(() => [])
      ]);
      setProfile(nextProfile);
      setSchema(nextSchema.columns || []);
      setQuality(nextQuality);
      setKpis(nextKpis.kpis || []);
      setCharts(nextCharts || []);
      setInsights(nextInsights || []);
      setForecast(nextForecast);
      setAlerts(nextAlerts || []);
      setAnomalies(nextAnomalies || nextProfile.anomalies || []);

      // Defaults for EDA
      const numCols = (nextSchema.columns || []).filter(c => ["numeric", "currency", "percentage"].includes(c.semantic_type));
      if (numCols.length > 0) {
        setSelectedDistCol(numCols[0].name);
        setSelectedScatterX(numCols[0].name);
        setSelectedScatterY(numCols.length > 1 ? numCols[1].name : numCols[0].name);
      }
    } catch (loadError) {
      if (id !== "demo-sales" && loadError.message.includes("not found")) {
        localStorage.removeItem("insightops.datasetId");
        setDatasetId("demo-sales");
      } else {
        setError(loadError.message);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDataset(datasetId);
  }, [datasetId]);

  async function previewFile(file, sheet = "") {
    setPreviewing(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      if (sheet) form.append("sheet_name", sheet);
      const result = await api("/api/datasets/preview", { method: "POST", body: form });
      setPreview(result);
      setSelectedSheet(result.selected_sheet || "");
    } catch (previewError) {
      setError(previewError.message);
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  }

  async function selectDatasetFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["csv", "xlsx", "xls"].includes(extension)) {
      setError("Please choose a valid CSV, XLSX, or XLS dataset.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("Files must be 50 MB or smaller.");
      return;
    }
    setStagedFile(file);
    setPreview(null);
    await previewFile(file);
  }

  async function analyzeStagedDataset() {
    if (!stagedFile) return;
    setUploading(true);
    setUploadReady(false);
    setError("");
    try {
      const form = new FormData();
      form.append("file", stagedFile);
      if (selectedSheet) form.append("sheet_name", selectedSheet);
      const result = await api("/api/datasets/upload", { method: "POST", body: form });
      localStorage.setItem("insightops.datasetId", result.dataset_id);
      setDatasetId(result.dataset_id);
      setActiveView("overview");
      setActiveSection("Overview");
      setPreview(null);
      setStagedFile(null);
      setUploadReady(true);
      addToast(`Dataset "${result.filename}" ingested and analyzed successfully.`);
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setUploading(false);
    }
  }

  async function loadSampleDataset(filename) {
    setUploading(true);
    setError("");
    try {
      // Fetch sample dataset from public/static or backend route
      const response = await fetch(`/data/sample/${filename}`);
      let blob;
      if (response.ok) {
        blob = await response.blob();
      } else {
        // Fallback: upload trigger with sample name
        throw new Error("Loading bundled sample...");
      }
      const form = new FormData();
      form.append("file", blob, filename);
      const result = await api("/api/datasets/upload", { method: "POST", body: form });
      localStorage.setItem("insightops.datasetId", result.dataset_id);
      setDatasetId(result.dataset_id);
      setActiveView("overview");
      addToast(`Switched to sample dataset: ${filename}`);
    } catch (err) {
      // If client cannot fetch direct static file, trigger direct demo switch
      if (filename === "sales.csv") {
        setDatasetId("demo-sales");
        addToast("Switched to bundled Sales dataset.");
      } else {
        setError(`Could not load ${filename}: ${err.message}. Please use Upload dataset.`);
      }
    } finally {
      setUploading(false);
    }
  }

  function cancelPreview() {
    setPreview(null);
    setStagedFile(null);
    setSelectedSheet("");
  }

  async function removeDataset() {
    if (datasetId === "demo-sales") return;
    try {
      await api(`/api/datasets/${encodeURIComponent(datasetId)}`, { method: "DELETE" });
      localStorage.removeItem("insightops.datasetId");
      setDatasetId("demo-sales");
      setActiveView("overview");
      setActiveSection("Overview");
      setUploadReady(false);
      addToast("Dataset session removed. Returned to demo.");
    } catch (removeError) {
      setError(removeError.message);
    }
  }

  async function loadTableRows() {
    const params = new URLSearchParams({ dataset_id: datasetId, page: String(tablePage), page_size: "25" });
    if (tableSearch.trim()) params.set("search", tableSearch.trim());
    if (tableSort) {
      params.set("sort_by", tableSort);
      params.set("sort_order", tableSortOrder);
    }
    try {
      const data = await api(`/api/dataset/rows?${params.toString()}`);
      setTableData(data);
    } catch (tableError) {
      setError(tableError.message);
    }
  }

  useEffect(() => {
    if (activeView === "data" && activeSection === "Data Table") {
      loadTableRows();
    }
  }, [activeView, activeSection, datasetId, tablePage, tableSearch, tableSort, tableSortOrder]);

  async function askAnalyst(event, customQuestion = "") {
    event?.preventDefault();
    const q = customQuestion || question.trim();
    if (!q || asking) return;
    setAsking(true);
    setAskError("");
    setQuestion(q);
    try {
      const result = await api("/api/analyst/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset_id: datasetId, question: q })
      });
      setAnswer(result);
    } catch (requestError) {
      setAskError(requestError.message);
    } finally {
      setAsking(false);
    }
  }

  const filteredSchema = schema
    .filter(column => `${column.original_name} ${column.semantic_type} ${column.data_type}`.toLowerCase().includes(search.toLowerCase()))
    .filter(column => semanticFilter === "all" || (semanticFilter === "pii" ? ["email", "phone"].includes(column.semantic_type) : column.semantic_type === semanticFilter))
    .sort((left, right) => {
      if (sortBy === "missing" || sortBy === "unique") {
        return right[sortBy === "missing" ? "null_percentage" : "unique_count"] - left[sortBy === "missing" ? "null_percentage" : "unique_count"];
      }
      return left[sortBy === "type" ? "semantic_type" : "original_name"].localeCompare(right[sortBy === "type" ? "semantic_type" : "original_name"]);
    });

  const heading = {
    overview: ["LIVE DATA INTELLIGENCE", profile?.dataset_type || "Dataset Overview", profile?.filename || "Dynamic inspection, cleaning and analytics."],
    visuals: ["POWER BI VISUAL STUDIO", "Interactive BI Studio", profile?.filename || "Multi-page report builder, drag-and-drop visual designer and cross-filtering."],
    data: ["DATA INGESTION STUDIO", "Data Studio", profile?.filename || "Inspect schema, quality and cleaning pipeline."],
    analyst: ["VERIFIED AI ANALYST", "Ask Your Dataset", "Calculated analytics with 100% traceable source evidence."],
    explore: ["EXPLORATORY DATA ANALYSIS", "EDA Workspace", "Distributions, correlations, relationships and time trends."],
    forecast: ["PREDICTIVE ENGINE", forecast?.metric === "revenue" ? "Revenue Forecast" : "Volume Forecast", "Confidence intervals and multi-period projection."],
    anomalies: ["STATISTICAL ANOMALY ENGINE", "Anomaly Detection", "Outliers detected via IQR, Z-Score and Isolation Forest."],
    alerts: ["QUALITY & COMPLIANCE", "Active Alerts", "Automated alerts for missingness, duplicates, and data health."],
    reports: ["EXECUTIVE INTELLIGENCE", "Analysis Report", "Comprehensive business intelligence report ready for export."],
    dataset: ["DATASET SESSION", "Active Dataset", profile?.filename || "Manage dataset session and exports."],
    settings: ["SYSTEM SETTINGS", "Preferences", "Display preferences, number formatting and privacy controls."]
  }[activeView] || ["INTELLIGENCE", "Dashboard", ""];

  return (
    <div className="app">
      {/* Toast Notifications */}
      <div className="toast-container" aria-live="polite">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <CheckCircle2 size={16} />
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand">
          <div className="logo"><Sparkles size={20} /></div>
          <div>
            <b>InsightOps AI</b>
            <span>UNIVERSAL DATA INTELLIGENCE</span>
          </div>
        </div>

        <nav aria-label="Main navigation">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={activeView === id ? "active" : ""}
              onClick={() => setActiveView(id)}
              aria-current={activeView === id ? "page" : undefined}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="side-card">
          <ShieldCheck size={20} />
          <b>Trustworthy Analytics</b>
          <p>Every metric, insight, and anomaly has a traceable calculation formula.</p>
        </div>
      </aside>

      <main>
        {/* Header */}
        <header className="universal-header">
          <div>
            <p className="eyebrow">{heading[0]}</p>
            <h1>{heading[1]} <em>{heading[2]}</em></h1>
            {profile && (
              <p className="dataset-meta">
                {profile.filename} · {profile.rows.toLocaleString()} records · {profile.column_count} columns · Quality {profile.quality_score}%
              </p>
            )}
          </div>
          <div className="header-actions">
            <button
              className="upload"
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading || previewing}
            >
              <Upload size={17} />
              {uploading ? "Analyzing..." : "Upload Dataset"}
            </button>
            {profile && (
              <>
                <a className="icon-action" href={`${API_BASE}/api/dataset/export-clean${datasetQuery}`} title="Download Cleaned CSV" aria-label="Download Cleaned CSV">
                  <Download size={17} />
                </a>
                <a className="icon-action" href={`${API_BASE}/api/dataset/export-clean.xlsx${datasetQuery}`} title="Download Cleaned Excel" aria-label="Download Cleaned Excel">
                  <FileSpreadsheet size={17} />
                </a>
              </>
            )}
            {profile && datasetId !== "demo-sales" && (
              <button className="icon-action remove-dataset" type="button" onClick={removeDataset} aria-label="Remove active dataset" title="Remove active dataset">
                <Trash2 size={17} />
              </button>
            )}
            <button className="icon-action sign-out-action" type="button" onClick={onSignOut} aria-label="Sign out" title="Sign out">
              <LogOut size={17} />
            </button>
          </div>
          <input
            ref={fileInput}
            className="file-input"
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={selectDatasetFile}
            style={{ display: "none" }}
            aria-label="Choose CSV or Excel dataset"
          />
        </header>

        {/* Quick Sample Dataset Bar */}
        <div className="sample-datasets-bar">
          <span>Sample Datasets:</span>
          {sampleDatasets.map(ds => (
            <button
              key={ds.id}
              type="button"
              className={`sample-dataset-chip ${profile?.filename === ds.id ? "active" : ""}`}
              onClick={() => loadSampleDataset(ds.id)}
            >
              {ds.label}
            </button>
          ))}
        </div>

        {/* Status Banners */}
        {uploading && (
          <div className="upload-progress" role="status">
            <span className="loading-dot" />
            Ingesting, cleaning, and calculating dynamic models...
          </div>
        )}
        {previewing && (
          <div className="upload-progress" role="status">
            <span className="loading-dot" />
            Inspecting headers, delimiters and worksheet structures...
          </div>
        )}
        {uploadReady && !uploading && (
          <div className="upload-complete" role="status">
            <b>Dataset session ready</b>
            <div>{uploadStages.map(stage => <span key={stage}>✓ {stage}</span>)}</div>
          </div>
        )}
        {error && <p className="notice error" role="alert">{error}</p>}
        {loading && <p className="muted page-loading">Loading dataset analytics...</p>}

        {/* 1. OVERVIEW VIEW */}
        {!loading && profile && activeView === "overview" && (
          <>
            <section className="dataset-type glass">
              <div>
                <span>DATASET CLASSIFICATION</span>
                <h2>{profile.dataset_type}</h2>
                <p>Confidence {Math.round(profile.dataset_type_confidence * 100)}% · {profile.rows.toLocaleString()} records · Quality {profile.quality_score}%</p>
              </div>
              <div className="entity-list">
                {profile.detected_entities.map(entity => <span key={entity}>{entity}</span>)}
              </div>
            </section>

            {/* Dynamic KPIs */}
            <section className="stats dynamic-kpis">
              {kpis.map(item => <KpiCard key={item.label} item={item} compact={compactNumbers} />)}
            </section>

            {/* PII Alert if present */}
            {profile.sensitive_columns?.length > 0 && (
              <div className="pii-notice">
                <AlertTriangle size={18} />
                <div>
                  <b>Sensitive columns detected & protected</b>
                  <p>{profile.sensitive_columns.map(c => `${c.original_name || c.name} (${c.semantic_type})`).join(" · ")}. Values are securely masked in previews and analysis.</p>
                </div>
              </div>
            )}

            {/* Power BI-Style Dynamic Visualization Engine */}
            <section className="bi-dashboard-section" style={{ margin: "1.5rem 0" }}>
              <div className="section-head-box" style={{ marginBottom: "1rem" }}>
                <span className="badge-tag">POWER BI VISUALIZATION ENGINE</span>
                <h2 style={{ fontSize: "1.35rem", margin: "0.25rem 0", color: "#f8fafc" }}>Live Interactive BI Studio</h2>
                <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                  Multi-page reports, dynamic slicers, cross-filtering, and drag-and-drop visual builder.
                </p>
              </div>
              <PowerBIDashboard
                datasetId={datasetId}
                schema={schema}
                dimensions={profile.dimensions || []}
                baseCharts={charts}
                kpis={kpis}
                profile={profile}
                onNavigateToDataset={() => {
                  setActiveView("data");
                  setActiveSection("Data Table");
                }}
              />
            </section>

            {/* Insights & Quality */}
            <section className="grid two insight-grid">
              <div className="panel glass">
                <span>AI-DRIVEN VERIFIED INSIGHTS</span>
                <h2>Key Findings & Drivers</h2>
                {insights.length ? (
                  insights.map((item, index) => (
                    <div className="insight-row" key={`${item.title}-${index}`}>
                      <b>{item.title}</b>
                      <p>{item.text}</p>
                      <small>Source: {item.source_columns?.join(", ") || "Dataset"} · Formula: {item.calculation}</small>
                    </div>
                  ))
                ) : (
                  <p className="muted">No high-confidence insights were detected.</p>
                )}
              </div>

              <div className="panel glass">
                <span>DATA QUALITY HEALTH</span>
                <h2>{quality.overall_score}% Quality Score</h2>
                {Object.entries(quality.components).map(([name, value]) => (
                  <div className="quality-meter" key={name}>
                    <span>{name.replaceAll("_", " ")}</span>
                    <div className="meter"><i style={{ width: `${value}%` }} /></div>
                    <b>{value}%</b>
                  </div>
                ))}
                <p className="muted" style={{ marginTop: 14 }}>
                  {quality.missing_values.toLocaleString()} missing cells · {quality.duplicate_rows.toLocaleString()} duplicate rows · {quality.invalid_values.toLocaleString()} invalid values
                </p>
                <button
                  type="button"
                  className="btn-view-changes"
                  style={{ marginTop: 10 }}
                  onClick={() => setViewChangesOpen(true)}
                >
                  <Eye size={14} /> View Cleaning Changes
                </button>
              </div>
            </section>
          </>
        )}

        {/* 2. BI STUDIO VIEW */}
        {!loading && profile && activeView === "visuals" && (
          <section className="panel glass page-panel bi-studio-fullscreen" style={{ padding: "1.25rem", borderRadius: "16px" }}>
            <PowerBIDashboard
              datasetId={datasetId}
              schema={schema}
              dimensions={profile.dimensions || []}
              baseCharts={charts}
              kpis={kpis}
              profile={profile}
              onNavigateToDataset={() => {
                setActiveView("data");
                setActiveSection("Data Table");
              }}
            />
          </section>
        )}

        {/* 3. DATA STUDIO VIEW */}
        {!loading && profile && activeView === "data" && (
          <section className="panel glass page-panel data-studio">
            <div className="panel-head">
              <div>
                <span>DATA INGESTION STUDIO</span>
                <h2>{profile.filename}</h2>
              </div>
              <div className="studio-actions">
                <button type="button" className="btn-view-changes" onClick={() => setViewChangesOpen(true)}>
                  <Eye size={15} /> View Changes Diff
                </button>
                <a className="upload download-clean" href={`${API_BASE}/api/dataset/export-clean${datasetQuery}`}>
                  <Download size={15} /> Clean CSV
                </a>
                <a className="upload download-clean" href={`${API_BASE}/api/dataset/export-clean.xlsx${datasetQuery}`}>
                  <FileSpreadsheet size={15} /> Clean Excel
                </a>
                <button className="text-button remove-dataset-link" type="button" onClick={removeDataset} disabled={datasetId === "demo-sales"}>
                  Remove dataset
                </button>
              </div>
            </div>

            {/* Summary Banner */}
            <div className="dataset-summary">
              <div><span>Records</span><strong>{profile.rows.toLocaleString()}</strong></div>
              <div><span>Columns</span><strong>{profile.column_count}</strong></div>
              <div><span>Quality</span><strong>{quality.overall_score}%</strong></div>
              <div><span>Duplicates</span><strong>{quality.duplicate_rows.toLocaleString()}</strong></div>
              <div><span>Missing Cells</span><strong>{quality.missing_values.toLocaleString()}</strong></div>
            </div>

            {/* Studio Navigation Tabs */}
            <div className="studio-tabs" role="tablist" aria-label="Data Studio sections">
              {studioSections.map(section => (
                <button
                  key={section}
                  type="button"
                  role="tab"
                  aria-selected={activeSection === section}
                  className={activeSection === section ? "selected" : ""}
                  onClick={() => setActiveSection(section)}
                >
                  {section}
                </button>
              ))}
            </div>

            {/* Studio: Overview Section */}
            {activeSection === "Overview" && (
              <div className="studio-overview">
                <div className="panel glass">
                  <span>CLASSIFICATION & SCHEMA</span>
                  <h2>{profile.dataset_type}</h2>
                  <p className="muted">Confidence {Math.round(profile.dataset_type_confidence * 100)}%</p>
                  <p>{profile.detected_entities.join(" · ") || "Universal data profile."}</p>
                </div>
                <div className="panel glass">
                  <span>DATA QUALITY & CLEANING</span>
                  <h2>Automated Cleaning Actions</h2>
                  <ul>
                    {profile.cleaning_report.actions.map(action => <li key={action}>{action}</li>)}
                  </ul>
                  <button type="button" className="btn-view-changes" onClick={() => setViewChangesOpen(true)} style={{ marginTop: 12 }}>
                    <Eye size={14} /> Inspect Before/After Diff
                  </button>
                </div>
              </div>
            )}

            {/* Studio: Schema & Types */}
            {(activeSection === "Schema" || activeSection === "Data Types") && (
              <>
                <div className="schema-controls">
                  <label className="search-field">
                    <Search size={16} />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search columns..." />
                  </label>
                  <label className="control-select">
                    <Filter size={15} />
                    <select value={semanticFilter} onChange={e => setSemanticFilter(e.target.value)} aria-label="Filter columns">
                      <option value="all">All Types</option>
                      <option value="pii">PII (Sensitive)</option>
                      {[...new Set(schema.map(c => c.semantic_type))].sort().map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <label className="control-select">
                    <select value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="Sort columns">
                      <option value="name">Sort: Name</option>
                      <option value="type">Sort: Semantic Type</option>
                      <option value="missing">Sort: Missing First</option>
                      <option value="unique">Sort: Unique Values</option>
                    </select>
                  </label>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Column</th>
                        <th>Data Type</th>
                        <th>Semantic Type</th>
                        <th>Confidence</th>
                        <th>Null %</th>
                        <th>Unique</th>
                        <th>Sample Values</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSchema.map(col => (
                        <tr key={col.name}>
                          <td><b>{col.original_name}</b></td>
                          <td><code>{col.data_type}</code></td>
                          <td><span className="badge">{col.semantic_type}</span></td>
                          <td>{Math.round(col.confidence * 100)}%</td>
                          <td>{col.null_percentage}%</td>
                          <td>{col.unique_count.toLocaleString()}</td>
                          <td>{col.sample_values?.join(", ") || "--"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Studio: Quality */}
            {activeSection === "Quality" && (
              <div className="quality-section">
                <h2>Comprehensive Quality Health {quality.overall_score}%</h2>
                {Object.entries(quality.components).map(([name, value]) => (
                  <div className="quality-meter" key={name}>
                    <span>{name.replaceAll("_", " ")}</span>
                    <div className="meter"><i style={{ width: `${value}%` }} /></div>
                    <b>{value}%</b>
                  </div>
                ))}
              </div>
            )}

            {/* Studio: Missing Values */}
            {activeSection === "Missing Values" && (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr><th>Column</th><th>Missing Count</th><th>Percentage</th></tr>
                  </thead>
                  <tbody>
                    {quality.missing_by_column.map(item => (
                      <tr key={item.column}>
                        <td>{item.column}</td>
                        <td>{item.count.toLocaleString()}</td>
                        <td>{item.percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {quality.missing_by_column.length === 0 && <p className="muted">No missing values detected in dataset.</p>}
              </div>
            )}

            {/* Studio: Duplicates */}
            {activeSection === "Duplicates" && (
              <div className="quality-section">
                <h2>{quality.duplicate_rows.toLocaleString()} Duplicate Rows Detected</h2>
                <p className="muted">Exact duplicate rows are preserved in the raw file and flagged in analysis. Use cleaned export for deduplicated workflows.</p>
              </div>
            )}

            {/* Studio: Sensitive Data */}
            {activeSection === "Sensitive Data" && (
              <div className="sensitive-section">
                {profile.sensitive_columns?.length ? (
                  profile.sensitive_columns.map(col => (
                    <div className="signal" key={col.name}>
                      <ShieldCheck size={18} />
                      <div>
                        <b>{col.original_name}</b>
                        <p>{col.semantic_type} · {col.message}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="muted">No sensitive PII (emails or phone numbers) detected.</p>
                )}
              </div>
            )}

            {/* Studio: Cleaning Actions */}
            {activeSection === "Cleaning Actions" && (
              <div className="quality-section">
                <h2>Actions Applied to Clean Dataset</h2>
                <ul>
                  {profile.cleaning_report.actions.map(action => <li key={action}>{action}</li>)}
                </ul>
                <button type="button" className="btn-view-changes" onClick={() => setViewChangesOpen(true)} style={{ marginTop: 14 }}>
                  <Eye size={15} /> View Full Before/After Changes
                </button>
              </div>
            )}

            {/* Studio: Data Table Explorer */}
            {activeSection === "Data Table" && (
              <div className="data-table-explorer">
                <div className="schema-controls">
                  <label className="search-field">
                    <Search size={16} />
                    <input
                      value={tableSearch}
                      onChange={e => { setTableSearch(e.target.value); setTablePage(1); }}
                      placeholder="Search table rows..."
                    />
                  </label>
                  <label className="control-select">
                    <select value={tableSort} onChange={e => setTableSort(e.target.value)} aria-label="Sort column">
                      <option value="">Sort: Original Order</option>
                      {schema.filter(c => !["email", "phone"].includes(c.semantic_type)).map(c => (
                        <option key={c.name} value={c.name}>{c.original_name}</option>
                      ))}
                    </select>
                  </label>
                  <button className="text-button" type="button" onClick={() => setTableSortOrder(v => v === "asc" ? "desc" : "asc")}>
                    {tableSortOrder === "asc" ? "Ascending" : "Descending"}
                  </button>
                </div>

                <div className="column-visibility">
                  {schema.map(col => (
                    <label key={col.name}>
                      <input
                        type="checkbox"
                        checked={!hiddenColumns.includes(col.name)}
                        onChange={() => setHiddenColumns(curr => curr.includes(col.name) ? curr.filter(n => n !== col.name) : [...curr, col.name])}
                      />
                      {col.original_name}
                    </label>
                  ))}
                </div>

                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {tableData?.columns.filter(c => !hiddenColumns.includes(c.name)).map(col => (
                          <th key={col.name}>{col.original_name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableData?.rows.map((row, index) => (
                        <tr key={`${tablePage}-${index}`}>
                          {tableData.columns.filter(c => !hiddenColumns.includes(c.name)).map(col => (
                            <td className={row[col.name] == null ? "null-cell" : ""} key={col.name}>
                              {row[col.name] ?? "Missing"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="table-pagination">
                  <span>Rows {(tablePage - 1) * 25 + 1}–{Math.min(tablePage * 25, tableData?.total || 0)} of {(tableData?.total || 0).toLocaleString()}</span>
                  <div>
                    <button className="icon-action" type="button" disabled={tablePage <= 1} onClick={() => setTablePage(p => Math.max(1, p - 1))}>
                      <ChevronLeft size={16} />
                    </button>
                    <span>Page {tablePage} of {Math.max(1, Math.ceil((tableData?.total || 0) / 25))}</span>
                    <button className="icon-action" type="button" disabled={tablePage * 25 >= (tableData?.total || 0)} onClick={() => setTablePage(p => p + 1)}>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* 3. AI ANALYST VIEW */}
        {!loading && profile && activeView === "analyst" && (
          <section className="panel glass page-panel analyst-panel">
            <div className="panel-head">
              <div>
                <span>LOCAL & TRUSTWORTHY INTELLIGENCE</span>
                <h2>Ask Your Dataset</h2>
                <p className="muted">Ask natural language business questions. All calculations are executed deterministically on your dataset.</p>
              </div>
            </div>

            {/* Quick question chips */}
            <div className="query-chips">
              {analystQuestions.map(qText => (
                <button
                  key={qText}
                  type="button"
                  className="query-chip"
                  onClick={e => askAnalyst(e, qText)}
                  disabled={asking}
                >
                  {qText}
                </button>
              ))}
            </div>

            {/* Analyst Response Panel */}
            <div className="analyst-chat" aria-live="polite">
              {answer ? (
                <>
                  <b>{answer.answer}</b>
                  <div className="answer-evidence">
                    {answer.evidence.map((ev, i) => (
                      <small key={i}><Check size={14} style={{ color: "#e6c348" }} /> {ev}</small>
                    ))}
                  </div>
                  {answer.top_contributor && (
                    <div style={{ margin: "6px 0", fontSize: 13, color: "#f0cf55" }}>
                      ★ Primary Driver: {JSON.stringify(answer.top_contributor).replaceAll('"', "").replaceAll("{", "").replaceAll("}", "")}
                    </div>
                  )}
                  <div className="analyst-meta">
                    <span>Source: {answer.source_columns?.join(", ") || "Dataset Profile"}</span>
                    <span>Formula: <code>{answer.calculation}</code></span>
                    {answer.query_intent && <span>Intent: <em>{answer.query_intent}</em></span>}
                  </div>
                </>
              ) : (
                <p className="muted">Ask a question above or select one of the suggested query chips to inspect your data.</p>
              )}
            </div>

            {askError && <p className="notice error">{askError}</p>}

            {/* Question Input Form */}
            <form className="ask" onSubmit={askAnalyst}>
              <input
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder="Ask about revenue trends, top categories, anomalies, salary averages..."
                disabled={asking}
              />
              <button type="submit" disabled={asking || !question.trim()}>
                <Send size={16} />
              </button>
            </form>
          </section>
        )}

        {/* 4. EXPLORATORY DATA ANALYSIS (EDA) */}
        {!loading && profile && activeView === "explore" && (
          <section className="panel glass page-panel">
            <div className="panel-head">
              <div>
                <span>EXPLORATORY DATA ANALYSIS</span>
                <h2>Data Explorations & Distributions</h2>
              </div>
            </div>

            <div className="eda-subtabs">
              {edaTabs.map(tab => (
                <button
                  key={tab}
                  type="button"
                  className={`eda-subtab-btn ${edaTab === tab ? "active" : ""}`}
                  onClick={() => setEdaTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* EDA: Overview */}
            {edaTab === "Overview" && (
              <>
                <section className="chart-grid">
                  {charts.slice(0, 4).map((chart, i) => <ChartPanel key={i} chart={chart} />)}
                </section>
                {profile.numeric_statistics.length > 0 && (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr><th>Measure</th><th>Count</th><th>Mean</th><th>Median</th><th>Std Dev</th><th>Min</th><th>Q1</th><th>Q3</th><th>Max</th><th>Outliers</th></tr>
                      </thead>
                      <tbody>
                        {profile.numeric_statistics.map(st => (
                          <tr key={st.column}>
                            <td><b>{st.column}</b></td>
                            <td>{st.count.toLocaleString()}</td>
                            <td>{st.mean.toLocaleString()}</td>
                            <td>{st.median.toLocaleString()}</td>
                            <td>{st.std.toLocaleString()}</td>
                            <td>{st.min.toLocaleString()}</td>
                            <td>{st.q1.toLocaleString()}</td>
                            <td>{st.q3.toLocaleString()}</td>
                            <td>{st.max.toLocaleString()}</td>
                            <td><span className={st.outlier_count > 0 ? "severity-badge medium" : ""}>{st.outlier_count}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* EDA: Distributions */}
            {edaTab === "Distributions" && (
              <div>
                <div className="schema-controls">
                  <label className="control-select">
                    <span>Select Measure:</span>
                    <select value={selectedDistCol} onChange={e => setSelectedDistCol(e.target.value)}>
                      {schema.filter(c => ["numeric", "currency", "percentage"].includes(c.semantic_type)).map(c => (
                        <option key={c.name} value={c.name}>{c.original_name}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {charts.filter(c => c.kind === "histogram" && (!selectedDistCol || c.title.toLowerCase().includes(selectedDistCol.toLowerCase()))).map((hChart, idx) => (
                  <ChartPanel key={idx} chart={hChart} />
                ))}
              </div>
            )}

            {/* EDA: Correlations Matrix */}
            {edaTab === "Correlations" && (
              <div>
                {profile.correlations?.length > 0 ? (
                  <div className="table-scroll">
                    <table className="correlation-matrix">
                      <thead>
                        <tr><th>Measure X</th><th>Measure Y</th><th>Pearson r</th><th>Sample Count</th><th>Direction</th></tr>
                      </thead>
                      <tbody>
                        {profile.correlations.map((cr, idx) => (
                          <tr key={idx}>
                            <td><b>{cr.x}</b></td>
                            <td><b>{cr.y}</b></td>
                            <td>
                              <span className="corr-cell" style={{ color: cr.pearson > 0 ? "#77e5ce" : "#ff7878" }}>
                                {cr.pearson.toFixed(3)}
                              </span>
                            </td>
                            <td>{cr.sample_size.toLocaleString()}</td>
                            <td>{cr.pearson > 0 ? "Positive Correlation" : "Negative Correlation"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted">Dataset does not contain enough numeric pairs for correlation computation.</p>
                )}
              </div>
            )}

            {/* EDA: Relationships (Scatter) */}
            {edaTab === "Relationships" && (
              <section className="chart-grid">
                {charts.filter(c => c.kind === "scatter").map((sChart, idx) => (
                  <ChartPanel key={idx} chart={sChart} />
                ))}
                {charts.filter(c => c.kind === "scatter").length === 0 && (
                  <p className="muted">No numeric relationships available for scatter visualization.</p>
                )}
              </section>
            )}

            {/* EDA: Categories */}
            {edaTab === "Categories" && (
              <section className="chart-grid">
                {charts.filter(c => c.kind === "pie" || c.kind === "bar").map((cChart, idx) => (
                  <ChartPanel key={idx} chart={cChart} />
                ))}
              </section>
            )}

            {/* EDA: Time Series */}
            {edaTab === "Time Series" && (
              <div>
                {charts.filter(c => c.kind === "line" || c.kind === "area").map((tChart, idx) => (
                  <ChartPanel key={idx} chart={tChart} />
                ))}
                {charts.filter(c => c.kind === "line" || c.kind === "area").length === 0 && (
                  <p className="muted">No temporal dates detected for time-series trend analysis.</p>
                )}
              </div>
            )}

            {/* EDA: Outliers */}
            {edaTab === "Outliers" && (
              <div>
                <h2>Outlier Distribution Summary</h2>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr><th>Column</th><th>Outlier Count</th><th>Min</th><th>Max</th><th>Q1 - 1.5×IQR</th><th>Q3 + 1.5×IQR</th></tr>
                    </thead>
                    <tbody>
                      {profile.numeric_statistics.map(st => {
                        const iqr = st.q3 - st.q1;
                        return (
                          <tr key={st.column}>
                            <td><b>{st.column}</b></td>
                            <td><span className={st.outlier_count > 0 ? "severity-badge medium" : ""}>{st.outlier_count}</span></td>
                            <td>{st.min.toLocaleString()}</td>
                            <td>{st.max.toLocaleString()}</td>
                            <td>{(st.q1 - 1.5 * iqr).toFixed(2)}</td>
                            <td>{(st.q3 + 1.5 * iqr).toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {/* 5. FORECASTS VIEW */}
        {!loading && profile && activeView === "forecast" && (
          <section className="panel glass page-panel">
            <div className="panel-head">
              <div>
                <span>AUTOMATIC FORECASTING ENGINE</span>
                <h2>{forecast.metric === "revenue" ? "Revenue Projection" : "Volume Forecast"}</h2>
                <p className="muted">{forecast.model_name || "Predictive time-series model"}</p>
              </div>
            </div>

            {forecast.available ? (
              <>
                <div className="stats dynamic-kpis" style={{ margin: "16px 0" }}>
                  {forecast.values.slice(0, 3).map((v, idx) => (
                    <div className="stat glass" key={v.period}>
                      <div className="icon"><TrendingUp size={18} /></div>
                      <div>
                        <span>{idx === 0 ? "Next Period" : `Period +${idx + 1}`} ({v.period})</span>
                        <strong>{forecast.metric === "revenue" ? `₹${Number(v.value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : `${v.value.toLocaleString()} units`}</strong>
                        <small>95% CI: [{v.lower?.toLocaleString()} – {v.upper?.toLocaleString()}]</small>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="chart forecast-chart" style={{ height: 280 }}>
                  <ResponsiveContainer>
                    <LineChart data={[
                      ...forecast.history.map(item => ({ ...item, historical: item.value })),
                      ...forecast.values.map(item => ({ ...item, projected: item.value }))
                    ]}>
                      <CartesianGrid stroke="#ffffff10" vertical={false} />
                      <XAxis dataKey="period" tick={{ fill: "#8291a8", fontSize: 10 }} />
                      <YAxis hide />
                      <Tooltip contentStyle={{ background: "#0c1827", border: "1px solid #ffffff20", borderRadius: 8 }} />
                      <Line type="monotone" dataKey="historical" name="Historical Actuals" stroke="#77e5ce" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="projected" name="Projected Forecast" stroke="#f0cf55" strokeWidth={3} strokeDasharray="5 5" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <small className="source-note">Model: {forecast.model_name} · Source: {forecast.source_columns?.join(", ")} · {forecast.confidence_interval}</small>
              </>
            ) : (
              <div className="forecast-unavailable">
                <h3>Forecast Unavailable</h3>
                <p>{forecast.reason || "This dataset does not contain sufficient temporal information for reliable forecasting."}</p>
                <div style={{ marginTop: 12 }}>
                  <p>You can still use:</p>
                  <ul>
                    <li>✓ Data profiling</li>
                    <li>✓ Cleaning pipeline</li>
                    <li>✓ KPI analysis</li>
                    <li>✓ Dynamic visualizations</li>
                    <li>✓ Anomaly detection</li>
                  </ul>
                </div>
              </div>
            )}
          </section>
        )}

        {/* 6. ANOMALIES VIEW */}
        {!loading && profile && activeView === "anomalies" && (
          <section className="panel glass page-panel">
            <div className="panel-head">
              <div>
                <span>AUTOMATIC ANOMALY DETECTION</span>
                <h2>Statistical Outliers & Shifts</h2>
                <p className="muted">Multi-model anomaly detection using IQR, Z-Score, Isolation Forest, and Rolling 2σ.</p>
              </div>
            </div>

            <div className="anomaly-grid">
              {anomalies.map(anom => (
                <div key={anom.id} className={`anomaly-card ${anom.severity}`}>
                  <div className="anomaly-header">
                    <span className="anomaly-metric">{anom.metric}</span>
                    <span className={`severity-badge ${anom.severity}`}>{anom.severity}</span>
                  </div>
                  <b style={{ fontSize: 15, color: "#f6f4ec" }}>{anom.title}</b>
                  <div className="anomaly-value-row">
                    <strong>{typeof anom.observed === "number" ? anom.observed.toLocaleString() : anom.observed}</strong>
                    <span className="anomaly-deviation">{anom.deviation}</span>
                  </div>
                  <p style={{ margin: "4px 0", fontSize: 12, color: "#b5ac95" }}>{anom.detail}</p>
                  <small style={{ color: "#7a7465", fontSize: 10 }}>Method: {anom.method}</small>
                  <button
                    type="button"
                    className="btn-investigate"
                    onClick={() => setInvestigatingAnomaly(anom)}
                  >
                    <Search size={14} /> Investigate
                  </button>
                </div>
              ))}
            </div>

            {anomalies.length === 0 && (
              <p className="muted">No numerical anomalies detected outside standard bounds.</p>
            )}
          </section>
        )}

        {/* 7. ALERTS VIEW */}
        {!loading && profile && activeView === "alerts" && (
          <section className="panel glass page-panel alert-list">
            <div className="panel-head">
              <div>
                <span>DATA QUALITY MONITORING</span>
                <h2>Active Alerts</h2>
                <p className="muted">Automated checks covering missing values, duplicates, and type consistency.</p>
              </div>
            </div>
            {alerts.map((item, idx) => (
              <div className="signal" key={idx}>
                <AlertTriangle size={18} />
                <div style={{ flex: 1 }}>
                  <b>{item.title}</b>
                  <p>{item.detail}</p>
                  <small className="source-note">Source: {item.source_columns?.join(", ") || "Dataset-wide check"}</small>
                </div>
                <span className={`severity-badge ${item.severity || "medium"}`}>{item.severity || "medium"}</span>
              </div>
            ))}
          </section>
        )}

        {/* 8. REPORTS VIEW */}
        {!loading && profile && activeView === "reports" && (
          <section className="panel glass page-panel report-view">
            <div className="panel-head">
              <div>
                <span>GENERATED EXECUTIVE REPORT</span>
                <h2>{profile.filename} Intelligence Report</h2>
              </div>
              <div className="studio-actions">
                <a className="upload download-clean" href={`${API_BASE}/api/dataset/report?dataset_id=${encodeURIComponent(datasetId)}`} download={`${profile.filename}.analysis.json`}>
                  <Download size={15} /> Export JSON
                </a>
                <button className="upload" type="button" onClick={() => window.print()}>
                  <FileText size={15} /> Print / Save PDF
                </button>
              </div>
            </div>

            <div className="dataset-summary">
              <div><span>Dataset</span><strong>{profile.filename}</strong></div>
              <div><span>Records</span><strong>{profile.rows.toLocaleString()}</strong></div>
              <div><span>Quality Score</span><strong>{profile.quality_score}%</strong></div>
              <div><span>Domain</span><strong>{profile.dataset_type}</strong></div>
              <div><span>Active Alerts</span><strong>{alerts.length}</strong></div>
            </div>

            <h3>Key Performance Indicators</h3>
            <div className="report-kpis">
              {kpis.map(item => (
                <p key={item.label}>
                  <b>{item.label}:</b> {formatValue(item, compactNumbers)} <small>({item.source_columns?.join(", ") || "Profile"})</small>
                </p>
              ))}
            </div>

            <h3>Evidence-Backed Insights</h3>
            {insights.map((item, idx) => (
              <div className="insight-row" key={idx}>
                <b>{item.title}</b>
                <p>{item.text}</p>
                <small>Source: {item.source_columns?.join(", ")} · {item.calculation}</small>
              </div>
            ))}

            <h3>Quality Issues & Active Alerts</h3>
            {alerts.map((item, idx) => (
              <p key={idx}><b>{item.title}:</b> {item.detail}</p>
            ))}
          </section>
        )}

        {/* 9. DATASET VIEW (Live Workspace) */}
        {!loading && profile && activeView === "dataset" && (
          <section className="panel glass page-panel">
            <div className="panel-head">
              <div>
                <span>LIVE DATA WORKSPACE</span>
                <h2>{profile.filename} Session</h2>
              </div>
              <div className="studio-actions">
                <button className="upload" type="button" onClick={() => fileInput.current?.click()}>
                  <Upload size={15} /> Replace Dataset
                </button>
                <a className="upload download-clean" href={`${API_BASE}/api/dataset/export-clean${datasetQuery}`}>
                  <Download size={15} /> Cleaned CSV
                </a>
                {datasetId !== "demo-sales" && (
                  <button className="text-button remove-dataset-link" type="button" onClick={removeDataset}>
                    Remove Dataset
                  </button>
                )}
              </div>
            </div>

            <div className="dataset-summary">
              <div><span>Status</span><strong>Analyzed & Live</strong></div>
              <div><span>Rows</span><strong>{profile.rows.toLocaleString()}</strong></div>
              <div><span>Columns</span><strong>{profile.column_count}</strong></div>
              <div><span>File Size</span><strong>{profile.file_size ? `${(profile.file_size / (1024 * 1024)).toFixed(2)} MB` : "Bundled"}</strong></div>
              <div><span>Uploaded</span><strong>{profile.created_at ? new Date(profile.created_at).toLocaleString() : "Bundled Demo"}</strong></div>
            </div>
          </section>
        )}

        {/* 10. SETTINGS VIEW */}
        {!loading && profile && activeView === "settings" && (
          <section className="panel glass page-panel settings-view">
            <div className="panel-head">
              <div>
                <span>PLATFORM PREFERENCES</span>
                <h2>Display & Privacy Settings</h2>
              </div>
            </div>

            <label className="setting-row" style={{ display: "flex", justifyContent: "space-between", padding: "16px 0", borderBottom: "1px solid #ffffff12" }}>
              <span>
                <b>Compact Metric Notation</b>
                <small style={{ display: "block", color: "#8c8572" }}>Format numbers using K / M shorthand for compact card presentation.</small>
              </span>
              <input
                type="checkbox"
                checked={compactNumbers}
                onChange={e => {
                  setCompactNumbers(e.target.checked);
                  localStorage.setItem("insightops.compactNumbers", String(e.target.checked));
                  addToast("Preferences saved.");
                }}
              />
            </label>

            <div className="setting-row" style={{ display: "flex", justifyContent: "space-between", padding: "16px 0", borderBottom: "1px solid #ffffff12" }}>
              <span>
                <b>Deterministic PII Masking</b>
                <small style={{ display: "block", color: "#8c8572" }}>Emails and phone numbers are irreversibly masked before analytics processing.</small>
              </span>
              <ShieldCheck size={20} style={{ color: "#e6c348" }} />
            </div>

            <div className="setting-row" style={{ display: "flex", justifyContent: "space-between", padding: "16px 0" }}>
              <span>
                <b>Storage Engine</b>
                <small style={{ display: "block", color: "#8c8572" }}>Dataset files are stored locally under <code>data/uploads/</code>.</small>
              </span>
              <Database size={20} style={{ color: "#e6c348" }} />
            </div>
          </section>
        )}

        {/* PREVIEW MODAL */}
        {preview && (
          <div className="upload-modal-backdrop" role="presentation" onClick={e => { if (e.target === e.currentTarget) cancelPreview(); }}>
            <section className="upload-modal panel glass" role="dialog" aria-modal="true" aria-labelledby="preview-title">
              <div className="panel-head">
                <div>
                  <span>DATA INGESTION STUDIO</span>
                  <h2 id="preview-title">Preview Before Analysis</h2>
                </div>
                <button className="icon-action" type="button" onClick={cancelPreview} aria-label="Cancel upload"><X size={17} /></button>
              </div>

              <div
                className="file-dropzone"
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("drag-over"); }}
                onDragLeave={e => e.currentTarget.classList.remove("drag-over")}
                onDrop={async e => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("drag-over");
                  const file = e.dataTransfer.files?.[0];
                  if (file) {
                    setStagedFile(file);
                    setPreview(null);
                    await previewFile(file);
                  }
                }}
              >
                <span>Drop a replacement file here, or browse.</span>
                <button type="button" onClick={() => fileInput.current?.click()}>Browse files</button>
              </div>

              <div className="preview-file-meta">
                <b>{preview.filename}</b>
                <span>{(preview.file_size / (1024 * 1024)).toFixed(2)} MB</span>
                {preview.delimiter && <span>Delimiter: <code>{preview.delimiter === "\t" ? "TAB" : preview.delimiter}</code></span>}
                {preview.encoding && <span>Encoding: {preview.encoding.toUpperCase()}</span>}
                <span>{preview.total_columns || preview.columns.length} columns detected</span>
              </div>

              {preview.sheet_names?.length > 0 && (
                <label className="sheet-picker">
                  Worksheet:
                  <select
                    value={selectedSheet}
                    onChange={async e => {
                      const val = e.target.value;
                      setSelectedSheet(val);
                      await previewFile(stagedFile, val);
                    }}
                    aria-label="Select Excel worksheet"
                  >
                    {preview.sheet_names.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              )}

              <div className="preview-schema">
                {preview.columns.map(col => (
                  <span key={col.column_name}>
                    {col.column_name} <i>{col.semantic_type}</i>
                  </span>
                ))}
              </div>

              <div className="table-scroll preview-table">
                <table>
                  <thead>
                    <tr>{preview.columns.map(col => <th key={col.column_name}>{col.column_name}</th>)}</tr>
                  </thead>
                  <tbody>
                    {preview.preview_rows.map((row, idx) => (
                      <tr key={idx}>
                        {preview.columns.map(col => <td key={col.column_name}>{row[col.column_name] ?? "Missing"}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="preview-note">PII contact fields are masked. Non-destructive cleaning preserves raw data.</p>
              <div className="preview-actions">
                <button className="text-button" type="button" onClick={cancelPreview} disabled={uploading}>Cancel</button>
                <button className="upload" type="button" onClick={analyzeStagedDataset} disabled={uploading || previewing}>
                  <Database size={16} />
                  {uploading ? "Analyzing..." : "Analyze Dataset"}
                </button>
              </div>
            </section>
          </div>
        )}

        {/* VIEW CHANGES (CLEANING DIFF) MODAL */}
        {viewChangesOpen && profile?.cleaning_report && (
          <div className="upload-modal-backdrop" role="presentation" onClick={e => { if (e.target === e.currentTarget) setViewChangesOpen(false); }}>
            <section className="upload-modal panel glass" role="dialog" aria-modal="true" aria-labelledby="changes-title">
              <div className="panel-head">
                <div>
                  <span>AUTOMATIC DATA CLEANING ENGINE</span>
                  <h2 id="changes-title">Data Cleaning Report & Changes</h2>
                </div>
                <button className="icon-action" type="button" onClick={() => setViewChangesOpen(false)} aria-label="Close dialog"><X size={17} /></button>
              </div>

              {/* Before vs After Score Banner */}
              <div className="cleaning-score-banner">
                <div>
                  <h3>Quality Score Improvement</h3>
                  <p>Before: {profile.cleaning_report.before?.quality_score}% → After: {profile.cleaning_report.after?.quality_score}%</p>
                </div>
                <div>
                  <h3>Row Volume Health</h3>
                  <p>Original Rows: {profile.cleaning_report.before?.rows.toLocaleString()} · Clean Rows: {profile.cleaning_report.after?.rows.toLocaleString()}</p>
                </div>
              </div>

              <h3>Applied Cleaning Actions</h3>
              <ul>
                {profile.cleaning_report.actions.map(action => (
                  <li key={action} style={{ margin: "6px 0", color: "#f0cf55" }}>{action}</li>
                ))}
              </ul>

              <h3 style={{ marginTop: 20 }}>Column Changes & Transformations</h3>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Column</th>
                      <th>Cleaned Type</th>
                      <th>Whitespace Trimmed</th>
                      <th>Missing Before</th>
                      <th>Missing After</th>
                      <th>Imputation</th>
                      <th>Invalid Coerced</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.cleaning_report.diff?.map(colDiff => (
                      <tr key={colDiff.column}>
                        <td><b>{colDiff.column}</b></td>
                        <td><span className="badge">{colDiff.cleaned_type}</span></td>
                        <td>{colDiff.whitespace_trimmed}</td>
                        <td>{colDiff.missing_before}</td>
                        <td>{colDiff.missing_after}</td>
                        <td>{colDiff.imputed_count > 0 ? `${colDiff.imputed_count} (${colDiff.imputation_strategy})` : "None"}</td>
                        <td>{colDiff.invalid_coerced}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="preview-actions">
                <button className="upload" type="button" onClick={() => setViewChangesOpen(false)}>Done</button>
              </div>
            </section>
          </div>
        )}

        {/* INVESTIGATE ANOMALY MODAL */}
        {investigatingAnomaly && (
          <div className="upload-modal-backdrop" role="presentation" onClick={e => { if (e.target === e.currentTarget) setInvestigatingAnomaly(null); }}>
            <section className="upload-modal panel glass" role="dialog" aria-modal="true" aria-labelledby="anomaly-title" style={{ maxWidth: 680 }}>
              <div className="panel-head">
                <div>
                  <span className={`severity-badge ${investigatingAnomaly.severity}`}>{investigatingAnomaly.severity} SEVERITY ANOMALY</span>
                  <h2 id="anomaly-title">{investigatingAnomaly.title}</h2>
                </div>
                <button className="icon-action" type="button" onClick={() => setInvestigatingAnomaly(null)}><X size={17} /></button>
              </div>

              <div className="dataset-summary">
                <div><span>Metric</span><strong>{investigatingAnomaly.metric}</strong></div>
                <div><span>Observed</span><strong>{typeof investigatingAnomaly.observed === "number" ? investigatingAnomaly.observed.toLocaleString() : investigatingAnomaly.observed}</strong></div>
                <div><span>Deviation</span><strong>{investigatingAnomaly.deviation}</strong></div>
                <div><span>Method</span><strong>{investigatingAnomaly.method}</strong></div>
              </div>

              <p style={{ lineHeight: 1.6, color: "#d8cfb5" }}>{investigatingAnomaly.explanation || investigatingAnomaly.detail}</p>

              {investigatingAnomaly.expected_range?.length === 2 && (
                <div className="pii-notice" style={{ marginTop: 12 }}>
                  <Info size={18} />
                  <div>
                    <b>Expected Normal Range</b>
                    <p>{investigatingAnomaly.expected_range[0].toLocaleString()} to {investigatingAnomaly.expected_range[1].toLocaleString()}</p>
                  </div>
                </div>
              )}

              {investigatingAnomaly.investigation_details?.neighboring_periods && (
                <div>
                  <h4 style={{ margin: "14px 0 8px", color: "#f6f4ec" }}>Surrounding Timeline Baseline</h4>
                  <div className="table-scroll">
                    <table>
                      <thead><tr><th>Period</th><th>Value</th></tr></thead>
                      <tbody>
                        {investigatingAnomaly.investigation_details.neighboring_periods.map((np, i) => (
                          <tr key={i} style={np.period === investigatingAnomaly.period ? { background: "#e6c34822", fontWeight: 700 } : {}}>
                            <td>{np.period}</td>
                            <td>{np.value.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="preview-actions">
                <button className="upload" type="button" onClick={() => setInvestigatingAnomaly(null)}>Close Investigation</button>
              </div>
            </section>
          </div>
        )}

        <footer>
          InsightOps AI · Universal Live Data Intelligence Platform · Session {datasetId === "demo-sales" ? "demo" : datasetId.slice(0, 8)}
        </footer>
      </main>
    </div>
  );
}
