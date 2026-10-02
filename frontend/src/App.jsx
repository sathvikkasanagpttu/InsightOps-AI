import React, { useEffect, useRef, useState } from "react";
import {
    AlertTriangle, ArrowUpRight, BarChart3, BrainCircuit, Database,
    Send, ShieldCheck, Sparkles, TrendingUp, Upload
} from "lucide-react";
import {
    Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
    Tooltip, XAxis, YAxis
} from "recharts";
import { api } from "./lib/api";

const money = value => "₹" + Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const pages = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "data", label: "Data Studio", icon: Database },
    { id: "analyst", label: "AI Analyst", icon: BrainCircuit },
    { id: "forecast", label: "Forecasts", icon: TrendingUp },
    { id: "alerts", label: "Alerts", icon: AlertTriangle }
];

function Stat({ icon: Icon, label, value, delta }) {
    return <div className="stat glass"><div className="icon"><Icon size={19} /></div><div><span>{label}</span><strong>{value}</strong><small className="positive">{delta}</small></div></div>;
}

function App() {
    const [activeView, setActiveView] = useState("overview");
    const [overview, setOverview] = useState({});
    const [trend, setTrend] = useState([]);
    const [categories, setCategories] = useState([]);
    const [regions, setRegions] = useState([]);
    const [anomalies, setAnomalies] = useState([]);
    const [forecast, setForecast] = useState([]);
    const [dataset, setDataset] = useState(null);
    const [question, setQuestion] = useState("");
    const [answer, setAnswer] = useState(null);
    const [apiError, setApiError] = useState("");
    const [askError, setAskError] = useState("");
    const [uploadError, setUploadError] = useState("");
    const [uploadMessage, setUploadMessage] = useState("");
    const [uploading, setUploading] = useState(false);
    const [asking, setAsking] = useState(false);
    const fileInput = useRef(null);

    async function loadDashboard() {
        const requests = [
            { path: "/api/overview", set: setOverview },
            { path: "/api/trends", set: setTrend },
            { path: "/api/categories", set: setCategories },
            { path: "/api/regions", set: setRegions },
            { path: "/api/anomalies", set: setAnomalies },
            { path: "/api/forecast", set: setForecast },
            { path: "/api/dataset", set: setDataset }
        ];
        const results = await Promise.allSettled(requests.map(({ path }) => api(path)));
        const errors = [];
        results.forEach((result, index) => {
            if (result.status === "fulfilled") requests[index].set(result.value);
            else errors.push(result.reason.message);
        });
        setApiError(errors.length ? [...new Set(errors)].join(" ") : "");
    }

    useEffect(() => { loadDashboard(); }, []);

    async function uploadDataset(event) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        setActiveView("data");
        setUploading(true);
        setUploadError("");
        setUploadMessage("");
        try {
            const form = new FormData();
            form.append("file", file);
            const result = await api("/api/dataset", { method: "POST", body: form });
            setDataset(result);
            setUploadMessage(`${result.filename} is now the active analytics dataset.`);
            await loadDashboard();
        } catch (error) {
            setUploadError(error.message);
        } finally {
            setUploading(false);
        }
    }

    async function askAnalyst(event) {
        event?.preventDefault();
        if (!question.trim() || asking) return;
        setAsking(true);
        setAskError("");
        try {
            setAnswer(await api(`/api/ask?q=${encodeURIComponent(question.trim())}`));
        } catch (error) {
            setAskError(error.message);
        } finally {
            setAsking(false);
        }
    }

    const genericMode = dataset?.analysis_mode === "generic";
    const viewDetails = {
        overview: ["EXECUTIVE CONTROL CENTER", "Business intelligence,", "without the noise."],
        data: ["DATA WORKSPACE", "Data Studio", "Inspect and replace the active dataset."],
        analyst: ["DECISION SUPPORT", "AI Analyst", "Ask a question about the active business data."],
        forecast: genericMode ? ["RECORD ACTIVITY", "Record forecasts", "Review expected record volume by month."] : ["PREDICTIVE ANALYTICS", "Revenue forecasts", "Review the four-period revenue projection."],
        alerts: genericMode ? ["DATA QUALITY", "Dataset alerts", "Review missing values and duplicate records."] : ["ANOMALY MONITORING", "Detected alerts", "Investigate unusual revenue periods in your data."]
    }[activeView];
    const forecastSeries = genericMode
        ? [...(dataset?.timeline || []).map(item => ({ period: item.month, actual: item.records })),
            ...forecast.map(item => ({ period: item.period, projected: item.records }))]
        : [...trend.map(item => ({ period: item.month, actual: item.revenue })),
            ...forecast.map(item => ({ period: item.period, projected: item.revenue }))];
    const maxRegionRevenue = Math.max(...regions.map(item => item.revenue), 1);

    return <div className="app">
        <aside className="sidebar">
            <div className="brand"><div className="logo"><Sparkles /></div><div><b>InsightOps</b><span>AI BUSINESS INTELLIGENCE</span></div></div>
            <nav aria-label="Main navigation">{pages.map(({ id, label, icon: Icon }) =>
                <button key={id} type="button" className={activeView === id ? "active" : ""} onClick={() => setActiveView(id)} aria-current={activeView === id ? "page" : undefined}>
                    <Icon size={18} /><span>{label}</span>
                </button>
            )}</nav>
            <div className="side-card"><ShieldCheck size={20} /><b>Data protected</b><p>Local demo environment. No data leaves your workspace.</p></div>
        </aside>

        <main>
            <header>
                <div><p className="eyebrow">{viewDetails[0]}</p><h1>{viewDetails[1]} <em>{viewDetails[2]}</em></h1></div>
                <button className="upload" type="button" onClick={() => fileInput.current?.click()} disabled={uploading}>
                    <Upload size={17} />{uploading ? "Uploading..." : "Upload dataset"}
                </button>
                <input ref={fileInput} className="file-input" type="file" accept=".csv,text/csv" onChange={uploadDataset} aria-label="Choose CSV dataset" />
            </header>

            {apiError && <p className="notice error" role="alert">{apiError}</p>}
            {uploadError && <p className="notice error" role="alert">Dataset not analyzed: {uploadError}</p>}

            {activeView === "overview" && <>
                {genericMode ? <>
                    <section className="stats">
                        <Stat icon={Database} label="Records" value={(dataset.rows || 0).toLocaleString()} delta="Rows in active dataset" />
                        <Stat icon={BarChart3} label="Fields" value={dataset.column_count || 0} delta="Analyzed columns" />
                        <Stat icon={AlertTriangle} label="Missing values" value={(dataset.missing_values || 0).toLocaleString()} delta="Across all fields" />
                        <Stat icon={ShieldCheck} label="Quality score" value={`${dataset.quality_score || 0}%`} delta={`${dataset.duplicates || 0} duplicate rows`} />
                    </section>
                    <section className="grid two">
                        <div className="panel glass"><span>RECORD ACTIVITY</span><h2>{dataset.date_column ? `Records by ${dataset.date_column}` : "No date trend available"}</h2>
                            {dataset.timeline?.length ? <div className="chart"><ResponsiveContainer><BarChart data={dataset.timeline}><CartesianGrid stroke="#ffffff10" vertical={false} /><XAxis dataKey="month" tick={{ fill: "#8291a8", fontSize: 10 }} /><YAxis hide allowDecimals={false} /><Tooltip contentStyle={{ background: "#0c1827", border: "1px solid #ffffff20" }} /><Bar dataKey="records" name="Records" fill="#77e5ce" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div> : <p className="muted">No date column could be identified in this file.</p>}
                            {dataset.date_range && <p className="muted">{dataset.date_range.start} to {dataset.date_range.end}</p>}
                        </div>
                        <div className="panel glass"><span>DATA CLEANING</span><h2>Quality checks</h2>
                            <p className="muted">Column names were normalized and surrounding whitespace was trimmed. Missing values and duplicates are reported, not silently removed.</p>
                            {dataset.columns.filter(column => column.missing_values > 0).slice(0, 6).map(column => <div className="row" key={column.name}><span>{column.name}</span><div className="meter"><i style={{ width: `${Math.min(100, column.missing_values / Math.max(dataset.rows, 1) * 100)}%` }} /></div><b>{column.missing_values} missing</b></div>)}
                        </div>
                    </section>
                    <section className="grid three">
                        {dataset.distributions?.slice(0, 3).map(distribution => <div className="panel glass" key={distribution.column}><span>FIELD BREAKDOWN</span><h2>{distribution.column}</h2>
                            {distribution.values.map(item => <div className="row" key={item.value}><span>{item.value}</span><div className="meter"><i style={{ width: `${Math.min(100, item.count / Math.max(dataset.rows, 1) * 100)}%` }} /></div><b>{item.count}</b></div>)}
                        </div>)}
                    </section>
                </> : <>
                <section className="stats">
                    <Stat icon={TrendingUp} label="Revenue" value={money(overview.revenue)} delta={`${Number(overview.growth || 0).toFixed(2)}% month over month`} />
                    <Stat icon={BarChart3} label="Orders" value={(overview.orders || 0).toLocaleString()} delta="Across active dataset" />
                    <Stat icon={Database} label="Customers" value={(overview.customers || 0).toLocaleString()} delta="Across active dataset" />
                    <Stat icon={Sparkles} label="Profit margin" value={`${overview.margin || 0}%`} delta="Calculated from revenue and profit" />
                </section>
                <section className="grid two">
                    <div className="panel glass"><div className="panel-head"><div><span>PERFORMANCE</span><h2>Revenue trajectory</h2></div><div className="badge"><ArrowUpRight size={14} /> Historical</div></div>
                        <div className="chart"><ResponsiveContainer><LineChart data={trend}><CartesianGrid stroke="#ffffff10" vertical={false} /><XAxis dataKey="month" tick={{ fill: "#8291a8", fontSize: 10 }} /><YAxis hide /><Tooltip formatter={value => money(value)} contentStyle={{ background: "#0c1827", border: "1px solid #ffffff20" }} /><Line type="monotone" dataKey="revenue" stroke="#77e5ce" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer></div>
                    </div>
                    <div className="panel glass"><div className="panel-head"><div><span>PRODUCT MIX</span><h2>Category performance</h2></div></div>
                        <div className="chart"><ResponsiveContainer><BarChart data={categories}><XAxis dataKey="category" tick={{ fill: "#8291a8", fontSize: 10 }} /><YAxis hide /><Tooltip formatter={value => money(value)} contentStyle={{ background: "#0c1827", border: "1px solid #ffffff20" }} /><Bar dataKey="revenue" fill="#77e5ce" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div>
                    </div>
                </section>
                <section className="grid three">
                    <div className="panel glass"><span>REGIONAL PULSE</span><h2>Revenue by region</h2>{regions.map(region => <div className="row" key={region.region}><span>{region.region}</span><div className="meter"><i style={{ width: `${Math.min(100, region.revenue / maxRegionRevenue * 100)}%` }} /></div><b>{money(region.revenue)}</b></div>)}</div>
                    <div className="panel glass alert"><span>DETECTED SIGNALS</span><h2>Attention required</h2>{anomalies.slice(0, 2).map(item => <div className="signal" key={item.month}><AlertTriangle size={18} /><div><b>{item.month} revenue anomaly</b><p>{money(item.revenue)} recorded · {item.severity} deviation</p></div></div>)}<button className="text-button" type="button" onClick={() => setActiveView("alerts")}>View all alerts</button></div>
                    <div className="panel glass"><span>AI ANALYST</span><h2>Ask your data</h2><p className="muted">Ask a question about revenue, categories or regions.</p><button className="text-button" type="button" onClick={() => setActiveView("analyst")}>Open AI Analyst</button></div>
                </section>
                </>}
            </>}

            {activeView === "data" && <section className="panel glass page-panel">
                <div className="panel-head"><div><span>ACTIVE DATASET</span><h2>{dataset?.filename || "Loading dataset..."}</h2></div><button className="upload" type="button" onClick={() => fileInput.current?.click()} disabled={uploading}><Upload size={16} />Replace CSV</button></div>
                <p className="sub">{genericMode ? "Generic dataset analysis is active. Column names and text whitespace were cleaned; missing values and duplicate rows are reported below." : "The CSV needs date, category, region, revenue, orders, customers and profit fields for sales analysis. Common header variations are recognized automatically."}</p>
                {uploadMessage && <p className="notice success" role="status">{uploadMessage}</p>}
                {dataset && <>
                    <div className="dataset-summary"><div><span>Rows</span><strong>{dataset.rows.toLocaleString()}</strong></div><div><span>Columns</span><strong>{dataset.column_count}</strong></div><div><span>Missing values</span><strong>{dataset.missing_values}</strong></div><div><span>Duplicate rows</span><strong>{dataset.duplicates}</strong></div><div><span>Quality score</span><strong>{dataset.quality_score}%</strong></div></div>
                    <h2 className="table-title">Column profile</h2>
                    <div className="table-scroll"><table><thead><tr><th>Column</th><th>Data type</th>{genericMode && <><th>Missing</th><th>Unique</th></>}</tr></thead><tbody>{dataset.columns.map(column => <tr key={column.name}><td>{column.name}</td><td>{column.dtype}</td>{genericMode && <><td>{column.missing_values}</td><td>{column.unique_values}</td></>}</tr>)}</tbody></table></div>
                    {genericMode && <div className="distribution-list">{dataset.distributions?.map(distribution => <div key={distribution.column}><h3>{distribution.column}</h3><p>{distribution.values.map(item => `${item.value}: ${item.count}`).join(" · ")}</p></div>)}</div>}
                </>}
            </section>}

            {activeView === "analyst" && <section className="panel glass page-panel analyst-panel">
                <span>INSIGHTOPS AI</span><h2>Ask your data</h2>
                <div className="chat analyst-chat" aria-live="polite">{answer ? <><b>InsightOps AI</b><p>{answer.answer}</p>{answer.evidence.map(item => <small key={item}>{item}</small>)}</> : <p className="muted">{genericMode ? "Ask “How many records by status?” or ask about source, region or date range." : "Try asking “Why did revenue change?” or “What should I investigate?”"}</p>}</div>
                {askError && <p className="notice error" role="alert">{askError}</p>}
                <form className="ask" onSubmit={askAnalyst}><input value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ask a business question..." aria-label="Ask a business question" /><button type="submit" disabled={asking || !question.trim()} aria-label="Send question"><Send size={16} /></button></form>
            </section>}

            {activeView === "forecast" && <section className="panel glass page-panel">
                <div className="panel-head"><div><span>LINEAR REGRESSION</span><h2>{genericMode ? "Record volume forecast" : "Revenue forecast"}</h2></div><div className="badge"><TrendingUp size={14} /> Next 4 periods</div></div>
                {forecastSeries.length > 0 ? <div className="chart forecast-chart"><ResponsiveContainer><LineChart data={forecastSeries}><CartesianGrid stroke="#ffffff10" vertical={false} /><XAxis dataKey="period" tick={{ fill: "#8291a8", fontSize: 10 }} /><YAxis hide /><Tooltip formatter={value => genericMode ? `${value} records` : money(value)} contentStyle={{ background: "#0c1827", border: "1px solid #ffffff20" }} /><Line type="monotone" dataKey="actual" name={genericMode ? "Historical records" : "Historical revenue"} stroke="#77e5ce" strokeWidth={3} dot={false} /><Line type="monotone" dataKey="projected" name={genericMode ? "Forecast records" : "Forecast revenue"} stroke="#ffbf69" strokeWidth={3} strokeDasharray="6 5" /></LineChart></ResponsiveContainer></div> : <p className="muted">At least two dated periods are needed to create a forecast.</p>}
                <div className="forecast-list">{forecast.map(item => <div className="forecast-row" key={item.period}><span>{item.period}</span><strong>{genericMode ? `${item.records} records` : money(item.revenue)}</strong></div>)}</div>
            </section>}

            {activeView === "alerts" && <section className="panel glass page-panel alert-list">
                <span>{genericMode ? "DATA QUALITY" : "ISOLATION FOREST"}</span><h2>{genericMode ? "Dataset quality alerts" : "Revenue anomalies"}</h2><p className="sub">{genericMode ? "Review missing values and duplicate records found during analysis." : "Periods flagged for unusual revenue, order or profit patterns."}</p>
                {genericMode ? (dataset.quality_alerts?.length ? dataset.quality_alerts.map(item => <div className="signal" key={item.title}><AlertTriangle size={18} /><div><b>{item.title}</b><p>{item.detail}</p></div><span className={`severity ${item.severity}`}>{item.severity}</span></div>) : <p className="muted">No missing values or duplicate rows were found.</p>) : (anomalies.length ? anomalies.map(item => <div className="signal" key={item.month}><AlertTriangle size={18} /><div><b>{item.month}</b><p>{money(item.revenue)} revenue · {item.severity} deviation</p></div><span className={`severity ${item.severity}`}>{item.severity}</span></div>) : <p className="muted">No anomalies detected for the active dataset.</p>)}
            </section>}

            <footer>InsightOps AI · Analytics decision platform · Active dataset: {dataset?.filename || "loading"}</footer>
        </main>
    </div>;
}

export default App;
