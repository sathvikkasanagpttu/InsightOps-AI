import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle, BarChart3, BrainCircuit, ChevronLeft, ChevronRight, Database,
  Download, Filter, LogOut, Search, Send, ShieldCheck, Sparkles, Trash2, Upload, X
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis
} from "recharts";
import { api } from "./lib/api";
import "./universal.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const sections = ["Overview", "Schema", "Quality", "Missing Values", "Duplicates", "Data Types", "Sensitive Data", "Cleaning Actions", "Data Table"];
const navItems = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "data", label: "Data Studio", icon: Database },
  { id: "analyst", label: "AI Analyst", icon: BrainCircuit },
  { id: "explore", label: "Explore", icon: Search },
  { id: "forecast", label: "Forecasts", icon: TrendingUp },
  { id: "anomalies", label: "Anomalies", icon: AlertTriangle },
  { id: "alerts", label: "Alerts", icon: AlertTriangle },
  { id: "reports", label: "Reports", icon: Download },
  { id: "dataset", label: "Dataset", icon: Database },
  { id: "settings", label: "Settings", icon: Filter }
];
const uploadStages = ["File uploaded", "Schema detected", "Data cleaned", "Quality checked", "Analytics generated"];

function formatValue(kpi, compact = false) {
  const value = Number(kpi.value ?? 0);
  const countFormat = compact ? { notation: "compact", maximumFractionDigits: 1 } : { maximumFractionDigits: 1 };
  if (kpi.format === "currency") return `₹${value.toLocaleString("en-IN", compact ? { notation: "compact", maximumFractionDigits: 1 } : { maximumFractionDigits: 2 })}`;
  if (kpi.format === "percent") return `${value.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`;
  return value.toLocaleString("en-IN", countFormat);
}

function Kpi({ item, compact }) {
  return <div className="stat glass"><div className="icon"><Database size={18} /></div><div><span>{item.label}</span><strong>{formatValue(item, compact)}</strong><small>{item.source_columns?.length ? item.source_columns.join(", ") : "Dataset profile"}</small></div></div>;
}

