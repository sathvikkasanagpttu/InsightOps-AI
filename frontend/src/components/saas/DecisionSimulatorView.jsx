import React, { useEffect, useState } from "react";
import {
  Sliders, Zap, RefreshCw, Save, TrendingUp, TrendingDown,
  DollarSign, Percent, AlertCircle, HelpCircle, ArrowRight,
  Bookmark, Trash2, CheckCircle2, ChevronRight, BarChart3
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, Cell
} from "recharts";
import { api } from "../../lib/api";

export default function DecisionSimulatorView({ datasetId, addToast }) {
  // Lever States
  const [priceChange, setPriceChange] = useState(0);
  const [marketingSpend, setMarketingSpend] = useState(0);
  const [churnReduction, setChurnReduction] = useState(0);
  const [conversionRate, setConversionRate] = useState(0);
  const [elasticityModel, setElasticityModel] = useState("moderate");

  // Simulation Results
  const [simulation, setSimulation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [savedScenarios, setSavedScenarios] = useState([]);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [scenarioName, setScenarioName] = useState("");
  const [scenarioDesc, setScenarioDesc] = useState("");

  async function loadInitial() {
    setLoading(true);
    try {
      const [simRes, scnRes] = await Promise.all([
        api(`/api/datasets/${encodeURIComponent(datasetId || "demo-sales")}/decision-simulator/simulate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            price_change_pct: 0,
            marketing_spend_pct: 0,
            churn_reduction_pct: 0,
            conversion_rate_pct: 0,
            elasticity_model: "moderate"
          })
        }),
        api(`/api/decision-simulator/scenarios?workspace_id=default-workspace`)
      ]);
      setSimulation(simRes);
      setSavedScenarios(scnRes || []);
    } catch (err) {
      addToast(err.message || "Failed to load decision simulator.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInitial();
  }, [datasetId]);

  async function triggerSimulation(p = priceChange, m = marketingSpend, c = churnReduction, conv = conversionRate, elast = elasticityModel) {
    setSimulating(true);
    try {
      const res = await api(`/api/datasets/${encodeURIComponent(datasetId || "demo-sales")}/decision-simulator/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          price_change_pct: p,
          marketing_spend_pct: m,
          churn_reduction_pct: c,
          conversion_rate_pct: conv,
          elasticity_model: elast
        })
      });
      setSimulation(res);
    } catch (err) {
      addToast(err.message || "Simulation error.", "error");
    } finally {
      setSimulating(false);
    }
  }

  function handleLeverChange(type, value) {
    if (type === "price") {
      setPriceChange(value);
      triggerSimulation(value, marketingSpend, churnReduction, conversionRate, elasticityModel);
    } else if (type === "mktg") {
      setMarketingSpend(value);
      triggerSimulation(priceChange, value, churnReduction, conversionRate, elasticityModel);
    } else if (type === "churn") {
      setChurnReduction(value);
      triggerSimulation(priceChange, marketingSpend, value, conversionRate, elasticityModel);
    } else if (type === "conv") {
      setConversionRate(value);
      triggerSimulation(priceChange, marketingSpend, churnReduction, value, elasticityModel);
    } else if (type === "elast") {
      setElasticityModel(value);
      triggerSimulation(priceChange, marketingSpend, churnReduction, conversionRate, value);
    }
  }

  function resetLevers() {
    setPriceChange(0);
    setMarketingSpend(0);
    setChurnReduction(0);
    setConversionRate(0);
    setElasticityModel("moderate");
    triggerSimulation(0, 0, 0, 0, "moderate");
    addToast("Simulation levers reset to baseline.");
  }

  async function saveCurrentScenario(e) {
    e.preventDefault();
    if (!scenarioName.trim() || !simulation) return;
    try {
      const res = await api("/api/decision-simulator/scenarios?workspace_id=default-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: scenarioName.trim(),
          description: scenarioDesc.trim(),
          dataset_id: datasetId,
          price_change_pct: priceChange,
          marketing_spend_pct: marketingSpend,
          churn_reduction_pct: churnReduction,
          conversion_rate_pct: conversionRate,
          elasticity_model: elasticityModel,
          baseline_metrics: simulation.baseline,
          projected_metrics: simulation.projected,
          variance_summary: simulation.variance
        })
      });
      setSavedScenarios(prev => [res, ...prev]);
      setSaveModalOpen(false);
      setScenarioName("");
      setScenarioDesc("");
      addToast(`Scenario "${res.name}" saved successfully.`);
    } catch (err) {
      addToast(err.message || "Failed to save scenario.", "error");
    }
  }

  function loadSavedScenario(scn) {
    setPriceChange(scn.price_change_pct);
    setMarketingSpend(scn.marketing_spend_pct);
    setChurnReduction(scn.churn_reduction_pct);
    setConversionRate(scn.conversion_rate_pct);
    setElasticityModel(scn.elasticity_model || "moderate");
    triggerSimulation(
      scn.price_change_pct,
      scn.marketing_spend_pct,
      scn.churn_reduction_pct,
      scn.conversion_rate_pct,
      scn.elasticity_model || "moderate"
    );
    addToast(`Loaded scenario: "${scn.name}"`);
  }

  async function deleteScenario(id, e) {
    e.stopPropagation();
    try {
      await api(`/api/decision-simulator/scenarios/${id}`, { method: "DELETE" });
      setSavedScenarios(prev => prev.filter(s => s.id !== id));
      addToast("Scenario deleted.");
    } catch (err) {
      addToast("Failed to delete scenario.", "error");
    }
  }

  if (loading) {
    return (
      <section className="panel glass page-panel">
        <div style={{ padding: "40px", textAlign: "center", color: "#8291a8" }}>
          <RefreshCw className="spin" size={28} style={{ margin: "0 auto 12px auto", color: "#e6c348" }} />
          <p>Initializing Econometric Demand Elasticity Engine...</p>
        </div>
      </section>
    );
  }

  const proj = simulation?.projected || {};
  const base = simulation?.baseline || {};
  const vari = simulation?.variance || {};
  const rec = simulation?.recommendation || {};

  return (
    <section className="panel glass page-panel decision-simulator-view">
      {/* Header */}
      <div className="panel-head" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#10b981" }}>
              WHAT-IF DECISION ENGINE
            </span>
            <span className="badge-pill" style={{ background: "rgba(230, 195, 72, 0.15)", color: "#e6c348", border: "1px solid rgba(230, 195, 72, 0.3)" }}>
              Econometric Elasticity Active
            </span>
          </div>
          <h2>Strategic Scenario Simulator</h2>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Model pricing elasticity, paid acquisition diminishing returns, and retention levers in real-time.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="btn-secondary" onClick={resetLevers}>
            <RefreshCw size={14} /> Reset Levers
          </button>
          <button type="button" className="btn-primary" onClick={() => setSaveModalOpen(true)}>
            <Save size={14} /> Save Scenario
          </button>
        </div>
      </div>

      {/* Main Grid: Controls Left, Projections Right */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 24, marginTop: 20 }}>
        {/* LEVERS CONTROLS PANEL */}
        <div className="panel glass" style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: 15, color: "#f8fafc", display: "flex", alignItems: "center", gap: 8 }}>
            <Sliders size={16} style={{ color: "#e6c348" }} /> Strategic Levers
          </h3>

          {/* Lever 1: Price Adjustment */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#cbd5e1" }}>Price Change</label>
              <span style={{ fontSize: 12, fontFamily: "var(--io-font-mono)", fontWeight: 700, color: priceChange > 0 ? "#34d399" : (priceChange < 0 ? "#f87171" : "#cbd5e1") }}>
                {priceChange > 0 ? `+${priceChange}%` : `${priceChange}%`} (${proj.avg_price?.toFixed(2)}/unit)
              </span>
            </div>
            <input
              type="range"
              min="-30"
              max="50"
              step="1"
              value={priceChange}
              onChange={e => handleLeverChange("price", Number(e.target.value))}
              style={{ width: "100%", accentColor: "#e6c348" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#64748b" }}>
              <span>-30% Discount</span>
              <span>Baseline</span>
              <span>+50% Premium</span>
            </div>
          </div>

          {/* Lever 2: Marketing & Ad Spend */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#cbd5e1" }}>Marketing & Ad Spend</label>
              <span style={{ fontSize: 12, fontFamily: "var(--io-font-mono)", fontWeight: 700, color: marketingSpend > 0 ? "#60a5fa" : (marketingSpend < 0 ? "#f87171" : "#cbd5e1") }}>
                {marketingSpend > 0 ? `+${marketingSpend}%` : `${marketingSpend}%`} (${Math.round(proj.marketing_spend || 0).toLocaleString()})
              </span>
            </div>
            <input
              type="range"
              min="-50"
              max="100"
              step="5"
              value={marketingSpend}
              onChange={e => handleLeverChange("mktg", Number(e.target.value))}
              style={{ width: "100%", accentColor: "#3b82f6" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#64748b" }}>
              <span>-50% Cut</span>
              <span>Baseline</span>
              <span>+100% Growth Surge</span>
            </div>
          </div>

          {/* Lever 3: Churn Reduction */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#cbd5e1" }}>Churn Rate Reduction</label>
              <span style={{ fontSize: 12, fontFamily: "var(--io-font-mono)", fontWeight: 700, color: churnReduction > 0 ? "#10b981" : "#cbd5e1" }}>
                -{churnReduction}% (New Churn: {proj.churn_rate_pct}%)
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              step="1"
              value={churnReduction}
              onChange={e => handleLeverChange("churn", Number(e.target.value))}
              style={{ width: "100%", accentColor: "#10b981" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#64748b" }}>
              <span>0% Baseline</span>
              <span>25% Target</span>
              <span>50% Elite Retention</span>
            </div>
          </div>

          {/* Lever 4: Conversion Rate Uplift */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#cbd5e1" }}>Conversion Rate Uplift</label>
              <span style={{ fontSize: 12, fontFamily: "var(--io-font-mono)", fontWeight: 700, color: conversionRate > 0 ? "#8b5cf6" : "#cbd5e1" }}>
                {conversionRate > 0 ? `+${conversionRate}%` : `${conversionRate}%`}
              </span>
            </div>
            <input
              type="range"
              min="-20"
              max="40"
              step="2"
              value={conversionRate}
              onChange={e => handleLeverChange("conv", Number(e.target.value))}
              style={{ width: "100%", accentColor: "#8b5cf6" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#64748b" }}>
              <span>-20% Friction</span>
              <span>Baseline</span>
              <span>+40% CRO Optimized</span>
            </div>
          </div>

          {/* Lever 5: Demand Elasticity Profile */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: "#cbd5e1", display: "block", marginBottom: 8 }}>
              Demand Elasticity Model
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[
                { id: "inelastic", label: "Inelastic (-0.4)", hint: "Sticky / Enterprise" },
                { id: "moderate", label: "Moderate (-0.95)", hint: "Standard B2B SaaS" },
                { id: "elastic", label: "Elastic (-1.65)", hint: "Competitive Consumer" }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleLeverChange("elast", opt.id)}
                  style={{
                    padding: "8px 6px",
                    borderRadius: 6,
                    border: `1px solid ${elasticityModel === opt.id ? "#e6c348" : "rgba(255,255,255,0.08)"}`,
                    background: elasticityModel === opt.id ? "rgba(230, 195, 72, 0.15)" : "rgba(255,255,255,0.02)",
                    color: elasticityModel === opt.id ? "#f0cf55" : "#8291a8",
                    fontSize: 11,
                    textAlign: "center",
                    cursor: "pointer"
                  }}
                >
                  <strong style={{ display: "block", fontSize: 11.5 }}>{opt.label}</strong>
                  <span style={{ fontSize: 9.5, opacity: 0.8 }}>{opt.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* PROJECTION RESULTS & WATERFALL */}
        <div>
          {/* Top Outcome Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            {/* Projected Revenue */}
            <div className="panel glass" style={{ padding: 18, borderLeft: "4px solid #3b82f6" }}>
              <span style={{ fontSize: 12, color: "#8291a8", fontWeight: 600 }}>PROJECTED REVENUE</span>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#f8fafc", margin: "6px 0" }}>
                ${Number(proj.revenue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <span style={{
                  color: vari.revenue_delta >= 0 ? "#34d399" : "#f87171",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center"
                }}>
                  {vari.revenue_delta >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {vari.revenue_delta >= 0 ? `+$${vari.revenue_delta?.toLocaleString()}` : `-$${Math.abs(vari.revenue_delta)?.toLocaleString()}`} ({vari.revenue_delta_pct}%)
                </span>
                <span style={{ color: "#64748b" }}>vs ${Number(base.baseline_revenue || 0).toLocaleString()} base</span>
              </div>
            </div>

            {/* Projected Net Profit / EBITDA */}
            <div className="panel glass" style={{ padding: 18, borderLeft: "4px solid #10b981" }}>
              <span style={{ fontSize: 12, color: "#8291a8", fontWeight: 600 }}>PROJECTED NET OPERATING PROFIT</span>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#f8fafc", margin: "6px 0" }}>
                ${Number(proj.net_profit || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <span style={{
                  color: vari.profit_delta >= 0 ? "#34d399" : "#f87171",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center"
                }}>
                  {vari.profit_delta >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {vari.profit_delta >= 0 ? `+$${vari.profit_delta?.toLocaleString()}` : `-$${Math.abs(vari.profit_delta)?.toLocaleString()}`} ({vari.profit_delta_pct}%)
                </span>
                <span style={{ color: "#64748b" }}>vs ${Number(base.baseline_net_profit || 0).toLocaleString()} base</span>
              </div>
            </div>
          </div>

          {/* Strategic Recommendation Callout */}
          <div
            style={{
              padding: "12px 16px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 12
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: rec.tone === "emerald" ? "#10b981" : (rec.tone === "amber" ? "#f59e0b" : "#3b82f6") }} />
            <div>
              <strong style={{ fontSize: 13, color: "#f8fafc" }}>{rec.verdict || "Simulation Active"}: </strong>
              <span style={{ fontSize: 12, color: "#cbd5e1" }}>{rec.summary}</span>
            </div>
          </div>

          {/* Waterfall Variance Chart */}
          <div className="panel glass" style={{ padding: 18, marginBottom: 20 }}>
            <h3 style={{ margin: "0 0 14px 0", fontSize: 14, color: "#f8fafc" }}>Revenue Variance Attribution Waterfall</h3>
            <div style={{ height: 210 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={simulation?.waterfall || []} margin={{ left: -10, right: 10, top: 10, bottom: 25 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#8291a8", fontSize: 9.5 }} angle={-15} textAnchor="end" />
                  <YAxis tick={{ fill: "#8291a8", fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(val) => [`$${Number(val).toLocaleString()}`, "Value"]}
                    contentStyle={{ background: "#0c1827", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8 }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {(simulation?.waterfall || []).map((entry, idx) => {
                      let col = "#3b82f6";
                      if (entry.type === "positive") col = "#10b981";
                      if (entry.type === "negative") col = "#ef4444";
                      if (entry.type === "total") col = "#e6c348";
                      return <Cell key={`bar-${idx}`} fill={col} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* SAVED SCENARIOS LIBRARY */}
      <div className="panel glass" style={{ marginTop: 24, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: "#f8fafc", display: "flex", alignItems: "center", gap: 8 }}>
            <Bookmark size={16} style={{ color: "#e6c348" }} /> Saved Executive Scenarios ({savedScenarios.length})
          </h3>
          <span style={{ fontSize: 12, color: "#8291a8" }}>Click any scenario archetype to load parameters</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          {savedScenarios.map(scn => (
            <div
              key={scn.id}
              onClick={() => loadSavedScenario(scn)}
              style={{
                padding: "14px 16px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
              className="scenario-card-hover"
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <b style={{ fontSize: 13, color: "#f8fafc" }}>{scn.name}</b>
                {!scn.id.startsWith("arch-") && (
                  <button
                    type="button"
                    className="icon-action"
                    onClick={(e) => deleteScenario(scn.id, e)}
                    style={{ color: "#64748b", padding: 2 }}
                    title="Delete scenario"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <p style={{ margin: "0 0 10px 0", fontSize: 11.5, color: "#8291a8" }}>{scn.description}</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: 10.5, fontFamily: "var(--io-font-mono)" }}>
                <span style={{ padding: "2px 6px", borderRadius: 4, background: "rgba(255,255,255,0.05)", color: "#cbd5e1" }}>
                  Price: {scn.price_change_pct > 0 ? `+${scn.price_change_pct}` : scn.price_change_pct}%
                </span>
                <span style={{ padding: "2px 6px", borderRadius: 4, background: "rgba(255,255,255,0.05)", color: "#cbd5e1" }}>
                  Ad Spend: {scn.marketing_spend_pct > 0 ? `+${scn.marketing_spend_pct}` : scn.marketing_spend_pct}%
                </span>
                <span style={{ padding: "2px 6px", borderRadius: 4, background: "rgba(255,255,255,0.05)", color: "#cbd5e1" }}>
                  Churn: -{scn.churn_reduction_pct}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SAVE SCENARIO MODAL */}
      {saveModalOpen && (
        <div className="upload-modal-backdrop" role="presentation" onClick={e => { if (e.target === e.currentTarget) setSaveModalOpen(false); }}>
          <section className="upload-modal panel glass" role="dialog" aria-modal="true" style={{ maxWidth: 440 }}>
            <div className="panel-head">
              <div>
                <span>SCENARIO MANAGEMENT</span>
                <h2>Save Current Scenario</h2>
              </div>
            </div>
            <form onSubmit={saveCurrentScenario} style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: "#cbd5e1", display: "block", marginBottom: 6 }}>Scenario Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q3 Aggressive Growth Surge"
                  value={scenarioName}
                  onChange={e => setScenarioName(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)", background: "#0c1827", color: "#f8fafc" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#cbd5e1", display: "block", marginBottom: 6 }}>Description / Hypothesis</label>
                <textarea
                  rows={3}
                  placeholder="Rationale and strategic assumptions for executive briefing..."
                  value={scenarioDesc}
                  onChange={e => setScenarioDesc(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)", background: "#0c1827", color: "#f8fafc" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button type="button" className="btn-secondary" onClick={() => setSaveModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save to Library</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
