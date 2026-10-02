import React, { useState } from "react";
import {
  BrainCircuit, Send, X, Check, Sparkles, Database, CornerDownLeft,
  Maximize2, RefreshCw, AlertTriangle, Layers, Info
} from "lucide-react";
import AIOrb from "./AIOrb";

/**
 * AIAnalystDrawer - Enterprise Slide-out AI Intelligence Drawer
 * Features animated AIOrb, quick query pills, formula traceability, and deterministic evidence
 */
export default function AIAnalystDrawer({
  isOpen,
  onClose,
  onExpandFull,
  question,
  setQuestion,
  answer,
  asking,
  askError,
  askAnalyst,
  analystQuestions = [],
  activeDatasetName = "",
}) {
  if (!isOpen) return null;

  return (
    <div className="ai-drawer-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="ai-analyst-drawer" role="dialog" aria-modal="true" aria-label="AI Analyst Intelligence Drawer">
        {/* Drawer Header with Animated AI Orb */}
        <div className="ai-drawer-header">
          <div className="ai-drawer-header-left">
            <AIOrb state={asking ? "thinking" : "idle"} size={52} />
            <div className="ai-drawer-titles">
              <div className="ai-title-row">
                <span className="ai-title-text">Neural Analyst</span>
                <span className="ai-verified-pill">
                  <Check size={10} /> VERIFIED
                </span>
              </div>
              <span className="ai-subtitle-text">
                Dataset: <b>{activeDatasetName || "Active Session"}</b>
              </span>
            </div>
          </div>

          <div className="ai-drawer-header-actions">
            {onExpandFull && (
              <button
                type="button"
                className="ai-icon-btn"
                onClick={onExpandFull}
                title="Expand to Fullscreen View"
                aria-label="Expand to Fullscreen View"
              >
                <Maximize2 size={15} />
              </button>
            )}
            <button
              type="button"
              className="ai-icon-btn"
              onClick={onClose}
              title="Close Drawer"
              aria-label="Close Drawer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Quick Query Pills */}
        <div className="ai-drawer-chips-section">
          <span className="chips-section-kicker">Recommended Inquiries:</span>
          <div className="ai-drawer-chips-scroll">
            {analystQuestions.slice(0, 6).map((qText) => (
              <button
                key={qText}
                type="button"
                className="ai-query-chip"
                onClick={(e) => askAnalyst(e, qText)}
                disabled={asking}
              >
                <Sparkles size={11} className="chip-spark" />
                <span>{qText}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Chat / Response Scroll View */}
        <div className="ai-drawer-conversation" aria-live="polite">
          {answer ? (
            <div className="ai-response-bubble">
              <div className="ai-bubble-head">
                <BrainCircuit size={16} className="text-cyan" />
                <span className="ai-bubble-kicker">DETERMINISTIC ANALYSIS</span>
              </div>

              <div className="ai-answer-statement">
                <p>{answer.answer}</p>
              </div>

              {answer.evidence && answer.evidence.length > 0 && (
                <div className="ai-evidence-box">
                  <span className="evidence-box-kicker">Grounding Evidence:</span>
                  <ul className="evidence-list">
                    {answer.evidence.map((ev, i) => (
                      <li key={i}>
                        <Check size={13} className="text-emerald" />
                        <span>{ev}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {answer.top_contributor && (
                <div className="ai-driver-callout">
                  <Sparkles size={14} className="text-gold" />
                  <div>
                    <strong>Primary Driver</strong>
                    <span>
                      {typeof answer.top_contributor === "object"
                        ? Object.entries(answer.top_contributor).map(([k, v]) => `${k}: ${v}`).join(" · ")
                        : String(answer.top_contributor)}
                    </span>
                  </div>
                </div>
              )}

              <div className="ai-trace-footer">
                <div className="trace-item">
                  <span className="trace-label">Calculation Formula:</span>
                  <code className="trace-code">{answer.calculation || "SUM / GROUP BY"}</code>
                </div>
                {answer.source_columns && answer.source_columns.length > 0 && (
                  <div className="trace-item">
                    <span className="trace-label">Source Columns:</span>
                    <span className="trace-cols">{answer.source_columns.join(", ")}</span>
                  </div>
                )}
                {answer.query_intent && (
                  <div className="trace-item">
                    <span className="trace-label">Intent:</span>
                    <span className="trace-intent">{answer.query_intent}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="ai-drawer-empty-state">
              <BrainCircuit size={36} className="empty-ai-icon" />
              <h4>Ask Any Business Question</h4>
              <p>
                Inquire about trends, top performing categories, revenue declines, anomalies,
                or salary distributions. Calculations run dynamically on your active data.
              </p>
            </div>
          )}

          {askError && (
            <div className="ai-drawer-error-alert" role="alert">
              <AlertTriangle size={15} />
              <span>{askError}</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form className="ai-drawer-input-form" onSubmit={askAnalyst}>
          <div className="ai-input-wrapper">
            <input
              type="text"
              className="ai-chat-input"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about revenue trends, top categories, anomalies..."
              disabled={asking}
            />
            <button
              type="submit"
              className="ai-send-btn"
              disabled={asking || !question.trim()}
              title="Submit Inquiry (Enter)"
              aria-label="Submit Inquiry"
            >
              {asking ? <RefreshCw size={15} className="spin-fast" /> : <Send size={15} />}
            </button>
          </div>
          <small className="ai-input-disclaimer">
            All calculations are executed deterministically on your uploaded data.
          </small>
        </form>
      </aside>
    </div>
  );
}
