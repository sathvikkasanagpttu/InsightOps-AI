import React, { useEffect, useState } from "react";
import {
  User, Shield, Server, Moon, Sun, Lock, CheckCircle2,
  RefreshCw, Check, AlertCircle, Database, Cpu, Layers
} from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

export default function ProfileSettingsView({ compactNumbers, setCompactNumbers, addToast }) {
  const { user, updateProfile, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");

  // Profile Form
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || "");
  const [themePref, setThemePref] = useState(user?.theme_preference || "dark");
  const [savingProfile, setSavingProfile] = useState(false);

  // Password Form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // System Health
  const [systemHealth, setSystemHealth] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
      setAvatarUrl(user.avatar_url || "");
      setThemePref(user.theme_preference || "dark");
    }
  }, [user]);

  async function loadSystemHealth() {
    setLoadingHealth(true);
    try {
      const data = await api("/api/system/health");
      setSystemHealth(data);
    } catch (err) {
      console.warn("Failed to load system health:", err);
    } finally {
      setLoadingHealth(false);
    }
  }

  useEffect(() => {
    if (activeTab === "system") {
      loadSystemHealth();
    }
  }, [activeTab]);

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateProfile({
        full_name: fullName.trim(),
        avatar_url: avatarUrl.trim(),
        theme_preference: themePref,
        compact_numbers: compactNumbers
      });
      addToast?.("Profile updated successfully!", "success");
    } catch (err) {
      addToast?.(err.message || "Failed to update profile", "error");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordError("");
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    setSavingPassword(true);
    try {
      await api("/api/auth/password", {
        method: "PUT",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      addToast?.("Password changed successfully!", "success");
    } catch (err) {
      setPasswordError(err.message || "Failed to change password.");
      addToast?.(err.message || "Password change failed", "error");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", paddingBottom: "40px" }}>
      {/* Header */}
      <div>
        <p className="eyebrow" style={{ margin: "0 0 4px 0", fontSize: "11px" }}>ACCOUNT & PLATFORM CONFIGURATION</p>
        <h1 style={{ margin: "0", fontSize: "24px", fontWeight: "700" }}>Settings & Preferences</h1>
        <p style={{ margin: "4px 0 0 0", color: "#a49d89", fontSize: "14px" }}>
          Manage your account profile, credentials, UI themes, and inspect live backend system health.
        </p>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="studio-tabs" style={{ display: "flex", gap: "8px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <button
          className={activeTab === "profile" ? "selected" : ""}
          onClick={() => setActiveTab("profile")}
          style={{ padding: "10px 18px", background: "none", border: "none", cursor: "pointer", color: activeTab === "profile" ? "#e6c348" : "#a49d89", fontWeight: "600" }}
        >
          User Profile
        </button>
        <button
          className={activeTab === "security" ? "selected" : ""}
          onClick={() => setActiveTab("security")}
          style={{ padding: "10px 18px", background: "none", border: "none", cursor: "pointer", color: activeTab === "security" ? "#e6c348" : "#a49d89", fontWeight: "600" }}
        >
          Security & Password
        </button>
        <button
          className={activeTab === "system" ? "selected" : ""}
          onClick={() => setActiveTab("system")}
          style={{ padding: "10px 18px", background: "none", border: "none", cursor: "pointer", color: activeTab === "system" ? "#e6c348" : "#a49d89", fontWeight: "600" }}
        >
          Developer & System Health
        </button>
      </div>

      {/* Tab 1: User Profile */}
      {activeTab === "profile" && (
        <div className="saas-panel" style={{ maxWidth: "600px" }}>
          <div className="saas-panel-header">
            <h2><User size={18} color="#e6c348" /> Profile Information</h2>
          </div>
          <form onSubmit={handleSaveProfile}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px" }}>
              <div className="avatar-circle" style={{ width: "54px", height: "54px", fontSize: "20px" }}>
                {avatarUrl ? <img src={avatarUrl} alt="Avatar" /> : (fullName?.charAt(0) || "U")}
              </div>
              <div>
                <strong style={{ display: "block", color: "#fff", fontSize: "16px" }}>{user?.full_name || "Analyst"}</strong>
                <span style={{ fontSize: "13px", color: "#a49d89" }}>{user?.email}</span>
              </div>
            </div>

            <div className="saas-form-group">
              <label>Full Name</label>
              <input
                type="text"
                className="saas-input"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="saas-form-group">
              <label>Avatar Image URL</label>
              <input
                type="url"
                className="saas-input"
                placeholder="https://example.com/avatar.jpg"
                value={avatarUrl}
                onChange={e => setAvatarUrl(e.target.value)}
              />
            </div>

            <div className="saas-form-group">
              <label>Theme Preference</label>
              <select
                className="saas-select"
                value={themePref}
                onChange={e => setThemePref(e.target.value)}
              >
                <option value="dark">Dark Theme (Default Obsidian & Gold)</option>
                <option value="light">Light Theme (Clean Daylight)</option>
              </select>
            </div>

            <div className="saas-form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "rgba(255,255,255,0.03)", borderRadius: "8px" }}>
                <div>
                  <strong style={{ color: "#fff", display: "block", fontSize: "13px" }}>Compact Metric Numbers</strong>
                  <small style={{ color: "#a49d89" }}>Format large numbers as 1.2M, 45.3K instead of full digits</small>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={compactNumbers}
                    onChange={e => {
                      setCompactNumbers(e.target.checked);
                      localStorage.setItem("insightops.compactNumbers", e.target.checked ? "true" : "false");
                    }}
                  />
                  <span className="slider" />
                </label>
              </div>
            </div>

            <button type="submit" className="saas-action-btn primary" disabled={savingProfile} style={{ marginTop: "12px" }}>
              {savingProfile ? "Saving Changes..." : "Save Profile"}
            </button>
          </form>
        </div>
      )}

      {/* Tab 2: Security & Password */}
      {activeTab === "security" && (
        <div className="saas-panel" style={{ maxWidth: "600px" }}>
          <div className="saas-panel-header">
            <h2><Lock size={18} color="#e6c348" /> Change Password</h2>
          </div>
          <form onSubmit={handleChangePassword}>
            {passwordError && (
              <div style={{ padding: "10px 14px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "6px", color: "#f87171", fontSize: "13px", marginBottom: "16px" }}>
                {passwordError}
              </div>
            )}

            <div className="saas-form-group">
              <label>Current Password</label>
              <input
                type="password"
                className="saas-input"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
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

            <div className="saas-form-group">
              <label>Confirm New Password</label>
              <input
                type="password"
                className="saas-input"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="saas-action-btn primary" disabled={savingPassword} style={{ marginTop: "12px" }}>
              {savingPassword ? "Updating Password..." : "Update Password"}
            </button>
          </form>
        </div>
      )}

      {/* Tab 3: Developer & System Health */}
      {activeTab === "system" && (
        <div className="saas-panel">
          <div className="saas-panel-header">
            <h2><Server size={18} color="#10b981" /> Backend Telemetry & Database Diagnostics</h2>
            <button className="icon-action" onClick={loadSystemHealth} title="Refresh telemetry">
              <RefreshCw size={15} />
            </button>
          </div>

          {loadingHealth ? (
            <div style={{ padding: "30px", textAlign: "center", color: "#8a8370" }}>Querying system diagnostics...</div>
          ) : !systemHealth ? (
            <div style={{ padding: "30px", textAlign: "center", color: "#8a8370" }}>Diagnostics unavailable.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                <div className="saas-stat-card">
                  <div className="saas-stat-icon"><Server size={20} /></div>
                  <div className="saas-stat-info">
                    <span>Database Status</span>
                    <strong style={{ color: "#10b981" }}>Connected</strong>
                    <small>Engine: {systemHealth.database?.dialect}</small>
                  </div>
                </div>

                <div className="saas-stat-card">
                  <div className="saas-stat-icon"><Cpu size={20} /></div>
                  <div className="saas-stat-info">
                    <span>Platform Version</span>
                    <strong>{systemHealth.version || "2.5.0"}</strong>
                    <small>Status: {systemHealth.status}</small>
                  </div>
                </div>

                <div className="saas-stat-card">
                  <div className="saas-stat-icon"><Layers size={20} /></div>
                  <div className="saas-stat-info">
                    <span>Total Datasets</span>
                    <strong>{systemHealth.database?.tables?.datasets ?? 0} Ingested</strong>
                    <small>Universal Stores</small>
                  </div>
                </div>
              </div>

              {/* Table counts grid */}
              <div>
                <h3 style={{ fontSize: "14px", color: "#fff", marginBottom: "12px" }}>SQLAlchemy ORM Table Row Counts</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" }}>
                  {Object.entries(systemHealth.database?.tables || {}).map(([tbl, count]) => (
                    <div key={tbl} style={{ background: "rgba(255,255,255,0.03)", padding: "10px 14px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <span style={{ fontSize: "11px", color: "#8a8370", textTransform: "capitalize" }}>{tbl}</span>
                      <strong style={{ display: "block", fontSize: "18px", color: "#e6c348", marginTop: "2px" }}>{count}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
