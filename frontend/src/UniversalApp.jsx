import React, { useEffect, useRef, useState, lazy, Suspense } from "react";
import {
  AlertTriangle, ArrowDown, ArrowUp, BarChart3, Bell, BrainCircuit, Check, CheckCircle2,
  ChevronDown, ChevronLeft, ChevronRight, Copy, Database, Download, Eye, FileSpreadsheet,
  FileText, Filter, HelpCircle, Info, Layers, LayoutGrid, LogOut, Maximize2, Moon, RefreshCw, Search,
  Send, Share2, ShieldCheck, Sliders, Sparkles, Sun, Table, Trash2, TrendingDown, TrendingUp,
  Upload, User, X, Zap, Activity, CornerDownLeft, Plus
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis
} from "recharts";
import { api } from "./lib/api";
import { useAuth } from "./context/AuthContext";
import PowerBIDashboard from "./components/visuals/PowerBIDashboard";
import GlobalSearchBar from "./components/saas/GlobalSearchBar";
import SaaSDashboardView from "./components/saas/SaaSDashboardView";
import WorkspacesView from "./components/saas/WorkspacesView";
import ReportsManagerView from "./components/saas/ReportsManagerView";
import AlertsCenterView from "./components/saas/AlertsCenterView";
import ActivityLogView from "./components/saas/ActivityLogView";
import ProfileSettingsView from "./components/saas/ProfileSettingsView";
import DataHubView from "./components/saas/DataHubView";
import DataCleaningStudio from "./components/saas/DataCleaningStudio";

// Enterprise UI Components
import AIAnalystDrawer from "./components/ui/AIAnalystDrawer";
import CommandPalette from "./components/ui/CommandPalette";
import ToastContainer from "./components/ui/ToastContainer";
import AIOrb from "./components/ui/AIOrb";
import KPIWidget from "./components/ui/KPIWidget";
import ChartCard from "./components/ui/ChartCard";
import GlassCard from "./components/ui/GlassCard";
import SkeletonLoader from "./components/ui/SkeletonLoader";

import "./universal.css";
import "./saas.css";
import "./modern-enterprise.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const navGroups = [
  {
    category: "CORE ANALYTICS",
    items: [
      { id: "overview", label: "Dashboard", icon: BarChart3 },
      { id: "datahub", label: "Data Hub", icon: Database, badge: "Hub" },
      { id: "data", label: "Data Studio", icon: Sliders },
      { id: "visuals", label: "BI Studio", icon: LayoutGrid },
      { id: "reports", label: "Reports", icon: FileText },
    ]
  },
  {
    category: "INTELLIGENCE",
    items: [
      { id: "analyst", label: "AI Analyst", icon: BrainCircuit, badge: "AI" },
      { id: "forecast", label: "Forecasts", icon: TrendingUp },
      { id: "anomalies", label: "Anomalies", icon: AlertTriangle },
      { id: "explore", label: "Explore EDA", icon: Search },
    ]
  },
  {
    category: "GOVERNANCE",
    items: [
      { id: "alerts", label: "Alerts", icon: Bell },
      { id: "workspaces", label: "Workspaces", icon: Layers },
      { id: "activity", label: "Audit Log", icon: Activity },
      { id: "settings", label: "Settings", icon: Sliders },
    ]
  }
];

