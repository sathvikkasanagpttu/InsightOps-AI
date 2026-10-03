import React, { useEffect, useState } from "react";
import {
  Shield, Layers, X, RefreshCw, CheckCircle2, AlertTriangle,
  ArrowRight, Lock, EyeOff, ShieldCheck, Database, FileText, Cpu
} from "lucide-react";
import { api } from "../../lib/api";

export default function DataLineageGovernanceModal({ isOpen, onClose, datasetId, addToast }) {
  const [activeTab, setActiveTab] = useState("lineage"); // lineage, pii
  const [lineage, setLineage] = useState(null);
  const [piiData, setPiiData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadGovernanceData() {
    setLoading(true);
    try {
      const [linRes, piiRes] = await Promise.all([
        api(`/api/datasets/${encodeURIComponent(datasetId || "demo-sales")}/lineage`),
        api(`/api/datasets/${encodeURIComponent(datasetId || "demo-sales")}/sensitive-data`)
      ]);
      setLineage(linRes);
      setPiiData(piiRes);
    } catch (err) {
      if (addToast) addToast("Failed to load governance telemetry.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadGovernanceData();
    }
  }, [isOpen, datasetId]);

  if (!isOpen) return null;

  return (
    <div className="upload-modal-backdrop" role="presentation" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="upload-modal panel glass" role="dialog" aria-modal="true" style={{ maxWidth: 840, width: "95%" }}>
        {/* Header */}
        <div className="panel-head" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Shield size={16} style={{ color: "#34d399" }} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#34d399" }}>
                ENTERPRISE DATA GOVERNANCE
              </span>
            </div>
            <h2 style={{ margin: "4px 0 0 0", fontSize: 18 }}>Data Lineage & Privacy Compliance Center</h2>
          </div>
          <button className="icon-action" type="button" onClick={onClose} aria-label="Close modal">
            <X size={17} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="eda-subtabs" style={{ marginTop: 14, marginBottom: 16 }}>
          <button
            type="button"
            className={`eda-subtab-btn ${activeTab === "lineage" ? "active" : ""}`}
            onClick={() => setActiveTab("lineage")}
          >
            <Layers size={14} /> End-to-End Lineage DAG ({lineage?.total_nodes || 7} Nodes)
          </button>
          <button
            type="button"
            className={`eda-subtab-btn ${activeTab === "pii" ? "active" : ""}`}
            onClick={() => setActiveTab("pii")}
          >
            <Lock size={14} /> Sensitive PII / PCI Scanner (Score: {piiData?.compliance_score || 100}%)
          </button>
        </div>

        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#8291a8" }}>
            <RefreshCw className="spin" size={24} style={{ margin: "0 auto 10px auto", color: "#34d399" }} />
            <p>Scanning data pipeline provenance and verifying compliance policies...</p>
          </div>
        ) : (
          <div>
            {/* TAB 1: LINEAGE DAG */}
            {activeTab === "lineage" && lineage && (
              <div className="lineage-dag-view">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <span style={{ fontSize: 12, color: "#8291a8" }}>
                    Visual DAG tracking upstream ingestion through cleaning, semantic metrics, and downstream AI consumers.
                  </span>
                  <span className="badge-pill" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                    Lineage Verified
                  </span>
                </div>

                {/* Lineage Flow Nodes */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {lineage.nodes.map((node, nIdx) => (
                    <div
                      key={node.id}
                      style={{
                        padding: "12px 16px",
                        borderRadius: 8,
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderLeft: `4px solid ${node.color}`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: node.color }}>
                            {node.type}
                          </span>
                          <strong style={{ fontSize: 13, color: "#f8fafc" }}>{node.title}</strong>
                        </div>
                        <p style={{ margin: 0, fontSize: 11.5, color: "#94a3b8" }}>{node.description}</p>
                      </div>
                      <div style={{ textAlign: "right", minWidth: 140 }}>
                        <span style={{ fontSize: 11, fontFamily: "var(--io-font-mono)", color: "#e6c348", display: "block" }}>
                          {node.metrics}
                        </span>
                        <span style={{ fontSize: 10, color: "#64748b" }}>
                          Status: <strong style={{ color: "#34d399" }}>{node.status}</strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 2: SENSITIVE PII / PCI SCANNER */}
            {activeTab === "pii" && piiData && (
              <div className="pii-scanner-view">
                {/* Score bar */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
                  <div className="panel glass" style={{ padding: 14, borderLeft: "4px solid #10b981" }}>
                    <span style={{ fontSize: 11, color: "#8291a8" }}>COMPLIANCE READINESS SCORE</span>
                    <div style={{ fontSize: 24, fontWeight: 700, color: piiData.compliance_score >= 80 ? "#10b981" : "#f59e0b", margin: "4px 0" }}>
                      {piiData.compliance_score} / 100
                    </div>
                    <span style={{ fontSize: 11, color: "#cbd5e1" }}>
                      Status: <strong>{piiData.compliance_status}</strong> · GDPR / CCPA: <strong>{piiData.gdpr_ccpa_readiness}</strong>
                    </span>
                  </div>

                  <div className="panel glass" style={{ padding: 14, borderLeft: "4px solid #3b82f6" }}>
                    <span style={{ fontSize: 11, color: "#8291a8" }}>COLUMNS AUDITED</span>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#f8fafc", margin: "4px 0" }}>
                      {piiData.total_columns_scanned} Columns
                    </div>
                    <span style={{ fontSize: 11, color: "#cbd5e1" }}>
                      Flagged Sensitive: <strong style={{ color: piiData.sensitive_columns_count > 0 ? "#f59e0b" : "#10b981" }}>{piiData.sensitive_columns_count}</strong>
                    </span>
                  </div>
                </div>

                {/* Findings Table */}
                {piiData.findings?.length > 0 ? (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", color: "#8291a8", textAlign: "left" }}>
                          <th style={{ padding: "8px 10px" }}>Column Name</th>
                          <th style={{ padding: "8px 10px" }}>Classification</th>
                          <th style={{ padding: "8px 10px" }}>Risk Severity</th>
                          <th style={{ padding: "8px 10px" }}>Sample Masking</th>
                          <th style={{ padding: "8px 10px" }}>Recommended Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {piiData.findings.map(f => (
                          <tr key={f.column_name} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                            <td style={{ padding: "8px 10px", fontWeight: 600, color: "#f8fafc" }}>{f.column_name}</td>
                            <td style={{ padding: "8px 10px", color: "#60a5fa" }}>{f.detected_type}</td>
                            <td style={{ padding: "8px 10px" }}>
                              <span style={{
                                padding: "2px 8px",
                                borderRadius: 4,
                                fontSize: 10.5,
                                background: f.severity === "Critical" ? "rgba(239, 68, 68, 0.2)" : "rgba(245, 158, 11, 0.2)",
                                color: f.severity === "Critical" ? "#f87171" : "#fbbf24"
                              }}>
                                {f.severity}
                              </span>
                            </td>
                            <td style={{ padding: "8px 10px", fontFamily: "var(--io-font-mono)", color: "#8291a8" }}>
                              {f.sample_masked?.join(", ")}
                            </td>
                            <td style={{ padding: "8px 10px", color: "#34d399", fontSize: 11 }}>
                              {f.recommended_action}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: "24px", textAlign: "center", color: "#34d399", background: "rgba(16, 185, 129, 0.04)", borderRadius: 8 }}>
                    <ShieldCheck size={32} style={{ margin: "0 auto 8px auto" }} />
                    <b style={{ display: "block", fontSize: 14 }}>Zero High-Risk PII or PCI Violations Detected</b>
                    <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#8291a8" }}>
                      All evaluated columns comply with enterprise data masking and pseudonymization guidelines.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
