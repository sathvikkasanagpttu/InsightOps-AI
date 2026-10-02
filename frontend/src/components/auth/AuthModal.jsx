import React, { useState } from "react";
import {
  Mail, Lock, User, ArrowRight, Eye, EyeOff, X,
  CheckCircle2, AlertCircle, Sparkles, Shield
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";

export default function AuthModal({ isOpen, onClose, initialTab = "signin", addToast }) {
  const { login, signup, demoLogin } = useAuth();
  const [tab, setTab] = useState(initialTab); // "signin", "signup", "forgot", "reset"

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Forgot / Reset
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  if (!isOpen) return null;

  async function handleSignIn(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password, rememberMe);
      addToast?.("Signed in successfully!", "success");
      onClose();
    } catch (err) {
      setError(err.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signup({
        email,
        password,
        full_name: fullName,
        workspace_name: workspaceName || "My Workspace"
      });
      addToast?.("Account created and workspace initialized!", "success");
      onClose();
    } catch (err) {
      setError(err.message || "Sign up failed. Please check your details.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);
    try {
      const res = await api("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email })
      });
      setSuccessMsg(res.message || "Password reset token generated.");
      if (res.reset_token) {
        setResetToken(res.reset_token);
        setTab("reset");
      }
    } catch (err) {
      setError(err.message || "Failed to request password reset.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);
    try {
      await api("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token: resetToken, new_password: newPassword })
      });
      addToast?.("Password reset successfully! Please sign in.", "success");
      setTab("signin");
      setPassword("");
    } catch (err) {
      setError(err.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoLogin(role) {
    setLoading(true);
    setError("");
    try {
      await demoLogin(role);
      addToast?.(`Signed in as ${role === "admin" ? "Administrator" : "Senior Analyst"}`, "success");
      onClose();
    } catch (err) {
      setError(err.message || "Demo login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="saas-modal-backdrop" onClick={onClose}>
      <div className="saas-modal" style={{ maxWidth: "460px" }} onClick={e => e.stopPropagation()}>
        <div className="saas-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div className="logo" style={{ width: "24px", height: "24px", fontSize: "12px", borderRadius: "6px" }}>IO</div>
            <strong style={{ color: "#fff", fontSize: "15px" }}>InsightOps AI Access</strong>
          </div>
          <button className="text-button" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Tab switchers */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.2)" }}>
          <button
            style={{
              flex: 1, padding: "12px", background: "none", border: "none",
              borderBottom: tab === "signin" ? "2px solid #e6c348" : "2px solid transparent",
              color: tab === "signin" ? "#e6c348" : "#8a8370",
              fontWeight: "600", fontSize: "13px", cursor: "pointer"
            }}
            onClick={() => { setTab("signin"); setError(""); setSuccessMsg(""); }}
          >
            Sign In
          </button>
          <button
            style={{
              flex: 1, padding: "12px", background: "none", border: "none",
              borderBottom: tab === "signup" ? "2px solid #e6c348" : "2px solid transparent",
              color: tab === "signup" ? "#e6c348" : "#8a8370",
              fontWeight: "600", fontSize: "13px", cursor: "pointer"
            }}
            onClick={() => { setTab("signup"); setError(""); setSuccessMsg(""); }}
          >
            Create Account
          </button>
        </div>

        <div className="saas-modal-body" style={{ padding: "20px 24px" }}>
          {/* Quick Demo Login Buttons */}
          <div style={{ marginBottom: "20px", padding: "12px", background: "rgba(230,195,72,0.06)", border: "1px solid rgba(230,195,72,0.2)", borderRadius: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "#e6c348", display: "block", marginBottom: "8px" }}>
              ⚡ One-Click Demo Access
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="saas-action-btn secondary"
                style={{ flex: 1, padding: "6px 10px", fontSize: "12px", justifyContent: "center" }}
                onClick={() => handleDemoLogin("admin")}
                disabled={loading}
              >
                Admin (Full Access)
              </button>
              <button
                type="button"
                className="saas-action-btn secondary"
                style={{ flex: 1, padding: "6px 10px", fontSize: "12px", justifyContent: "center" }}
                onClick={() => handleDemoLogin("analyst")}
                disabled={loading}
              >
                Analyst (Workspace)
              </button>
            </div>
          </div>

          {error && (
            <div style={{ padding: "10px 14px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "6px", color: "#f87171", fontSize: "13px", marginBottom: "16px" }}>
              {error}
            </div>
          )}

          {successMsg && (
            <div style={{ padding: "10px 14px", background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "6px", color: "#34d399", fontSize: "13px", marginBottom: "16px" }}>
              {successMsg}
            </div>
          )}

          {/* SIGN IN FORM */}
          {tab === "signin" && (
            <form onSubmit={handleSignIn}>
              <div className="saas-form-group">
                <label>Email Address</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="email"
                    className="saas-input"
                    placeholder="you@company.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="saas-form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label style={{ margin: 0 }}>Password</label>
                  <button
                    type="button"
                    className="text-button"
                    style={{ fontSize: "12px", color: "#e6c348" }}
                    onClick={() => { setTab("forgot"); setError(""); }}
                  >
                    Forgot Password?
                  </button>
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="saas-input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    style={{ position: "absolute", right: "12px", top: "11px", background: "none", border: "none", color: "#8a8370", cursor: "pointer" }}
                    onClick={() => setShowPassword(p => !p)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#a49d89", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                  />
                  Remember me
                </label>
              </div>

              <button type="submit" className="saas-action-btn primary" style={{ width: "100%", justifyContent: "center" }} disabled={loading}>
                {loading ? "Authenticating..." : <>Sign In to Workspace <ArrowRight size={16} /></>}
              </button>
            </form>
          )}

          {/* SIGN UP FORM */}
          {tab === "signup" && (
            <form onSubmit={handleSignUp}>
              <div className="saas-form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  className="saas-input"
                  placeholder="Jane Doe"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="saas-form-group">
                <label>Email Address *</label>
                <input
                  type="email"
                  className="saas-input"
                  placeholder="jane@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="saas-form-group">
                <label>Password (min 8 characters) *</label>
                <input
                  type={showPassword ? "text" : "password"}
                  className="saas-input"
                  placeholder="Choose a strong password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>

              <div className="saas-form-group">
                <label>Initial Workspace Name</label>
                <input
                  type="text"
                  className="saas-input"
                  placeholder="e.g. Sales Analytics Workspace"
                  value={workspaceName}
                  onChange={e => setWorkspaceName(e.target.value)}
                />
              </div>

              <button type="submit" className="saas-action-btn primary" style={{ width: "100%", justifyContent: "center" }} disabled={loading}>
                {loading ? "Creating Account..." : "Create Account & Workspace"}
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD FORM */}
          {tab === "forgot" && (
            <form onSubmit={handleForgotPassword}>
              <p style={{ fontSize: "13px", color: "#a49d89", margin: "0 0 16px 0" }}>
                Enter your account email. We will issue a secure verification reset token.
              </p>
              <div className="saas-form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  className="saas-input"
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button type="button" className="saas-action-btn secondary" onClick={() => setTab("signin")}>
                  Back
                </button>
                <button type="submit" className="saas-action-btn primary" style={{ flex: 1, justifyContent: "center" }} disabled={loading}>
                  {loading ? "Sending..." : "Request Reset Token"}
                </button>
              </div>
            </form>
          )}

          {/* RESET PASSWORD FORM */}
          {tab === "reset" && (
            <form onSubmit={handleResetPassword}>
              <div className="saas-form-group">
                <label>Reset Token</label>
                <input
                  type="text"
                  className="saas-input"
                  value={resetToken}
                  onChange={e => setResetToken(e.target.value)}
                  required
                />
              </div>
              <div className="saas-form-group">
                <label>New Password (min 8 characters)</label>
                <input
                  type="password"
                  className="saas-input"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <button type="submit" className="saas-action-btn primary" style={{ width: "100%", justifyContent: "center" }} disabled={loading}>
                {loading ? "Updating..." : "Set New Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