const navItems = navGroups.flatMap(g => g.items);

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
  { id: "retail.csv", label: "Omnichannel Retail", domain: "Retail" },
  { id: "logistics.csv", label: "Supply Chain & Logistics", domain: "Logistics" },
  { id: "customer_analytics.csv", label: "SaaS Churn & Cohorts", domain: "Customer Analytics" },
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
  const { user, workspaces, activeWorkspace, switchWorkspace, logout } = useAuth();
  const [activeView, setActiveView] = useState("overview");
  const [activeSection, setActiveSection] = useState("Overview");
  const [edaTab, setEdaTab] = useState("Overview");
  const [datasetId, setDatasetId] = useState(() => localStorage.getItem("insightops.datasetId") || "demo-sales");

  // SaaS Navigation & UI State
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [datasetDropdownOpen, setDatasetDropdownOpen] = useState(false);
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("insightops.theme") || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("insightops.theme", theme);
  }, [theme]);

  // Global search & command palette shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
    overview: ["EXECUTIVE BI SAAS", "SaaS Dashboard", "Multi-workspace operations, dataset telemetry, saved reports, and live alerts."],
    datahub: ["ENTERPRISE DATA LAKE", "Data Hub", "Complete dataset management, preview, duplication, versions, and archiving."],
    visuals: ["POWER BI VISUAL STUDIO", "Interactive BI Studio", profile?.filename || "Multi-page report builder, drag-and-drop visual designer and cross-filtering."],
    data: ["DATA INGESTION STUDIO", "Data Studio", profile?.filename || "Inspect schema, quality and cleaning pipeline."],
    reports: ["REPORT BUILDER & LIBRARY", "Saved Reports", "Scheduled delivery, public sharing, and multi-page BI dashboards."],
    analyst: ["VERIFIED AI ANALYST", "Ask Your Dataset", "Calculated analytics with 100% traceable source evidence."],
    explore: ["EXPLORATORY DATA ANALYSIS", "EDA Workspace", "Distributions, correlations, relationships and time trends."],
    forecast: ["PREDICTIVE ENGINE", forecast?.metric === "revenue" ? "Revenue Forecast" : "Volume Forecast", "Confidence intervals and multi-period projection."],
    anomalies: ["STATISTICAL ANOMALY ENGINE", "Anomaly Detection", "Outliers detected via IQR, Z-Score and Isolation Forest."],
    alerts: ["INTELLIGENT MONITORING & SLA", "Alerts Center", "Automated alert rules, threshold monitors, and live notification feed."],
    workspaces: ["ORGANIZATION & RBAC", "Workspace Management", "Collaborative team workspaces and role-based permissions."],
    activity: ["SECURITY & COMPLIANCE", "Activity Audit Log", "Immutable chronological record of logins, uploads, and report actions."],
    dataset: ["DATASET SESSION", "Active Dataset", profile?.filename || "Manage dataset session and exports."],
    settings: ["ACCOUNT & PLATFORM", "Settings & Health", "User profile, password change, UI themes, and backend telemetry."]
  }[activeView] || ["INTELLIGENCE", "Dashboard", ""];

  return (
    <div className="app">
      {/* Global Spotlight Search Modal */}
      <GlobalSearchBar
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onNavigate={(view, extra) => {
          setActiveView(view);
          if (extra?.datasetId) loadDataset(extra.datasetId);
        }}
      />

      {/* Toast Notifications */}
      {/* Toast Notifications */}
      <ToastContainer
        toasts={toasts}
        onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))}
      />

      {/* Global Command Palette (⌘K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={(view, extra) => {
          setActiveView(view);
          if (extra?.datasetId) loadDataset(extra.datasetId);
        }}
        onAction={(action, extra) => {
          if (action === "upload") fileInput.current?.click();
          if (action === "export-clean") window.location.href = `${API_BASE}/api/dataset/export-clean${datasetQuery}`;
          if (action === "view-diff") setViewChangesOpen(true);
          if (action === "load-sample") loadSampleDataset(extra);
          if (action === "cleaning-studio") {
            setActiveView("data");
            setActiveSection("Cleaning Actions");
          }
        }}
        activeDataset={profile?.filename}
        theme={theme}
        onToggleTheme={() => setTheme(t => t === "dark" ? "light" : "dark")}
      />

      {/* Right-Side Slide-out AI Analyst Drawer */}
      <AIAnalystDrawer
        isOpen={aiDrawerOpen}
        onClose={() => setAiDrawerOpen(false)}
        onExpandFull={() => {
          setAiDrawerOpen(false);
          setActiveView("analyst");
        }}
        question={question}
        setQuestion={setQuestion}
        answer={answer}
        asking={asking}
        askError={askError}
        askAnalyst={askAnalyst}
        analystQuestions={analystQuestions}
        activeDatasetName={profile?.filename}
      />

      {/* Modern Collapsible Enterprise Sidebar */}
      <aside className={`sidebar enterprise-sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-brand-row">
          <div className="sidebar-brand-left">
            <div className="sidebar-brand-prism">
              <Sparkles size={17} color="#818cf8" />
            </div>
            {!sidebarCollapsed && (
              <div className="sidebar-brand-titles">
                <b>INSIGHTOPS</b>
                <span>AI PLATFORM</span>
              </div>
            )}
          </div>
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={() => setSidebarCollapsed(c => !c)}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label="Toggle sidebar width"
          >
            {sidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        <div className="sidebar-scroll-container">
          {navGroups.map((group) => (
            <div key={group.category} className="sidebar-nav-group">
              {!sidebarCollapsed && (
                <span className="sidebar-group-label">{group.category}</span>
              )}
              {group.items.map(({ id, label, icon: Icon, badge }) => (
                <button
                  key={id}
                  type="button"
                  className={`sidebar-nav-btn ${activeView === id ? "active" : ""}`}
                  onClick={() => setActiveView(id)}
                  title={sidebarCollapsed ? label : undefined}
                  aria-current={activeView === id ? "page" : undefined}
                >
                  <Icon size={17} />
                  {!sidebarCollapsed && <span>{label}</span>}
                  {!sidebarCollapsed && badge && <span className="sidebar-btn-badge">{badge}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="sidebar-telemetry-box">
          <div className="sidebar-telemetry-inner">
            <span className="telemetry-pulse-dot" />
            {!sidebarCollapsed ? (
              <div className="sidebar-telemetry-text">
                <strong>{profile?.filename ? (profile.filename.length > 18 ? profile.filename.slice(0, 16) + "…" : profile.filename) : "Active Telemetry"}</strong>
                <span>{profile?.rows ? `${profile.rows.toLocaleString()} rows online` : "Session live"}</span>
              </div>
            ) : (
              <span style={{ fontSize: "10px", color: "#34d399", fontWeight: "700" }}>LIVE</span>
            )}
          </div>
        </div>
      </aside>

      <div className="enterprise-main-shell">
        {/* Modern Enterprise Header */}
        <header className="universal-header">
          <div className="header-left-breadcrumbs">
            <div className="breadcrumb-trail">
              <span>InsightOps AI</span>
              <span>/</span>
              <span>{activeWorkspace?.name || "Corporate Analytics"}</span>
              <span>/</span>
              <span className="breadcrumb-active">{heading[1]}</span>
            </div>
            <div className="header-view-title-row">
              <h1 className="header-view-title">{heading[1]}</h1>
              {profile && (
                <span className="dataset-quality-pill" title="Automated data hygiene score">
                  <span className="telemetry-pulse-dot" />
                  {profile.quality_score || 94}% Quality
                </span>
              )}
            </div>
          </div>

          <div className="header-actions">
            {/* Global Search & Command Palette Trigger */}
            <button
              type="button"
              className="global-search-trigger"
              onClick={() => setCommandPaletteOpen(true)}
              title="Search reports, datasets, views (Cmd+K)"
            >
              <Search size={14} />
              <span>Search...</span>
              <span className="kbd-shortcut">⌘K</span>
            </button>

            {/* AI Analyst Drawer Trigger */}
            <button
              type="button"
              className="ai-analyst-toggle-btn"
              onClick={() => setAiDrawerOpen(o => !o)}
              title="Open Neural AI Analyst Drawer"
            >
              <AIOrb size={20} state={asking ? "thinking" : "idle"} />
              <span>AI Analyst</span>
            </button>

            {/* Workspace Selector Dropdown */}
            <div className="workspace-selector-dropdown">
              <button
                type="button"
                className="workspace-badge-btn"
                onClick={() => setWsDropdownOpen(o => !o)}
                title="Switch active workspace"
              >
                <Layers size={14} color="#e6c348" />
                <span>{activeWorkspace?.name || "Production Analytics"}</span>
                <ChevronDown size={14} />
              </button>
              {wsDropdownOpen && (
                <div className="workspace-dropdown-menu">
                  <div style={{ padding: "6px 10px", fontSize: "11px", fontWeight: "700", color: "#8a8370", textTransform: "uppercase" }}>
                    Select Workspace
                  </div>
                  {(workspaces || []).map(ws => (
                    <button
                      key={ws.id}
                      type="button"
                      className={`workspace-item ${activeWorkspace?.id === ws.id ? "active" : ""}`}
                      onClick={() => {
                        switchWorkspace(ws.id);
                        setWsDropdownOpen(false);
                        addToast(`Switched to workspace: ${ws.name}`, "success");
                      }}
                    >
                      <span>{ws.name}</span>
                      <span className="role-tag">{ws.role || "Member"}</span>
                    </button>
                  ))}
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: "6px", paddingTop: "6px" }}>
                    <button
                      type="button"
                      className="dropdown-link"
                      onClick={() => {
                        setActiveView("workspaces");
                        setWsDropdownOpen(false);
                      }}
                    >
                      <Plus size={14} /> Manage All Workspaces
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* System Status Indicator */}
            <button
              type="button"
              className="system-health-pill"
              onClick={() => setActiveView("settings")}
              title="API & Storage Engines Operational (Click to view Health)"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "20px",
                background: "rgba(16, 185, 129, 0.12)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                color: "#10b981",
                fontSize: "11px",
                fontWeight: "600",
                cursor: "pointer"
              }}
            >
              <span className="telemetry-pulse-dot" style={{ background: "#10b981", width: "7px", height: "7px" }} />
              <span>Operational</span>
            </button>

            {/* Notifications & Alert Center Dropdown */}
            <div className="notifications-dropdown-wrapper" style={{ position: "relative" }}>
              <button
                type="button"
                className="icon-action notif-btn"
                onClick={() => setNotifDropdownOpen(o => !o)}
                title="Active Notifications & SLA Alerts"
                aria-label="View notifications"
                style={{ position: "relative" }}
              >
                <Bell size={17} />
                {alerts?.length > 0 && (
                  <span style={{
                    position: "absolute",
                    top: "3px",
                    right: "3px",
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    background: "#e6c348",
                    boxShadow: "0 0 6px #e6c348"
                  }} />
                )}
              </button>
              {notifDropdownOpen && (
                <div className="user-dropdown-card" style={{ width: "290px", right: 0, padding: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "6px" }}>
                    <strong style={{ fontSize: "12px", color: "#f8fafc" }}>Notifications & Alerts</strong>
                    <span style={{ fontSize: "10px", color: "#e6c348" }}>{alerts.length} Rules Active</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "200px", overflowY: "auto" }}>
                    {alerts.slice(0, 4).map((a, i) => (
                      <div key={i} style={{ padding: "6px 8px", borderRadius: "6px", background: "rgba(255,255,255,0.04)", fontSize: "11px" }}>
                        <div style={{ color: "#e2e8f0", fontWeight: "600" }}>{a.name || "Threshold Monitor"}</div>
                        <div style={{ color: "#94a3b8", fontSize: "10px" }}>Metric: {a.metric_column} • Severity: {a.severity}</div>
                      </div>
                    ))}
                    {alerts.length === 0 && (
                      <div style={{ padding: "10px", textAlign: "center", color: "#64748b", fontSize: "11px" }}>
                        No triggered alerts or critical notices.
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="dropdown-link"
                    style={{ marginTop: "8px", justifyContent: "center", color: "#e6c348", fontSize: "11px" }}
                    onClick={() => {
                      setActiveView("alerts");
                      setNotifDropdownOpen(false);
                    }}
                  >
                    Open Alert Center →
                  </button>
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            <button
              className="icon-action"
              type="button"
              onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {/* Upload Dataset Button */}
            <button
              className="enterprise-btn primary"
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading || previewing}
            >
              <Upload size={15} />
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

            {/* User Profile Menu */}
            <div className="user-profile-menu">
              <button
                type="button"
                className="user-avatar-btn"
                onClick={() => setUserDropdownOpen(o => !o)}
                title="Account menu"
              >
                <div className="avatar-circle">
                  {user?.avatar_url ? <img src={user.avatar_url} alt="" /> : (user?.full_name?.charAt(0) || "A")}
                </div>
              </button>
              {userDropdownOpen && (
                <div className="user-dropdown-card">
                  <div className="user-dropdown-header">
                    <strong>{user?.full_name || "Administrator"}</strong>
                    <span>{user?.email || "admin@insightops.ai"}</span>
                    <div style={{ marginTop: "4px" }}>
                      <span className="saas-badge admin" style={{ fontSize: "10px" }}>
                        {activeWorkspace?.role || "Owner"}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="dropdown-link"
                    onClick={() => { setActiveView("workspaces"); setUserDropdownOpen(false); }}
                  >
                    <Layers size={15} /> Workspaces & Team
                  </button>
                  <button
                    type="button"
                    className="dropdown-link"
                    onClick={() => { setActiveView("settings"); setUserDropdownOpen(false); }}
                  >
                    <Sliders size={15} /> Settings & Telemetry
                  </button>
                  <button
                    type="button"
                    className="dropdown-link"
                    onClick={() => { setActiveView("activity"); setUserDropdownOpen(false); }}
                  >
                    <Activity size={15} /> Audit Log
                  </button>
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: "6px", paddingTop: "6px" }}>
                    <button
                      type="button"
                      className="dropdown-link danger"
                      onClick={() => { setUserDropdownOpen(false); onSignOut ? onSignOut() : logout(); }}
                    >
                      <LogOut size={15} /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
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

        <main className="enterprise-workspace-canvas">
          {/* Quick Sample Dataset Bar */}
          <div className="sample-datasets-bar">
          <span style={{ fontSize: "11px", fontWeight: "600", color: "#94a3b8" }}>Sample Datasets:</span>
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

        {/* 1. SAAS DASHBOARD OVERVIEW VIEW */}
        {activeView === "overview" && (
          <SaaSDashboardView
            onNavigate={(view, extra) => {
              setActiveView(view);
              if (extra?.datasetId) loadDataset(extra.datasetId);
            }}
            datasetId={datasetId}
            datasetProfile={profile}
          />
        )}

        {/* 2. DATA HUB VIEW */}
        {activeView === "datahub" && (
          <DataHubView
            activeDatasetId={datasetId}
            onSelectDataset={(newId) => {
              setDatasetId(newId);
              localStorage.setItem("insightops.datasetId", newId);
              loadDataset(newId);
            }}
            onNavigate={(view) => {
              setActiveView(view);
            }}
            onUploadClick={() => fileInput.current?.click()}
            addToast={addToast}
          />
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

            {/* Studio: Cleaning Actions & Interactive Preparation */}
            {activeSection === "Cleaning Actions" && (
              <DataCleaningStudio
                datasetId={datasetId}
                profile={profile}
                schema={schema}
                quality={quality}
                onDatasetUpdated={() => loadDataset(datasetId)}
                addToast={addToast}
              />
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

        {/* 7. ALERTS CENTER VIEW */}
        {activeView === "alerts" && (
          <AlertsCenterView datasetId={datasetId} addToast={addToast} />
        )}

        {/* 8. REPORTS MANAGER VIEW */}
        {activeView === "reports" && (
          <ReportsManagerView
            onNavigate={(view, extra) => {
              setActiveView(view);
              if (extra?.datasetId) loadDataset(extra.datasetId);
            }}
            addToast={addToast}
          />
        )}

        {/* 9. WORKSPACES & RBAC VIEW */}
        {activeView === "workspaces" && (
          <WorkspacesView addToast={addToast} />
        )}

        {/* 10. AUDIT & ACTIVITY VIEW */}
        {activeView === "activity" && (
          <ActivityLogView addToast={addToast} />
        )}

        {/* 11. DATASET VIEW (Live Workspace) */}
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

        {/* 12. SETTINGS & SYSTEM HEALTH VIEW */}
        {activeView === "settings" && (
          <ProfileSettingsView
            activeWorkspace={activeWorkspace}
            workspaces={workspaces}
            compactNumbers={compactNumbers}
            setCompactNumbers={setCompactNumbers}
            addToast={addToast}
          />
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

        </main>

        <footer className="enterprise-status-footer">
          <div className="status-footer-left">
            <span className="telemetry-live-dot" />
            <span className="status-item"><b>Telemetry:</b> Active</span>
            <span className="status-sep">/</span>
            <span className="status-item"><b>Workspace:</b> {activeWorkspace?.name || "Primary"}</span>
            <span className="status-sep">/</span>
            <span className="status-item"><b>Dataset:</b> {profile?.filename || datasetId}</span>
            {profile?.rows && (
              <>
                <span className="status-sep">/</span>
                <span className="status-item"><b>Volume:</b> {profile.rows.toLocaleString()} rows · {profile.column_count || profile.columns?.length || 0} cols</span>
              </>
            )}
          </div>
          <div className="status-footer-right">
            <span className="status-badge-mini">Deterministic Engine &lt; 12ms</span>
            <span className="status-badge-mini">RFC 7519 JWT</span>
            <span className="status-item status-muted">InsightOps AI Enterprise v2.4</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