function ChartPanel({ chart }) {
  const line = chart.kind === "line";
  const pie = chart.kind === "pie";
  const scatter = chart.kind === "scatter";
  const palette = ["#e6c348", "#b98d28", "#f0cf55", "#8d7132", "#d8bb68", "#75602b"];
  const formatter = value => chart.y_label === "revenue"
    ? `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
    : Number(value).toLocaleString("en-IN", { maximumFractionDigits: 1 });
  return <section className="panel glass data-chart-panel">
    <span>{line ? "TIME SERIES" : "DIMENSION ANALYSIS"}</span><h2>{chart.title}</h2>
    <div className="chart"><ResponsiveContainer>
      {line ? <LineChart data={chart.data}><CartesianGrid stroke="#ffffff10" vertical={false} /><XAxis dataKey={chart.x_key} tick={{ fill: "#8291a8", fontSize: 10 }} /><YAxis hide /><Tooltip formatter={formatter} contentStyle={{ background: "#0c1827", border: "1px solid #ffffff20" }} /><Line type="monotone" dataKey={chart.y_key} name={chart.y_label === "revenue" ? "Revenue" : "Records"} stroke="#e6c348" strokeWidth={3} dot={false} /></LineChart>
        : pie ? <PieChart><Tooltip formatter={formatter} /><Legend /><Pie data={chart.data} dataKey="value" nameKey="label" innerRadius={48} outerRadius={82} paddingAngle={2}>{chart.data.map((item, index) => <Cell key={item.label} fill={palette[index % palette.length]} />)}</Pie></PieChart>
          : scatter ? <ScatterChart><CartesianGrid stroke="#ffffff10" /><XAxis type="number" dataKey="x" name={chart.x_label} tick={{ fill: "#a49d89", fontSize: 10 }} /><YAxis type="number" dataKey="y" name={chart.y_label} tick={{ fill: "#a49d89", fontSize: 10 }} /><Tooltip cursor={{ strokeDasharray: "3 3" }} /><Scatter name={`${chart.x_label} / ${chart.y_label}`} data={chart.data} fill="#e6c348" /></ScatterChart>
            : <BarChart data={chart.data}><CartesianGrid stroke="#ffffff10" vertical={false} /><XAxis dataKey={chart.x_key} tick={{ fill: "#8291a8", fontSize: 10 }} /><YAxis hide allowDecimals={false} /><Tooltip formatter={formatter} contentStyle={{ background: "#0c1827", border: "1px solid #ffffff20" }} /><Bar dataKey={chart.y_key} name={chart.y_label === "revenue" ? "Revenue" : "Records"} fill="#e6c348" radius={[5, 5, 0, 0]} /></BarChart>}
    </ResponsiveContainer></div>
    <small className="source-note">Source: {chart.source_columns.join(", ")}</small>
  </section>;
}

function App({ onSignOut }) {
  const [activeView, setActiveView] = useState("overview");
  const [activeSection, setActiveSection] = useState("Overview");
  const [datasetId, setDatasetId] = useState(() => localStorage.getItem("insightops.datasetId") || "demo-sales");
  const [profile, setProfile] = useState(null);
  const [schema, setSchema] = useState([]);
  const [quality, setQuality] = useState(null);
  const [kpis, setKpis] = useState([]);
  const [charts, setCharts] = useState([]);
  const [insights, setInsights] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [stagedFile, setStagedFile] = useState(null);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [uploadReady, setUploadReady] = useState(false);
  const [error, setError] = useState("");
  const [askError, setAskError] = useState("");
  const [asking, setAsking] = useState(false);
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
  const fileInput = useRef(null);
  const datasetQuery = `?dataset_id=${encodeURIComponent(datasetId)}`;

  async function loadDataset(id) {
    setLoading(true);
    setError("");
    try {
      const query = `?dataset_id=${encodeURIComponent(id)}`;
      const [nextProfile, nextSchema, nextQuality, nextKpis, nextCharts, nextInsights, nextForecast, nextAlerts] = await Promise.all([
        api(`/api/dataset/profile${query}`),
        api(`/api/dataset/schema${query}`),
        api(`/api/dataset/quality${query}`),
        api(`/api/dataset/kpis${query}`),
        api(`/api/dataset/charts${query}`),
        api(`/api/dataset/insights${query}`),
        api(`/api/dataset/forecast${query}`),
        api(`/api/dataset/alerts${query}`)
      ]);
      setProfile(nextProfile);
      setSchema(nextSchema.columns);
      setQuality(nextQuality);
      setKpis(nextKpis.kpis);
      setCharts(nextCharts);
      setInsights(nextInsights);
      setForecast(nextForecast);
      setAlerts(nextAlerts);
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

  useEffect(() => { loadDataset(datasetId); }, [datasetId]);

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
      setError("Choose a CSV, XLSX or XLS dataset.");
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
      setActiveView("overview");
      setActiveSection("Overview");
      setDatasetId(result.dataset_id);
      setPreview(null);
      setStagedFile(null);
      setUploadReady(true);
    } catch (uploadError) {
      setError(uploadError.message);
      setActiveView("data");
      setActiveSection("Overview");
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
      setTableData(await api(`/api/dataset/rows?${params.toString()}`));
    } catch (tableError) {
      setError(tableError.message);
    }
  }

  useEffect(() => {
    if (activeView === "data" && activeSection === "Data Table") loadTableRows();
  }, [activeView, activeSection, datasetId, tablePage, tableSearch, tableSort, tableSortOrder]);

  async function askAnalyst(event) {
    event?.preventDefault();
    if (!question.trim() || asking) return;
    setAsking(true);
    setAskError("");
    try {
      const result = await api("/api/analyst/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset_id: datasetId, question: question.trim() })
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
      if (sortBy === "missing" || sortBy === "unique") return right[sortBy === "missing" ? "null_percentage" : "unique_count"] - left[sortBy === "missing" ? "null_percentage" : "unique_count"];
      return left[sortBy === "type" ? "semantic_type" : "original_name"].localeCompare(right[sortBy === "type" ? "semantic_type" : "original_name"]);
    });

  const heading = {
    overview: ["LIVE DATA INTELLIGENCE", profile?.dataset_type || "Dataset overview", profile?.filename || "Analyze, understand and act on your data."],
    data: ["DATA WORKSPACE", "Data Studio", profile?.filename || "Inspect your dataset schema and quality."],
    analyst: ["DATASET-AWARE ANALYSIS", "AI Analyst", "Answers are calculated from this dataset."],
    explore: ["EXPLORATORY DATA ANALYSIS", "Explore the data", "Distributions, relationships and numeric behavior."],
    forecast: ["PREDICTIVE ANALYTICS", forecast?.metric === "revenue" ? "Revenue forecast" : "Record volume forecast", "Forecasts appear only when dated periods support them."],
    anomalies: ["ANOMALY DETECTION", "Outlier explorer", "Potentially unusual numeric observations."],
    alerts: ["QUALITY MONITORING", "Dataset alerts", "Issues and outliers detected in the active dataset."],
    reports: ["ANALYSIS EXPORTS", "Dataset report", "Evidence-backed summary of this analysis."],
    dataset: ["LIVE DATA WORKSPACE", "Current dataset", profile?.filename || "Manage the active dataset session."],
    settings: ["WORKSPACE SETTINGS", "Preferences", "Local display and privacy controls."]
  }[activeView];

  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><div className="logo"><Sparkles /></div><div><b>InsightOps</b><span>UNIVERSAL DATA INTELLIGENCE</span></div></div>
      <nav aria-label="Main navigation">{navItems.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={activeView === id ? "active" : ""} onClick={() => setActiveView(id)} aria-current={activeView === id ? "page" : undefined}><Icon size={18} /><span>{label}</span></button>)}</nav>
      <div className="side-card"><ShieldCheck size={20} /><b>Privacy first</b><p>PII is masked in analysis and no external AI service is used.</p></div>
    </aside>

    <main>
      <header className="universal-header">
        <div><p className="eyebrow">{heading[0]}</p><h1>{heading[1]} <em>{heading[2]}</em></h1>{profile && <p className="dataset-meta">{profile.filename} · {profile.rows.toLocaleString()} records · {profile.column_count} columns</p>}</div>
        <div className="header-actions"><button className="upload" type="button" onClick={() => fileInput.current?.click()} disabled={uploading || previewing}><Upload size={17} />{uploading ? "Analyzing..." : "Upload dataset"}</button>{profile && <a className="icon-action" href={`${API_BASE}/api/dataset/export-clean${datasetQuery}`} title="Download cleaned dataset" aria-label="Download cleaned dataset"><Download size={17} /></a>}{profile && datasetId !== "demo-sales" && <button className="icon-action remove-dataset" type="button" onClick={removeDataset} aria-label="Remove active dataset" title="Remove active dataset"><Trash2 size={17} /></button>}<button className="icon-action sign-out-action" type="button" onClick={onSignOut} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button></div>
        <input ref={fileInput} className="file-input" type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={selectDatasetFile} aria-label="Choose CSV or Excel dataset" />
      </header>

      {uploading && <div className="upload-progress" role="status"><span className="loading-dot" />Reading, cleaning and analyzing dataset...</div>}
      {previewing && <div className="upload-progress" role="status"><span className="loading-dot" />Inspecting headers and sample rows...</div>}
      {uploadReady && !uploading && <div className="upload-complete" role="status"><b>Dataset ready</b><div>{uploadStages.map(stage => <span key={stage}>✓ {stage}</span>)}</div></div>}
      {error && <p className="notice error" role="alert">{error}</p>}
      {loading && <p className="muted page-loading">Loading dataset analysis...</p>}

      {!loading && profile && activeView === "overview" && <>
        <section className="dataset-type glass"><div><span>DATASET TYPE</span><h2>{profile.dataset_type}</h2><p>Confidence {Math.round(profile.dataset_type_confidence * 100)}% · {profile.rows.toLocaleString()} records</p></div><div className="entity-list">{profile.detected_entities.map(entity => <span key={entity}>{entity}</span>)}</div></section>
        <section className="stats dynamic-kpis">{kpis.map(item => <Kpi key={item.label} item={item} compact={compactNumbers} />)}</section>
        {profile.sensitive_columns.length > 0 && <div className="pii-notice"><AlertTriangle size={18} /><div><b>Sensitive columns detected</b><p>{profile.sensitive_columns.map(column => `${column.original_name || column.name} (${column.semantic_type})`).join(" · ")}. Values are masked and never sent to an external AI provider.</p></div></div>}
        <section className="chart-grid">{charts.map((chart, index) => <ChartPanel key={`${chart.title}-${index}`} chart={chart} />)}</section>
        {profile.numeric_statistics.length > 0 && <section className="panel glass numeric-summary"><span>NUMERIC ANALYSIS</span><h2>Field statistics</h2><div className="table-scroll"><table><thead><tr><th>Field</th><th>Count</th><th>Mean</th><th>Median</th><th>Minimum</th><th>Maximum</th></tr></thead><tbody>{profile.numeric_statistics.map(item => <tr key={item.column}><td>{item.column}</td><td>{item.count.toLocaleString()}</td><td>{item.mean.toLocaleString()}</td><td>{item.median.toLocaleString()}</td><td>{item.min.toLocaleString()}</td><td>{item.max.toLocaleString()}</td></tr>)}</tbody></table></div></section>}
        <section className="grid two insight-grid"><div className="panel glass"><span>DATA INSIGHTS</span><h2>What stands out</h2>{insights.length ? insights.map((item, index) => <div className="insight-row" key={`${item.title}-${index}`}><b>{item.title}</b><p>{item.text}</p><small>Source: {item.source_columns.join(", ")} · {item.calculation}</small></div>) : <p className="muted">No high-confidence insights were detected.</p>}</div>
          <div className="panel glass"><span>DATA QUALITY</span><h2>{quality.overall_score}% quality score</h2>{Object.entries(quality.components).map(([name, value]) => <div className="quality-meter" key={name}><span>{name.replaceAll("_", " ")}</span><div className="meter"><i style={{ width: `${value}%` }} /></div><b>{value}%</b></div>)}<p className="muted">{quality.missing_values} missing cells · {quality.duplicate_rows} duplicate rows · {quality.invalid_values} invalid values</p></div>
        </section>
      </>}

      {!loading && profile && activeView === "data" && <section className="panel glass page-panel data-studio">
        <div className="panel-head"><div><span>DATASET PROFILE</span><h2>{profile.filename}</h2></div><div className="studio-actions"><a className="upload download-clean" href={`${API_BASE}/api/dataset/export-clean${datasetQuery}`}><Download size={16} />Export CSV</a><a className="upload download-clean" href={`${API_BASE}/api/dataset/export-clean.xlsx${datasetQuery}`}><Download size={16} />Export Excel</a><button className="text-button remove-dataset-link" type="button" onClick={removeDataset} disabled={datasetId === "demo-sales"}>Remove dataset</button></div></div>
        <div className="dataset-summary"><div><span>Records</span><strong>{profile.rows.toLocaleString()}</strong></div><div><span>Columns</span><strong>{profile.column_count}</strong></div><div><span>Quality</span><strong>{quality.overall_score}%</strong></div><div><span>Duplicates</span><strong>{quality.duplicate_rows.toLocaleString()}</strong></div><div><span>Missing values</span><strong>{quality.missing_values.toLocaleString()}</strong></div></div>
        <div className="studio-tabs" role="tablist" aria-label="Data Studio sections">{sections.map(section => <button key={section} type="button" role="tab" aria-selected={activeSection === section} className={activeSection === section ? "selected" : ""} onClick={() => setActiveSection(section)}>{section}</button>)}</div>

        {activeSection === "Overview" && <div className="studio-overview"><div className="panel glass"><span>DATASET CLASSIFICATION</span><h2>{profile.dataset_type}</h2><p className="muted">Confidence {Math.round(profile.dataset_type_confidence * 100)}%</p><p>{profile.detected_entities.join(" · ") || "No semantic entities detected."}</p></div><div className="panel glass"><span>CLEANING ACTIONS</span><h2>Non-destructive preparation</h2><ul>{profile.cleaning_report.actions.map(action => <li key={action}>{action}</li>)}</ul><p className="muted">The original upload remains unchanged. Missing values and duplicate rows are reported, not silently removed.</p></div></div>}

        {(activeSection === "Schema" || activeSection === "Data Types") && <>
          <div className="schema-controls"><label className="search-field"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search columns" /></label><label className="control-select"><Filter size={15} /><select value={semanticFilter} onChange={event => setSemanticFilter(event.target.value)} aria-label="Filter columns"><option value="all">All types</option><option value="pii">Sensitive / PII</option>{[...new Set(schema.map(column => column.semantic_type))].sort().map(type => <option key={type} value={type}>{type}</option>)}</select></label><label className="control-select"><select value={sortBy} onChange={event => setSortBy(event.target.value)} aria-label="Sort columns"><option value="name">Sort: name</option><option value="type">Sort: semantic type</option><option value="missing">Sort: missing first</option><option value="unique">Sort: unique values</option></select></label></div>
          <div className="table-scroll"><table><thead><tr><th>Column</th><th>Data type</th><th>Semantic type</th><th>Confidence</th><th>Nulls</th><th>Unique</th><th>Masked samples</th></tr></thead><tbody>{filteredSchema.map(column => <tr key={column.name}><td>{column.original_name}</td><td>{column.data_type}</td><td>{column.semantic_type}</td><td>{Math.round(column.confidence * 100)}%</td><td>{column.null_percentage}%</td><td>{column.unique_count.toLocaleString()}</td><td>{column.sample_values.join(", ") || "--"}</td></tr>)}</tbody></table>{filteredSchema.length === 0 && <p className="muted">No columns match these filters.</p>}</div>
        </>}

        {activeSection === "Quality" && <div className="quality-section"><h2>Quality score {quality.overall_score}%</h2>{Object.entries(quality.components).map(([name, value]) => <div className="quality-meter" key={name}><span>{name.replaceAll("_", " ")}</span><div className="meter"><i style={{ width: `${value}%` }} /></div><b>{value}%</b></div>)}<p>Completeness, uniqueness, validity, consistency and type correctness are averaged equally.</p></div>}
        {activeSection === "Missing Values" && <div className="table-scroll"><table><thead><tr><th>Column</th><th>Missing</th><th>Percent</th></tr></thead><tbody>{quality.missing_by_column.map(item => <tr key={item.column}><td>{item.column}</td><td>{item.count}</td><td>{item.percentage}%</td></tr>)}</tbody></table>{quality.missing_by_column.length === 0 && <p className="muted">No missing values detected.</p>}</div>}
        {activeSection === "Duplicates" && <div className="quality-section"><h2>{quality.duplicate_rows.toLocaleString()} duplicate rows detected</h2><p className="muted">Exact duplicate rows are flagged. They remain in the cleaned export so records are never silently discarded.</p></div>}
        {activeSection === "Sensitive Data" && <div className="sensitive-section">{profile.sensitive_columns.length ? <><div className="pii-notice"><AlertTriangle size={18} /><div><b>Potentially identifiable fields</b><p>These columns are masked in sample values and excluded from charts and AI summaries.</p></div></div>{profile.sensitive_columns.map(column => <div className="signal" key={column.name}><ShieldCheck size={18} /><div><b>{column.original_name}</b><p>{column.semantic_type} · {column.message}</p></div></div>)}</> : <p className="muted">No email or phone columns were detected.</p>}</div>}
        {activeSection === "Cleaning Actions" && <div className="quality-section"><h2>Applied to the clean copy</h2><ul>{profile.cleaning_report.actions.map(action => <li key={action}>{action}</li>)}</ul><h3>Invalid values by column</h3>{quality.invalid_by_column.length ? quality.invalid_by_column.map(item => <p key={item.column}>{item.column}: {item.count}</p>) : <p className="muted">No invalid typed values detected.</p>}<p className="muted">Download the cleaned copy above. The uploaded source file is retained unchanged in this dataset session.</p></div>}

        {activeSection === "Data Table" && <div className="data-table-explorer"><div className="schema-controls"><label className="search-field"><Search size={16} /><input value={tableSearch} onChange={event => { setTableSearch(event.target.value); setTablePage(1); }} placeholder="Search dataset rows" /></label><label className="control-select"><select value={tableSort} onChange={event => setTableSort(event.target.value)} aria-label="Sort data rows"><option value="">Sort: original order</option>{schema.filter(column => !["email", "phone"].includes(column.semantic_type)).map(column => <option key={column.name} value={column.name}>{column.original_name}</option>)}</select></label><button className="text-button" type="button" onClick={() => setTableSortOrder(value => value === "asc" ? "desc" : "asc")}>{tableSortOrder === "asc" ? "Ascending" : "Descending"}</button></div><div className="column-visibility">{schema.map(column => <label key={column.name}><input type="checkbox" checked={!hiddenColumns.includes(column.name)} onChange={() => setHiddenColumns(current => current.includes(column.name) ? current.filter(name => name !== column.name) : [...current, column.name])} />{column.original_name}</label>)}</div><div className="table-scroll"><table><thead><tr>{tableData?.columns.filter(column => !hiddenColumns.includes(column.name)).map(column => <th key={column.name} aria-sort={tableSort === column.name ? tableSortOrder === "asc" ? "ascending" : "descending" : "none"}>{column.original_name}</th>)}</tr></thead><tbody>{tableData?.rows.map((row, index) => <tr key={`${tablePage}-${index}`}>{tableData.columns.filter(column => !hiddenColumns.includes(column.name)).map(column => <td className={row[column.name] == null ? "null-cell" : ""} key={column.name}>{row[column.name] ?? "Missing"}</td>)}</tr>)}</tbody></table></div><div className="table-pagination"><span>Rows {(tablePage - 1) * 25 + 1}–{Math.min(tablePage * 25, tableData?.total || 0)} of {(tableData?.total || 0).toLocaleString()}</span><div><button className="icon-action" type="button" disabled={tablePage <= 1} aria-label="Previous page" onClick={() => setTablePage(page => Math.max(1, page - 1))}><ChevronLeft size={17} /></button><span>Page {tablePage} of {Math.max(1, Math.ceil((tableData?.total || 0) / 25))}</span><button className="icon-action" type="button" disabled={tablePage * 25 >= (tableData?.total || 0)} aria-label="Next page" onClick={() => setTablePage(page => page + 1)}><ChevronRight size={17} /></button></div></div></div>}
      </section>}

      {!loading && profile && activeView === "analyst" && <section className="panel glass page-panel analyst-panel"><span>LOCAL, DATASET-AWARE ANALYSIS</span><h2>Ask your dataset</h2><p className="muted">Answers include supporting values, source columns and calculation details. Sensitive values are never returned.</p>
        <div className="chat analyst-chat" aria-live="polite">{answer ? <><b>{answer.answer}</b><div className="answer-evidence">{answer.evidence.map((item, index) => <small key={`${item}-${index}`}>{item}</small>)}</div><small>Source columns: {answer.source_columns.join(", ") || "dataset profile"}</small><small>Calculation: {answer.calculation}</small></> : <p className="muted">Try “Which region has the most records?”, “Show me the status distribution”, or “Are there duplicate records?”</p>}</div>
        {askError && <p className="notice error" role="alert">{askError}</p>}<form className="ask" onSubmit={askAnalyst}><input value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ask a question about this dataset..." aria-label="Ask a question about this dataset" /><button type="submit" disabled={asking || !question.trim()} aria-label="Send question"><Send size={16} /></button></form>
      </section>}

      {!loading && profile && activeView === "explore" && <>
        <section className="chart-grid">{charts.map((chart, index) => <ChartPanel key={`explore-${chart.title}-${index}`} chart={chart} />)}</section>
        {profile.correlations.length > 0 && <section className="panel glass page-panel"><span>NUMERIC RELATIONSHIPS</span><h2>Correlation analysis</h2><div className="table-scroll"><table><thead><tr><th>Measure A</th><th>Measure B</th><th>Pearson r</th><th>Observations</th></tr></thead><tbody>{profile.correlations.map(item => <tr key={`${item.x}-${item.y}`}><td>{item.x}</td><td>{item.y}</td><td>{item.pearson.toFixed(3)}</td><td>{item.sample_size.toLocaleString()}</td></tr>)}</tbody></table></div><p className="muted">Correlations describe association, not causation.</p></section>}
        {profile.numeric_statistics.length > 0 && <section className="panel glass page-panel"><span>DISTRIBUTIONS</span><h2>Numeric field profile</h2><div className="table-scroll"><table><thead><tr><th>Field</th><th>Count</th><th>Mean</th><th>Median</th><th>Std dev</th><th>Min</th><th>Q1</th><th>Q3</th><th>Max</th></tr></thead><tbody>{profile.numeric_statistics.map(item => <tr key={item.column}><td>{item.column}</td><td>{item.count}</td><td>{item.mean.toLocaleString()}</td><td>{item.median.toLocaleString()}</td><td>{item.std.toLocaleString()}</td><td>{item.min.toLocaleString()}</td><td>{item.q1.toLocaleString()}</td><td>{item.q3.toLocaleString()}</td><td>{item.max.toLocaleString()}</td></tr>)}</tbody></table></div></section>}
      </>}

      {!loading && profile && activeView === "forecast" && <section className="panel glass page-panel"><span>DATASET-AWARE FORECAST</span><h2>{forecast.metric === "revenue" ? "Revenue forecast" : "Record volume forecast"}</h2>
        {forecast.available ? <><div className="forecast-list">{forecast.values.map(item => <div className="forecast-row" key={item.period}><span>{item.period}</span><strong>{forecast.metric === "revenue" ? `₹${Number(item.value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : `${item.value.toLocaleString()} records`}</strong></div>)}</div><h3>History and forecast</h3><div className="chart forecast-chart"><ResponsiveContainer><LineChart data={[...forecast.history.map(item => ({ ...item, kind: item.value })), ...forecast.values.map(item => ({ ...item, forecast: item.value }))]}><CartesianGrid stroke="#ffffff10" vertical={false} /><XAxis dataKey="period" tick={{ fill: "#8291a8", fontSize: 10 }} /><YAxis hide /><Tooltip /><Line type="monotone" dataKey="kind" name="Historical" stroke="#77e5ce" strokeWidth={3} dot={false} /><Line type="monotone" dataKey="forecast" name="Forecast" stroke="#ffbf69" strokeWidth={3} strokeDasharray="6 5" /></LineChart></ResponsiveContainer></div><small className="source-note">Source columns: {forecast.source_columns.join(", ")}</small></> : <div className="forecast-unavailable"><h3>Forecast unavailable</h3><p>{forecast.reason}</p><p>Available analytics: {charts.map(chart => chart.title).join(" · ") || "Distribution · Segmentation · Data quality"}</p></div>}
      </section>}

      {!loading && profile && activeView === "alerts" && <section className="panel glass page-panel alert-list"><span>RULES AND STATISTICAL CHECKS</span><h2>Dataset alerts</h2>{alerts.length ? alerts.map((item, index) => <div className="signal" key={`${item.title}-${index}`}><AlertTriangle size={18} /><div><b>{item.title}</b><p>{item.detail}</p><small>Source: {item.source_columns.join(", ") || "dataset-wide check"}</small></div><span className={`severity ${item.severity}`}>{item.severity}</span></div>) : <p className="muted">No quality or outlier alerts for this dataset.</p>}</section>}

      {!loading && profile && activeView === "anomalies" && <section className="panel glass page-panel alert-list"><span>NUMERIC OUTLIER DETECTION · IQR</span><h2>Potential anomalies</h2>{alerts.filter(item => item.title.toLowerCase().includes("outlier") || item.title.toLowerCase().includes("unusual")).length ? alerts.filter(item => item.title.toLowerCase().includes("outlier") || item.title.toLowerCase().includes("unusual")).map((item, index) => <div className="signal" key={`${item.title}-${index}`}><AlertTriangle size={18} /><div><b>{item.title}</b><p>{item.detail}</p><small>Source: {item.source_columns.join(", ")}</small></div><span className={`severity ${item.severity}`}>{item.severity}</span></div>) : <p className="muted">No numeric outliers were detected. Fields with no variance or fewer than four usable values are skipped.</p>}</section>}

      {!loading && profile && activeView === "reports" && <section className="panel glass page-panel report-view"><div className="panel-head"><div><span>GENERATED FROM ACTIVE SESSION</span><h2>{profile.filename} analysis report</h2></div><div className="studio-actions"><a className="upload download-clean" href={`${API_BASE}/api/dataset/report?dataset_id=${encodeURIComponent(datasetId)}`} download={`${profile.filename}.analysis.json`}><Download size={16} />Export JSON</a><button className="upload" type="button" onClick={() => window.print()}>Print report</button></div></div><div className="dataset-summary"><div><span>Records</span><strong>{profile.rows.toLocaleString()}</strong></div><div><span>Quality</span><strong>{profile.quality_score}%</strong></div><div><span>Data type</span><strong>{profile.dataset_type}</strong></div><div><span>Alerts</span><strong>{alerts.length}</strong></div></div><h3>Key metrics</h3><div className="report-kpis">{kpis.map(item => <p key={item.label}><b>{item.label}:</b> {formatValue(item, compactNumbers)} <small>{item.source_columns.join(", ")}</small></p>)}</div><h3>Evidence-backed insights</h3>{insights.map((item, index) => <div className="insight-row" key={index}><b>{item.title}</b><p>{item.text}</p><small>Source: {item.source_columns.join(", ")} · {item.calculation}</small></div>)}<h3>Quality issues and alerts</h3>{alerts.length ? alerts.map((item, index) => <p key={index}><b>{item.title}:</b> {item.detail}</p>) : <p className="muted">No alerts for this dataset.</p>}</section>}

      {!loading && profile && activeView === "dataset" && <section className="panel glass page-panel"><div className="panel-head"><div><span>ACTIVE DATASET SESSION</span><h2>{profile.filename}</h2></div><div className="studio-actions"><button className="upload" type="button" onClick={() => fileInput.current?.click()}><Upload size={16} />Replace dataset</button>{datasetId !== "demo-sales" && <button className="text-button remove-dataset-link" type="button" onClick={removeDataset}>Remove dataset</button>}</div></div><div className="dataset-summary"><div><span>Status</span><strong>Analyzed</strong></div><div><span>Rows</span><strong>{profile.rows.toLocaleString()}</strong></div><div><span>Columns</span><strong>{profile.column_count}</strong></div><div><span>File size</span><strong>{profile.file_size ? `${(profile.file_size / 1048576).toFixed(2)} MB` : "Bundled"}</strong></div><div><span>Uploaded</span><strong>{profile.created_at ? new Date(profile.created_at).toLocaleString() : "Bundled demo"}</strong></div></div><p className="muted">Raw source is preserved in the local dataset session. Cleaned exports and reports are available from Data Studio and Reports.</p></section>}

      {!loading && profile && activeView === "settings" && <section className="panel glass page-panel settings-view"><span>LOCAL WORKSPACE</span><h2>Preferences and privacy</h2><label className="setting-row"><span><b>Compact KPI numbers</b><small>Show large values using K/M notation on the Overview and Reports pages.</small></span><input type="checkbox" checked={compactNumbers} onChange={event => { setCompactNumbers(event.target.checked); localStorage.setItem("insightops.compactNumbers", String(event.target.checked)); }} /></label><div className="setting-row"><span><b>PII protection</b><small>Email and phone values stay masked in previews, row browsing, charts and Analyst answers.</small></span><ShieldCheck size={18} /></div><div className="setting-row"><span><b>Dataset storage</b><small>Sessions are stored locally under data/uploads and remain until removed.</small></span><Database size={18} /></div></section>}

      {preview && <div className="upload-modal-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget) cancelPreview(); }}><section className="upload-modal panel glass" role="dialog" aria-modal="true" aria-labelledby="preview-title"><div className="panel-head"><div><span>DATA INGESTION STUDIO</span><h2 id="preview-title">Preview before analysis</h2></div><button className="icon-action" type="button" onClick={cancelPreview} aria-label="Cancel upload"><X size={17} /></button></div><div className="file-dropzone" onDragOver={event => { event.preventDefault(); event.currentTarget.classList.add("drag-over"); }} onDragLeave={event => event.currentTarget.classList.remove("drag-over")} onDrop={async event => { event.preventDefault(); event.currentTarget.classList.remove("drag-over"); const file = event.dataTransfer.files?.[0]; if (file) { setStagedFile(file); setPreview(null); await previewFile(file); } }}><span>Drop a replacement dataset here, or choose a file.</span><button type="button" onClick={() => fileInput.current?.click()}>Browse files</button></div><div className="preview-file-meta"><b>{preview.filename}</b><span>{(preview.file_size / (1024 * 1024)).toFixed(2)} MB</span><span>{preview.columns.length} detected columns</span></div>{preview.sheet_names.length > 0 && <label className="sheet-picker">Worksheet<select value={selectedSheet} onChange={async event => { const value = event.target.value; setSelectedSheet(value); await previewFile(stagedFile, value); }} aria-label="Select Excel worksheet">{preview.sheet_names.map(sheet => <option key={sheet} value={sheet}>{sheet}</option>)}</select></label>}<div className="preview-schema">{preview.columns.map(column => <span key={column.column_name}>{column.column_name} <i>{column.semantic_type}</i></span>)}</div><div className="table-scroll preview-table"><table><thead><tr>{preview.columns.map(column => <th key={column.column_name}>{column.column_name}</th>)}</tr></thead><tbody>{preview.preview_rows.map((row, index) => <tr key={index}>{preview.columns.map(column => <td key={column.column_name}>{row[column.column_name] ?? "Missing"}</td>)}</tr>)}</tbody></table></div><p className="muted preview-note">Contact fields are masked in the preview. Analysis preserves the original upload and reports suggested cleaning changes before any export.</p><div className="preview-actions"><button className="text-button" type="button" onClick={cancelPreview} disabled={uploading}>Cancel</button><button className="upload" type="button" onClick={analyzeStagedDataset} disabled={uploading || previewing}><Database size={16} />{uploading ? "Analyzing..." : "Analyze Dataset"}</button></div></section></div>}

      <footer>InsightOps AI · {profile?.filename || "Dataset loading"} · Session {datasetId === "demo-sales" ? "demo" : datasetId.slice(0, 8)}</footer>
    </main>
  </div>;
}

export default App;
