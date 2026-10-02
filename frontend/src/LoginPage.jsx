import React, { lazy, Suspense, useState } from "react";
import { ArrowRight, Eye, EyeOff, Lightbulb, LockKeyhole, Mail, User, ShieldCheck } from "lucide-react";
import { useAuth } from "./context/AuthContext";
import "./login.css";

const LampScene = lazy(() => import("./LampScene"));
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage({ onSuccess }) {
  const { login, signup, demoLogin } = useAuth();
  const rememberedEmail = localStorage.getItem("insightops.rememberedEmail") || "admin@insightops.ai";
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState(rememberedEmail);
  const [password, setPassword] = useState("Password123!");
  const [fullName, setFullName] = useState("");
  const [rememberEmail, setRememberEmail] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError("Enter a valid email address to continue.");
      return;
    }
    if (password.length < 8) {
      setError("Enter a password with at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "signin") {
        await login(email, password, rememberEmail);
      } else {
        await signup({
          email: email.trim(),
          password,
          full_name: fullName.trim() || "Analyst User",
          workspace_name: "Corporate Analytics"
        });
      }
      onSuccess?.();
    } catch (err) {
      setError(err.message || "Authentication failed. Check your credentials.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDemo(role) {
    setSubmitting(true);
    setError("");
    try {
      await demoLogin(role);
      onSuccess?.();
    } catch (err) {
      setError(err.message || "Demo login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <Suspense fallback={<div className="lamp-scene"><div className="scene-fallback" /></div>}>
        <LampScene />
      </Suspense>
      <div className="login-vignette" aria-hidden="true" />
      <header className="login-topbar">
        <a className="login-brand" href="#home" aria-label="InsightOps home">
          <span className="login-brand-mark"><Lightbulb size={18} /></span>
          <span>INSIGHTOPS</span>
        </a>
        <span className="preview-label">
          <i /> ENTERPRISE SAAS
        </span>
      </header>

      <div className="login-layout">
        <section className="login-intro" aria-labelledby="login-title">
          <p className="login-eyebrow">ENTERPRISE BI & DECISION INTELLIGENCE</p>
          <h1 id="login-title">
            See the shape<br />of your <em>data.</em>
          </h1>
          <p className="login-lede">
            Universal ingestion, automated profiling, dynamic Power BI visualizations, and AI analytics in one SaaS platform.
          </p>
          <div className="scene-caption"><span /> JWT Authentication · RBAC Workspaces · Live Telemetry</div>
        </section>

        <section className="login-panel" aria-label="Sign in to InsightOps">
          <div className="login-panel-heading">
            <div>
              <p className="login-kicker">{mode === "signin" ? "WELCOME BACK" : "JOIN PLATFORM"}</p>
              <h2>{mode === "signin" ? "Sign in" : "Create Account"}</h2>
              <p>{mode === "signin" ? "Open your analytics workspace." : "Initialize your enterprise workspace."}</p>
            </div>
            <span className="login-status-dot" aria-label="Online" />
          </div>

          {/* Quick Demo Access Bar */}
          <div style={{ marginBottom: "16px", padding: "10px", background: "rgba(230,195,72,0.08)", border: "1px solid rgba(230,195,72,0.25)", borderRadius: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "#e6c348", display: "block", marginBottom: "6px" }}>
              ⚡ 1-Click Demo Login
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="saas-action-btn secondary"
                style={{ flex: 1, padding: "6px 8px", fontSize: "12px", justifyContent: "center" }}
                onClick={() => handleDemo("admin")}
                disabled={submitting}
              >
                Admin (Full Access)
              </button>
              <button
                type="button"
                className="saas-action-btn secondary"
                style={{ flex: 1, padding: "6px 8px", fontSize: "12px", justifyContent: "center" }}
                onClick={() => handleDemo("analyst")}
                disabled={submitting}
              >
                Analyst
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {mode === "signup" && (
              <>
                <label className="login-label" htmlFor="login-name">Full Name</label>
                <div className="login-field" style={{ marginBottom: "12px" }}>
                  <User size={17} aria-hidden="true" />
                  <input
                    id="login-name"
                    type="text"
                    value={fullName}
                    onChange={event => setFullName(event.target.value)}
                    placeholder="Your Full Name"
                    required
                  />
                </div>
              </>
            )}

            <label className="login-label" htmlFor="login-email">Email address</label>
            <div className="login-field">
              <Mail size={17} aria-hidden="true" />
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="you@company.com"
                required
              />
            </div>

            <div className="password-label-row">
              <label className="login-label" htmlFor="login-password">Password</label>
              <span>{mode === "signin" ? "Default: Password123!" : "Min 8 chars"}</span>
            </div>
            <div className="login-field">
              <LockKeyhole size={17} aria-hidden="true" />
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
              />
              <button
                className="password-toggle"
                type="button"
                onClick={() => setShowPassword(value => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            <div className="login-options">
              <label className="remember-email">
                <input
                  type="checkbox"
                  checked={rememberEmail}
                  onChange={event => setRememberEmail(event.target.checked)}
                />
                <span>Remember this email</span>
              </label>
              <button
                type="button"
                className="text-button"
                style={{ fontSize: "12px", color: "#e6c348" }}
                onClick={() => setMode(m => m === "signin" ? "signup" : "signin")}
              >
                {mode === "signin" ? "Need an account? Sign up" : "Already have account? Sign in"}
              </button>
            </div>

            {error && <p className="login-error" role="alert">{error}</p>}

            <button className="login-submit" type="submit" disabled={submitting}>
              {submitting ? "Authenticating with server..." : (
                <>
                  {mode === "signin" ? "Continue to workspace" : "Create Account & Start"} <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          <div className="login-divider">
            <span>SECURE JWT & RBAC</span>
          </div>
          <p className="login-disclaimer">
            Authenticated via SHA256 PBKDF2 password verification & RFC 7519 JWT tokens stored securely.
          </p>
        </section>
      </div>
      <footer className="login-footer">
        <span>INSIGHTOPS AI SAAS</span>
        <span>ENTERPRISE DATA INTELLIGENCE PLATFORM</span>
      </footer>
    </main>
  );
}
