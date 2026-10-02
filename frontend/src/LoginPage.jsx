import React, { lazy, Suspense, useState } from "react";
import {
  ArrowRight, Eye, EyeOff, LockKeyhole, Mail, User, ShieldCheck,
  Sparkles, Key, CheckCircle2, ChevronRight, Activity, Database,
  TrendingUp, AlertTriangle, Layers, BarChart3, RefreshCw
} from "lucide-react";
import { useAuth } from "./context/AuthContext";
import { api } from "./lib/api";
import "./login.css";
import "./modern-enterprise.css";

const Hero3DScene = lazy(() => import("./components/ui/Hero3DScene"));
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage({ onSuccess }) {
  const { login, signup, demoLogin } = useAuth();
  const rememberedEmail = localStorage.getItem("insightops.rememberedEmail") || "admin@insightops.ai";

  // Auth Modes: "signin" | "signup" | "forgot" | "reset"
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState(rememberedEmail);
  const [password, setPassword] = useState("Password123!");
  const [fullName, setFullName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("Enterprise Analytics");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [rememberEmail, setRememberEmail] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Floating label active states
  const [focusedField, setFocusedField] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccessMsg("");

    if (mode === "signin") {
      if (!EMAIL_PATTERN.test(email.trim())) {
        setError("Please enter a valid business email address.");
        return;
      }
      if (password.length < 8) {
        setError("Password must contain at least 8 characters.");
        return;
      }
      setSubmitting(true);
      try {
        await login(email.trim(), password, rememberEmail);
        onSuccess?.();
      } catch (err) {
        setError(err.message || "Invalid credentials. Please verify your email and password.");
      } finally {
        setSubmitting(false);
      }
    } else if (mode === "signup") {
      if (!fullName.trim()) {
        setError("Please enter your full name.");
        return;
      }
      if (!EMAIL_PATTERN.test(email.trim())) {
        setError("Please enter a valid work email address.");
        return;
      }
      if (password.length < 8) {
        setError("Password must contain at least 8 characters.");
        return;
      }
      setSubmitting(true);
      try {
        await signup({
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          workspace_name: workspaceName.trim() || "Corporate Analytics"
        });
        onSuccess?.();
      } catch (err) {
        setError(err.message || "Failed to create account. Email may already be in use.");
      } finally {
        setSubmitting(false);
      }
    } else if (mode === "forgot") {
      if (!EMAIL_PATTERN.test(email.trim())) {
        setError("Please enter a valid email address.");
        return;
      }
      setSubmitting(true);
      try {
        const res = await api("/api/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify({ email: email.trim() })
        });
        if (res.reset_token) {
          setResetToken(res.reset_token);
          setSuccessMsg(`Reset token generated for testing: ${res.reset_token}`);
          setMode("reset");
        } else {
          setSuccessMsg(res.message || "Password reset instructions have been sent to your email.");
        }
      } catch (err) {
        setError(err.message || "Unable to process password reset request.");
      } finally {
        setSubmitting(false);
      }
    } else if (mode === "reset") {
      if (!resetToken.trim()) {
        setError("Please provide the reset token.");
        return;
      }
      if (newPassword.length < 8) {
        setError("New password must be at least 8 characters.");
        return;
      }
      setSubmitting(true);
      try {
        const res = await api("/api/auth/reset-password", {
          method: "POST",
          body: JSON.stringify({ token: resetToken.trim(), new_password: newPassword })
        });
        setSuccessMsg(res.message || "Password successfully reset! You can now sign in.");
        setPassword(newPassword);
        setMode("signin");
      } catch (err) {
        setError(err.message || "Failed to reset password. The token may be expired.");
      } finally {
        setSubmitting(false);
      }
    }
  }

  async function handleDemo(role) {
    setSubmitting(true);
    setError("");
    setSuccessMsg("");
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
    <main className="login-page modern-login-root">
      {/* 3D WebGL Background Scene */}
      <Suspense fallback={<div className="login-vignette" />}>
        <Hero3DScene mode="hero" />
      </Suspense>

      {/* Ambient gradient vignettes for deep contrast */}
      <div className="login-vignette" aria-hidden="true" />
      <div className="login-ambient-grid" aria-hidden="true" />

      {/* Top Navigation Bar */}
      <header className="login-topbar">
        <a className="login-brand" href="#home" aria-label="InsightOps AI">
          <span className="login-brand-prism">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5" stroke="#818cf8" strokeWidth="2" fill="rgba(99,102,241,0.2)" />
              <circle cx="12" cy="12" r="3" fill="#e6c348" />
            </svg>
          </span>
          <div className="login-brand-titles">
            <div className="brand-wordmark-row">
              <span className="brand-wordmark">INSIGHTOPS</span>
              <span className="brand-badge-ai">AI</span>
            </div>
            <span className="brand-tagline">Turn Data Into Decisions.</span>
          </div>
        </a>

        <div className="login-topbar-meta">
          <span className="preview-label">
            <span className="status-live-pulse" />
            LIVE TELEMETRY
          </span>
          <span className="platform-edition-pill">
            ENTERPRISE SAAS v2.4
          </span>
        </div>
      </header>

      {/* Main Split / Hero Container */}
      <div className="login-layout-split">
        {/* Left Side: Modern Glassmorphic Authentication Card */}
        <section className="login-auth-column">
          <div className="enterprise-auth-card">
            <div className="auth-card-glow-edge" aria-hidden="true" />

            <div className="auth-card-header">
              <div className="auth-header-copy">
                <span className="auth-eyebrow">
                  {mode === "signin" && "SECURE ACCESS PORTAL"}
                  {mode === "signup" && "NEW WORKSPACE ONBOARDING"}
                  {mode === "forgot" && "CREDENTIAL RECOVERY"}
                  {mode === "reset" && "PASSWORD INITIALIZATION"}
                </span>
                <h1 className="auth-title">
                  {mode === "signin" && "Sign In"}
                  {mode === "signup" && "Create Workspace"}
                  {mode === "forgot" && "Reset Password"}
                  {mode === "reset" && "Set New Password"}
                </h1>
                <p className="auth-subtitle">
                  {mode === "signin" && "Enter your credentials to access your live intelligence workspace."}
                  {mode === "signup" && "Deploy a new AI-driven business intelligence instance in seconds."}
                  {mode === "forgot" && "Enter your verified business email to receive reset instructions."}
                  {mode === "reset" && "Specify your verification token and secure new password."}
                </p>
              </div>
              <div className="auth-status-chip" title="Server Status: Online & Encrypted">
                <span className="dot-online" />
                <span>ONLINE</span>
              </div>
            </div>

            {/* Quick 1-Click Demo Login Banner */}
            {mode === "signin" && (
              <div className="quick-demo-access-panel">
                <div className="demo-panel-kicker">
                  <Sparkles size={13} className="text-gold" />
                  <span>Instant 1-Click Sandbox Access</span>
                </div>
                <div className="demo-btn-row">
                  <button
                    type="button"
                    className="demo-role-btn admin"
                    onClick={() => handleDemo("admin")}
                    disabled={submitting}
                  >
                    <b>Admin</b>
                    <small>Full Governance</small>
                  </button>
                  <button
                    type="button"
                    className="demo-role-btn analyst"
                    onClick={() => handleDemo("analyst")}
                    disabled={submitting}
                  >
                    <b>Analyst</b>
                    <small>BI & Exploration</small>
                  </button>
                </div>
              </div>
            )}

            {/* Notification & Error Banners */}
            {error && (
              <div className="auth-alert-box error" role="alert">
                <AlertTriangle size={15} />
                <span>{error}</span>
              </div>
            )}
            {successMsg && (
              <div className="auth-alert-box success" role="status">
                <CheckCircle2 size={15} />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Main Form with Floating Labels & Focus Glow */}
            <form onSubmit={handleSubmit} noValidate className="auth-form-animated">
              {/* Full Name & Workspace Name (Signup only) */}
              {mode === "signup" && (
                <>
                  <div className={`floating-input-group ${focusedField === "name" || fullName ? "is-active" : ""}`}>
                    <div className="input-icon-box"><User size={16} /></div>
                    <input
                      id="auth-name"
                      type="text"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      onFocus={() => setFocusedField("name")}
                      onBlur={() => setFocusedField(null)}
                      placeholder=" "
                      required
                    />
                    <label htmlFor="auth-name">Full Name</label>
                  </div>

                  <div className={`floating-input-group ${focusedField === "workspace" || workspaceName ? "is-active" : ""}`}>
                    <div className="input-icon-box"><Layers size={16} /></div>
                    <input
                      id="auth-workspace"
                      type="text"
                      value={workspaceName}
                      onChange={e => setWorkspaceName(e.target.value)}
                      onFocus={() => setFocusedField("workspace")}
                      onBlur={() => setFocusedField(null)}
                      placeholder=" "
                    />
                    <label htmlFor="auth-workspace">Workspace Name</label>
                  </div>
                </>
              )}

              {/* Reset Token (Reset only) */}
              {mode === "reset" && (
                <div className={`floating-input-group ${focusedField === "token" || resetToken ? "is-active" : ""}`}>
                  <div className="input-icon-box"><Key size={16} /></div>
                  <input
                    id="auth-token"
                    type="text"
                    value={resetToken}
                    onChange={e => setResetToken(e.target.value)}
                    onFocus={() => setFocusedField("token")}
                    onBlur={() => setFocusedField(null)}
                    placeholder=" "
                    required
                  />
                  <label htmlFor="auth-token">Reset Verification Token</label>
                </div>
              )}

              {/* Email Field (Signin, Signup, Forgot) */}
              {mode !== "reset" && (
                <div className={`floating-input-group ${focusedField === "email" || email ? "is-active" : ""}`}>
                  <div className="input-icon-box"><Mail size={16} /></div>
                  <input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                    placeholder=" "
                    required
                  />
                  <label htmlFor="auth-email">Work Email Address</label>
                </div>
              )}

              {/* Password Field (Signin, Signup) */}
              {(mode === "signin" || mode === "signup") && (
                <div className={`floating-input-group ${focusedField === "password" || password ? "is-active" : ""}`}>
                  <div className="input-icon-box"><LockKeyhole size={16} /></div>
                  <input
                    id="auth-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                    placeholder=" "
                    required
                    minLength={8}
                  />
                  <label htmlFor="auth-password">
                    {mode === "signin" ? "Password" : "Create Strong Password"}
                  </label>
                  <button
                    type="button"
                    className="password-peek-toggle"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              )}

              {/* New Password Field (Reset only) */}
              {mode === "reset" && (
                <div className={`floating-input-group ${focusedField === "newpwd" || newPassword ? "is-active" : ""}`}>
                  <div className="input-icon-box"><LockKeyhole size={16} /></div>
                  <input
                    id="auth-new-password"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    onFocus={() => setFocusedField("newpwd")}
                    onBlur={() => setFocusedField(null)}
                    placeholder=" "
                    required
                    minLength={8}
                  />
                  <label htmlFor="auth-new-password">New Password (min 8 chars)</label>
                  <button
                    type="button"
                    className="password-peek-toggle"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              )}

              {/* Remember Me & Forgot Password Links */}
              {mode === "signin" && (
                <div className="auth-options-row">
                  <label className="auth-checkbox-label">
                    <input
                      type="checkbox"
                      checked={rememberEmail}
                      onChange={e => setRememberEmail(e.target.checked)}
                    />
                    <span>Remember email</span>
                  </label>

                  <button
                    type="button"
                    className="auth-link-btn"
                    onClick={() => {
                      setError("");
                      setSuccessMsg("");
                      setMode("forgot");
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {/* Submit CTA Button */}
              <button
                type="submit"
                className="auth-submit-btn"
                disabled={submitting}
              >
                {submitting ? (
                  <span className="submitting-spinner-row">
                    <RefreshCw size={16} className="spin-fast" />
                    <span>Authenticating with server...</span>
                  </span>
                ) : (
                  <>
                    <span>
                      {mode === "signin" && "Continue to Workspace"}
                      {mode === "signup" && "Deploy Workspace & Start"}
                      {mode === "forgot" && "Send Reset Link"}
                      {mode === "reset" && "Update Password & Continue"}
                    </span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {/* Mode Switcher Navigation Links */}
            <div className="auth-mode-switch-row">
              {mode === "signin" && (
                <p>
                  Don't have an enterprise account?{" "}
                  <button
                    type="button"
                    className="auth-switch-link"
                    onClick={() => {
                      setError("");
                      setSuccessMsg("");
                      setMode("signup");
                    }}
                  >
                    Sign up now
                  </button>
                </p>
              )}
              {mode === "signup" && (
                <p>
                  Already have an account?{" "}
                  <button
                    type="button"
                    className="auth-switch-link"
                    onClick={() => {
                      setError("");
                      setSuccessMsg("");
                      setMode("signin");
                    }}
                  >
                    Sign in
                  </button>
                </p>
              )}
              {(mode === "forgot" || mode === "reset") && (
                <p>
                  Remembered your password?{" "}
                  <button
                    type="button"
                    className="auth-switch-link"
                    onClick={() => {
                      setError("");
                      setSuccessMsg("");
                      setMode("signin");
                    }}
                  >
                    Back to Sign In
                  </button>
                </p>
              )}
            </div>

            {/* Security Protocol Badges */}
            <div className="auth-security-footer">
              <div className="security-badge-item">
                <ShieldCheck size={14} className="text-emerald" />
                <span>SHA-256 PBKDF2</span>
              </div>
              <div className="security-badge-item">
                <LockKeyhole size={14} className="text-indigo" />
                <span>RFC 7519 JWT</span>
              </div>
              <div className="security-badge-item">
                <Database size={14} className="text-gold" />
                <span>RBAC Isolated</span>
              </div>
            </div>
          </div>
        </section>

        {/* Right Side: 3D Holographic Data Analytics Stage */}
        <section className="login-stage-column" aria-label="InsightOps AI Intelligence Showcase">
          <div className="holographic-stage-wrapper">
            {/* Stage Eyebrow & Headline */}
            <div className="stage-headline-block">
              <span className="stage-kicker">ENTERPRISE DECISION INTELLIGENCE</span>
              <h2 className="stage-title">
                Universal Analytics.<br />
                <span className="gradient-text">Zero Static Limits.</span>
              </h2>
              <p className="stage-subtext">
                Upload raw CSVs or multi-sheet Excel workbooks. InsightOps dynamically profiles schema,
                normalizes data, detects statistical anomalies, and generates Power BI dashboards instantly.
              </p>
            </div>

            {/* Floating Holographic Telemetry Cards */}
            <div className="holographic-cards-matrix">
              {/* Card 1: Data Ingestion */}
              <div className="holo-card holo-card-1">
                <div className="holo-card-top">
                  <span className="holo-icon-box bg-indigo">
                    <Database size={16} />
                  </span>
                  <span className="holo-status-pill green">ACTIVE</span>
                </div>
                <div className="holo-card-metric">
                  <strong>1,284,920</strong>
                  <span>Rows Streamed</span>
                </div>
                <div className="holo-mini-bar">
                  <div className="holo-mini-fill fill-indigo" style={{ width: "94%" }} />
                </div>
                <small className="holo-caption">Universal auto-cleaning applied · 94% quality</small>
              </div>

              {/* Card 2: Anomaly Engine */}
              <div className="holo-card holo-card-2">
                <div className="holo-card-top">
                  <span className="holo-icon-box bg-gold">
                    <Activity size={16} />
                  </span>
                  <span className="holo-status-pill gold">MULTI-MODEL</span>
                </div>
                <div className="holo-card-metric">
                  <strong>0 Critical</strong>
                  <span>Statistical Outliers</span>
                </div>
                <div className="holo-mini-bar">
                  <div className="holo-mini-fill fill-gold" style={{ width: "100%" }} />
                </div>
                <small className="holo-caption">IQR, Z-Score & Rolling 2σ telemetry verified</small>
              </div>

              {/* Card 3: Forecast AI */}
              <div className="holo-card holo-card-3">
                <div className="holo-card-top">
                  <span className="holo-icon-box bg-cyan">
                    <TrendingUp size={16} />
                  </span>
                  <span className="holo-status-pill cyan">+24.8%</span>
                </div>
                <div className="holo-card-metric">
                  <strong>Q4 Projection</strong>
                  <span>AI Predictive Trend</span>
                </div>
                <div className="holo-mini-bar">
                  <div className="holo-mini-fill fill-cyan" style={{ width: "88%" }} />
                </div>
                <small className="holo-caption">95% confidence interval across date hierarchy</small>
              </div>
            </div>

            {/* Supported Dataset Format Pills */}
            <div className="stage-supported-tags">
              <span className="tag-label">Native Universal Ingestion:</span>
              <span className="format-tag">.CSV</span>
              <span className="format-tag">.XLSX</span>
              <span className="format-tag">.XLS</span>
              <span className="domain-tag">Sales & Revenue</span>
              <span className="domain-tag">HR Workforce</span>
              <span className="domain-tag">Healthcare</span>
              <span className="domain-tag">E-Commerce</span>
            </div>
          </div>
        </section>
      </div>

      {/* Modern Enterprise Footer */}
      <footer className="login-footer">
        <div className="footer-left">
          <span>INSIGHTOPS AI SAAS PLATFORM</span>
          <span className="footer-dot">·</span>
          <span>ENTERPRISE DECISION PLATFORM</span>
        </div>
        <div className="footer-right">
          <span>SOC-2 TYPE II AUDITED</span>
          <span className="footer-dot">·</span>
          <span>256-BIT ENCRYPTION</span>
        </div>
      </footer>
    </main>
  );
}
