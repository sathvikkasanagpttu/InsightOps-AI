import React, { useEffect, useState } from "react";
import {
  Trophy, Users, DollarSign, TrendingUp, AlertTriangle, ShieldCheck,
  RefreshCw, ArrowUpRight, ArrowDownRight, Layers, PieChart as PieIcon,
  Calendar, Award, Sparkles, HelpCircle, Download
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, AreaChart, Area, Cell, PieChart, Pie
} from "recharts";
import { api } from "../../lib/api";

export default function AdvancedAnalyticsView({ datasetId, addToast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("rfm"); // rfm, cohorts, clv, unit_econ

  async function fetchAnalytics() {
    setLoading(true);
    setError("");
    try {
      const res = await api(`/api/datasets/${encodeURIComponent(datasetId || "demo-sales")}/advanced-analytics`);
      setData(res);
    } catch (err) {
      setError(err.message || "Failed to load advanced analytics.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAnalytics();
  }, [datasetId]);

  if (loading) {
    return (
      <section className="panel glass page-panel">
        <div style={{ padding: "40px", textAlign: "center", color: "#8291a8" }}>
          <RefreshCw className="spin" size={28} style={{ margin: "0 auto 12px auto", color: "#e6c348" }} />
          <p>Computing RFM quintiles, cohort matrices, and customer lifetime value models...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel glass page-panel">
        <div className="notice error">
          <AlertTriangle size={18} />
          <div>
            <b>Analysis Error</b>
            <p>{error}</p>
          </div>
          <button type="button" className="btn-secondary" onClick={fetchAnalytics} style={{ marginLeft: "auto" }}>
            Retry
          </button>
        </div>
      </section>
    );
  }

  const rfm = data?.rfm_segmentation;
  const cohorts = data?.cohort_retention;
  const clv = data?.clv_and_churn;
  const unitEcon = data?.unit_economics;

  return (
    <section className="panel glass page-panel advanced-analytics-view">
      {/* View Header */}
      <div className="panel-head" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#e6c348" }}>
              ENTERPRISE BUSINESS INTELLIGENCE
            </span>
            <span className="badge-pill" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
              Algorithmic Modeling Active
            </span>
          </div>
          <h2>Advanced Analytics & Growth Engine</h2>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Customer RFM segmentation, acquisition cohort retention heatmaps, predictive CLV, and unit economics.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="btn-secondary" onClick={fetchAnalytics} title="Re-compute analytics">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Sub-Tab Navigation */}
      <div className="eda-subtabs" style={{ marginTop: 18, marginBottom: 20 }}>
        <button
          type="button"
          className={`eda-subtab-btn ${activeTab === "rfm" ? "active" : ""}`}
          onClick={() => setActiveTab("rfm")}
        >
          <Users size={14} /> RFM Segmentation
        </button>
        <button
          type="button"
          className={`eda-subtab-btn ${activeTab === "cohorts" ? "active" : ""}`}
          onClick={() => setActiveTab("cohorts")}
        >
          <Calendar size={14} /> Cohort Retention Heatmap
        </button>
        <button
          type="button"
          className={`eda-subtab-btn ${activeTab === "clv" ? "active" : ""}`}
          onClick={() => setActiveTab("clv")}
        >
          <Award size={14} /> CLV & Churn Predictor
        </button>
        <button
          type="button"
          className={`eda-subtab-btn ${activeTab === "unit_econ" ? "active" : ""}`}
          onClick={() => setActiveTab("unit_econ")}
        >
          <DollarSign size={14} /> Unit Economics & Capital Efficiency
        </button>
      </div>

      {/* TAB 1: RFM SEGMENTATION */}
      {activeTab === "rfm" && rfm && (
        <div className="rfm-tab-content">
          {/* Top KPI Summary Bar */}
          <div className="overview-kpi-grid" style={{ marginBottom: 24 }}>
            <div className="stat glass">
              <div className="icon" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
                <Users size={18} />
              </div>
              <div>
                <span>Total Evaluated Customers</span>
                <strong>{rfm.summary?.total_customers?.toLocaleString() || 0}</strong>
                <small>Quintile-scored accounts</small>
              </div>
            </div>
            <div className="stat glass">
              <div className="icon" style={{ background: "rgba(230, 195, 72, 0.15)", color: "#e6c348" }}>
                <DollarSign size={18} />
              </div>
              <div>
                <span>Total Customer Revenue</span>
                <strong>${Number(rfm.summary?.total_revenue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
                <small>Average: ${Number(rfm.summary?.avg_customer_value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} / account</small>
              </div>
            </div>
            <div className="stat glass">
              <div className="icon" style={{ background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6" }}>
                <Trophy size={18} />
              </div>
              <div>
                <span>Champions Revenue Share</span>
                <strong>{rfm.summary?.champions_share_pct || 0}%</strong>
                <small>Top-tier loyal whales</small>
              </div>
            </div>
            <div className="stat glass">
              <div className="icon" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
                <AlertTriangle size={18} />
              </div>
              <div>
                <span>Revenue at Churn Risk</span>
                <strong>${Number(rfm.summary?.at_risk_revenue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
                <small>Requires proactive intervention</small>
              </div>
            </div>
          </div>

          {/* Segment Breakdown Chart & Matrix */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.8fr", gap: 20, marginBottom: 24 }}>
            {/* Chart: Revenue by Segment */}
            <div className="panel glass" style={{ padding: 18 }}>
              <h3 style={{ margin: "0 0 14px 0", fontSize: 14, color: "#f8fafc" }}>Revenue Contribution by Segment</h3>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rfm.segments} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#8291a8", fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                    <YAxis dataKey="name" type="category" width={110} tick={{ fill: "#cbd5e1", fontSize: 11 }} />
                    <Tooltip
                      formatter={(val) => [`$${Number(val).toLocaleString()}`, "Total Revenue"]}
                      contentStyle={{ background: "#0c1827", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8 }}
                    />
                    <Bar dataKey="total_revenue" radius={[0, 4, 4, 0]}>
                      {rfm.segments.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.color || "#3b82f6"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Segment Persona Cards */}
            <div className="panel glass" style={{ padding: 18, maxHeight: 310, overflowY: "auto" }}>
              <h3 style={{ margin: "0 0 12px 0", fontSize: 14, color: "#f8fafc" }}>Segment Strategies & Playbooks</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {rfm.segments.map(seg => (
                  <div
                    key={seg.name}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.03)",
                      borderLeft: `4px solid ${seg.color || "#8291a8"}`
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: "#f8fafc", fontSize: 13 }}>{seg.name}</span>
                      <span style={{ fontSize: 11, color: "#8291a8" }}>
                        {seg.customer_count} accounts ({seg.customer_share_pct}%) · <strong>${seg.total_revenue?.toLocaleString()}</strong>
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 11.5, color: "#94a3b8" }}>
                      💡 <strong>Recommended Playbook:</strong> {seg.action}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sample Customer Accounts Table */}
          <div className="panel glass" style={{ padding: 18 }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 14, color: "#f8fafc" }}>Customer Quintile Profiles (R-F-M Scores 1 to 5)</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", color: "#8291a8", textAlign: "left" }}>
                    <th style={{ padding: "8px 10px" }}>Customer / Account</th>
                    <th style={{ padding: "8px 10px" }}>Segment Persona</th>
                    <th style={{ padding: "8px 10px" }}>RFM Score</th>
                    <th style={{ padding: "8px 10px" }}>Recency (Days)</th>
                    <th style={{ padding: "8px 10px" }}>Frequency</th>
                    <th style={{ padding: "8px 10px" }}>Total Spend</th>
                    <th style={{ padding: "8px 10px" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(rfm.sample_customers || []).map(cust => (
                    <tr key={cust.customer_id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "8px 10px", fontWeight: 600, color: "#f8fafc" }}>{cust.customer_id}</td>
                      <td style={{ padding: "8px 10px" }}>
                        <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: `${cust.color}22`, color: cust.color, border: `1px solid ${cust.color}44` }}>
                          {cust.segment}
                        </span>
                      </td>
                      <td style={{ padding: "8px 10px", fontFamily: "var(--io-font-mono)", fontWeight: 700, color: "#e6c348" }}>{cust.rfm_score}</td>
                      <td style={{ padding: "8px 10px", color: "#cbd5e1" }}>{cust.recency_days} d</td>
                      <td style={{ padding: "8px 10px", color: "#cbd5e1" }}>{cust.frequency} orders</td>
                      <td style={{ padding: "8px 10px", fontWeight: 600, color: "#34d399" }}>${cust.monetary?.toLocaleString()}</td>
                      <td style={{ padding: "8px 10px", color: "#8291a8", fontSize: 11 }}>{cust.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: COHORT RETENTION HEATMAP */}
      {activeTab === "cohorts" && cohorts && (
        <div className="cohorts-tab-content">
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 24 }}>
            {/* Interactive Heatmap Matrix */}
            <div className="panel glass" style={{ padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 14, color: "#f8fafc" }}>Acquisition Cohort Retention Matrix (%)</h3>
                <span style={{ fontSize: 11, color: "#8291a8" }}>Percentage of original cohort active in subsequent months</span>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", color: "#8291a8", textAlign: "center" }}>
                      <th style={{ padding: "8px 10px", textAlign: "left" }}>Cohort</th>
                      <th style={{ padding: "8px 10px" }}>Size</th>
                      {(cohorts.period_labels || []).map(p => (
                        <th key={p} style={{ padding: "8px 10px" }}>{p}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(cohorts.cohorts || []).map(row => (
                      <tr key={row.cohort} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "8px 10px", fontWeight: 600, color: "#f8fafc" }}>{row.cohort}</td>
                        <td style={{ padding: "8px 10px", textAlign: "center", color: "#8291a8" }}>{row.cohort_size}</td>
                        {row.retention_rates.map((rate, rIdx) => {
                          if (rate == null) {
                            return <td key={rIdx} style={{ padding: "8px 10px", textAlign: "center", color: "rgba(255,255,255,0.1)" }}>—</td>;
                          }
                          // Heatmap color intensity
                          const alpha = Math.max(0.12, rate / 100);
                          const bg = rate >= 70 ? `rgba(16, 185, 129, ${alpha})` : (rate >= 40 ? `rgba(245, 158, 11, ${alpha})` : `rgba(239, 68, 68, ${alpha})`);
                          const textCol = rate >= 60 ? "#34d399" : (rate >= 35 ? "#fbbf24" : "#f87171");

                          return (
                            <td
                              key={rIdx}
                              style={{
                                padding: "8px 10px",
                                textAlign: "center",
                                background: bg,
                                color: textCol,
                                fontWeight: 600,
                                borderRadius: 3
                              }}
                            >
                              {rate}%
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Retention Decay Curve Chart */}
            <div className="panel glass" style={{ padding: 18 }}>
              <h3 style={{ margin: "0 0 14px 0", fontSize: 14, color: "#f8fafc" }}>Average Retention Decay Curve</h3>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cohorts.average_retention_curve} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="retentionGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="period_label" tick={{ fill: "#8291a8", fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: "#8291a8", fontSize: 10 }} tickFormatter={v => `${v}%`} />
                    <Tooltip
                      formatter={(v) => [`${v}%`, "Avg Retention"]}
                      contentStyle={{ background: "#0c1827", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8 }}
                    />
                    <Area type="monotone" dataKey="average_retention_pct" stroke="#10b981" strokeWidth={2.5} fill="url(#retentionGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(255,255,255,0.02)", borderRadius: 6, fontSize: 11.5, color: "#cbd5e1" }}>
                🎯 <strong>Benchmark:</strong> {cohorts.summary?.benchmark_status || "Retention tracking active"} · M+3 Retention: <strong>{cohorts.summary?.month_3_retention_avg}%</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CLV & CHURN PREDICTOR */}
      {activeTab === "clv" && clv && (
        <div className="clv-tab-content">
          <div className="overview-kpi-grid" style={{ marginBottom: 24 }}>
            <div className="stat glass">
              <div className="icon" style={{ background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6" }}>
                <DollarSign size={18} />
              </div>
              <div>
                <span>Average Historic CLV</span>
                <strong>${Number(clv.summary?.average_historic_clv || 0).toLocaleString()}</strong>
                <small>Average realized revenue</small>
              </div>
            </div>
            <div className="stat glass">
              <div className="icon" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
                <TrendingUp size={18} />
              </div>
              <div>
                <span>Predicted Annual CLV</span>
                <strong>${Number(clv.summary?.average_predicted_annual_clv || 0).toLocaleString()}</strong>
                <small>12-month forward run-rate</small>
              </div>
            </div>
            <div className="stat glass">
              <div className="icon" style={{ background: "rgba(230, 195, 72, 0.15)", color: "#e6c348" }}>
                <Award size={18} />
              </div>
              <div>
                <span>Top 10% Whale Share</span>
                <strong>{clv.summary?.whale_concentration_top_10_pct || 0}%</strong>
                <small>Revenue concentration risk</small>
              </div>
            </div>
            <div className="stat glass">
              <div className="icon" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
                <AlertTriangle size={18} />
              </div>
              <div>
                <span>High Churn Risk Accounts</span>
                <strong>{clv.risk_breakdown?.[0]?.count || 0} accounts</strong>
                <small>${Number(clv.summary?.total_at_risk_revenue || 0).toLocaleString()} at stake</small>
              </div>
            </div>
          </div>

          {/* High-Value Customer Whale Radar */}
          <div className="panel glass" style={{ padding: 18 }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 14, color: "#f8fafc" }}>High-Value Accounts & Predictive Churn Probability</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", color: "#8291a8", textAlign: "left" }}>
                    <th style={{ padding: "8px 10px" }}>Account ID</th>
                    <th style={{ padding: "8px 10px" }}>Historic Spend</th>
                    <th style={{ padding: "8px 10px" }}>Order Count</th>
                    <th style={{ padding: "8px 10px" }}>Average Order Value</th>
                    <th style={{ padding: "8px 10px" }}>Recency Gap</th>
                    <th style={{ padding: "8px 10px" }}>Churn Probability</th>
                    <th style={{ padding: "8px 10px" }}>Risk Tier</th>
                    <th style={{ padding: "8px 10px" }}>Predicted 12-Mo CLV</th>
                    <th style={{ padding: "8px 10px" }}>Intervention Playbook</th>
                  </tr>
                </thead>
                <tbody>
                  {(clv.top_customers || []).map(cust => (
                    <tr key={cust.customer_id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "8px 10px", fontWeight: 600, color: "#f8fafc" }}>{cust.customer_id}</td>
                      <td style={{ padding: "8px 10px", fontWeight: 600, color: "#34d399" }}>${cust.historic_spend?.toLocaleString()}</td>
                      <td style={{ padding: "8px 10px", color: "#cbd5e1" }}>{cust.order_count}</td>
                      <td style={{ padding: "8px 10px", color: "#cbd5e1" }}>${cust.aov?.toLocaleString()}</td>
                      <td style={{ padding: "8px 10px", color: "#8291a8" }}>{cust.recency_days} days</td>
                      <td style={{ padding: "8px 10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden", minWidth: 40 }}>
                            <div style={{ width: `${Math.round(cust.churn_probability * 100)}%`, height: "100%", background: cust.risk_color }} />
                          </div>
                          <span style={{ fontSize: 11, fontFamily: "var(--io-font-mono)", color: cust.risk_color }}>
                            {Math.round(cust.churn_probability * 100)}%
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: `${cust.risk_color}22`, color: cust.risk_color, border: `1px solid ${cust.risk_color}44` }}>
                          {cust.churn_risk_tier}
                        </span>
                      </td>
                      <td style={{ padding: "8px 10px", fontWeight: 600, color: "#60a5fa" }}>${cust.predicted_annual_clv?.toLocaleString()}</td>
                      <td style={{ padding: "8px 10px", color: "#94a3b8", fontSize: 11 }}>{cust.playbook}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: UNIT ECONOMICS & CAPITAL EFFICIENCY */}
      {activeTab === "unit_econ" && unitEcon && (
        <div className="unit-econ-tab-content">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 24 }}>
            {unitEcon.metrics.map(metric => (
              <div key={metric.id} className="panel glass" style={{ padding: 18, borderTop: `3px solid ${metric.color}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#8291a8" }}>{metric.label}</span>
                  <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: `${metric.color}22`, color: metric.color, border: `1px solid ${metric.color}44` }}>
                    {metric.status}
                  </span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#f8fafc", margin: "4px 0" }}>
                  {metric.value}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#8291a8", marginBottom: 8 }}>
                  <span>Target Benchmark:</span>
                  <strong style={{ color: "#cbd5e1" }}>{metric.target}</strong>
                </div>
                <p style={{ margin: 0, fontSize: 11.5, color: "#94a3b8" }}>
                  {metric.description}
                </p>
              </div>
            ))}
          </div>

          <div className="panel glass" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: 15, color: "#f8fafc" }}>
                  Enterprise Capital Efficiency Score: <span style={{ color: "#10b981" }}>{unitEcon.summary?.capital_efficiency_score || 85}/100</span>
                </h3>
                <p style={{ margin: 0, fontSize: 12.5, color: "#8291a8" }}>
                  Synthesized across Gross Margin ({unitEcon.summary?.gross_margin_pct}%), Payback Period ({unitEcon.summary?.payback_months} mos), and LTV:CAC Ratio ({unitEcon.summary?.ltv_cac_ratio}x).
                </p>
              </div>
              <span className="badge-pill" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "6px 14px" }}>
                Tier-1 Efficiency
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
