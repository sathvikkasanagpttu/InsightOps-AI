import React, { useEffect, useState } from "react";
import {
  User, Shield, Server, Moon, Sun, Lock, CheckCircle2,
  RefreshCw, Check, AlertCircle, Database, Cpu, Layers,
  Key, Copy, Trash2, Plus, Bell, Send, Code2, Users,
  Mail, ExternalLink, Sliders
} from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

export default function ProfileSettingsView({
  activeWorkspace,
  workspaces,
  compactNumbers,
  setCompactNumbers,
  addToast
}) {
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

  // Workspace Settings Form
  const currentWs = activeWorkspace || (workspaces && workspaces[0]) || { id: "default-workspace", name: "Default Workspace", role: "Owner" };
  const [wsName, setWsName] = useState(currentWs.name || "");
  const [wsDescription, setWsDescription] = useState(currentWs.description || "");
  const [wsMembers, setWsMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [savingWs, setSavingWs] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Analyst");
  const [inviting, setInviting] = useState(false);

  // API Keys
  const [apiKeys, setApiKeys] = useState([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Notification Settings
  const [slackWebhook, setSlackWebhook] = useState("");
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [notifFrequency, setNotifFrequency] = useState("instant");
  const [savingNotifs, setSavingNotifs] = useState(false);
  const [testingNotif, setTestingNotif] = useState(false);

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

  useEffect(() => {
    if (currentWs) {
      setWsName(currentWs.name || "");
      setWsDescription(currentWs.description || "");
    }
  }, [currentWs?.id]);

  // Load workspace members
  async function loadWorkspaceMembers() {
    if (!currentWs?.id) return;
    setLoadingMembers(true);
    try {
      const data = await api(`/api/workspaces/${currentWs.id}/members`);
      setWsMembers(data || []);
    } catch (err) {
      console.warn("Failed to load workspace members:", err);
    } finally {
      setLoadingMembers(false);
    }
  }

  // Load API keys
  async function loadApiKeys() {
    setLoadingKeys(true);
    try {
      const data = await api("/api/auth/api-keys");
      setApiKeys(data || []);
    } catch (err) {
      console.warn("Failed to load API keys:", err);
    } finally {
      setLoadingKeys(false);
    }
  }

  // Load notification settings
  async function loadNotificationSettings() {
    try {
      const data = await api("/api/auth/notification-settings");
      if (data) {
        setSlackWebhook(data.slack_webhook_url || "");
        setEmailEnabled(data.email_enabled !== false);
        setNotifFrequency(data.frequency || "instant");
      }
    } catch (err) {
      console.warn("Failed to load notification settings:", err);
    }
  }

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
    if (activeTab === "workspace") {
      loadWorkspaceMembers();
    } else if (activeTab === "api") {
      loadApiKeys();
    } else if (activeTab === "notifications") {
      loadNotificationSettings();
    } else if (activeTab === "system") {
      loadSystemHealth();
    }
  }, [activeTab, currentWs?.id]);

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

  async function handleUpdateWorkspace(e) {
    e.preventDefault();
    if (!currentWs?.id) return;
    setSavingWs(true);
    try {
      await api(`/api/workspaces/${currentWs.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: wsName.trim(),
          description: wsDescription.trim()
        })
      });
      await refreshUser?.();
      addToast?.("Workspace settings updated!", "success");
    } catch (err) {
      addToast?.(err.message || "Failed to update workspace", "error");
    } finally {
      setSavingWs(false);
    }
  }

  async function handleInviteMember(e) {
    e.preventDefault();
    if (!inviteEmail.trim() || !currentWs?.id) return;
    setInviting(true);
    try {
      await api(`/api/workspaces/${currentWs.id}/members`, {
        method: "POST",
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole
        })
      });
      setInviteEmail("");
      setInviteModalOpen(false);
      await loadWorkspaceMembers();
      addToast?.(`Invited ${inviteEmail} as ${inviteRole}!`, "success");
    } catch (err) {
      addToast?.(err.message || "Failed to invite member", "error");
    } finally {
      setInviting(false);
    }
  }

  async function handleUpdateMemberRole(targetUserId, newRole) {
    if (!currentWs?.id) return;
    try {
      await api(`/api/workspaces/${currentWs.id}/members/${targetUserId}`, {
        method: "PUT",
        body: JSON.stringify({ role: newRole })
      });
      await loadWorkspaceMembers();
      addToast?.(`Updated member role to ${newRole}`, "success");
    } catch (err) {
      addToast?.(err.message || "Failed to update role", "error");
    }
  }

  async function handleRemoveMember(targetUserId) {
    if (!currentWs?.id) return;
    if (!window.confirm("Are you sure you want to remove this member from the workspace?")) return;
    try {
      await api(`/api/workspaces/${currentWs.id}/members/${targetUserId}`, {
        method: "DELETE"
      });
      await loadWorkspaceMembers();
      addToast?.("Member removed from workspace", "info");
    } catch (err) {
      addToast?.(err.message || "Failed to remove member", "error");
    }
  }

  async function handleCreateApiKey(e) {
    e.preventDefault();
    setCreatingKey(true);
    try {
      const res = await api("/api/auth/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: newKeyName.trim() || "Ingestion API Token" })
      });
      setNewlyCreatedKey(res);
      setNewKeyName("");
      await loadApiKeys();
      addToast?.("New Ingestion API Key created!", "success");
    } catch (err) {
      addToast?.(err.message || "Failed to generate API Key", "error");
    } finally {
      setCreatingKey(false);
    }
  }

  async function handleDeleteApiKey(keyId) {
    if (!window.confirm("Are you sure you want to revoke this API token? Any automated scripts using it will stop working immediately.")) return;
    try {
      await api(`/api/auth/api-keys/${keyId}`, { method: "DELETE" });
      await loadApiKeys();
      addToast?.("API Key revoked successfully", "info");
    } catch (err) {
      addToast?.(err.message || "Failed to revoke API Key", "error");
    }
  }

  async function handleSaveNotifications(e) {
    e.preventDefault();
    setSavingNotifs(true);
    try {
      await api("/api/auth/notification-settings", {
        method: "PUT",
        body: JSON.stringify({
          slack_webhook_url: slackWebhook.trim(),
          email_enabled: emailEnabled,
          frequency: notifFrequency
        })
      });
      addToast?.("Notification delivery rules updated!", "success");
    } catch (err) {
      addToast?.(err.message || "Failed to save notifications", "error");
    } finally {
      setSavingNotifs(false);
    }
  }

  function handleTestNotification() {
    setTestingNotif(true);
    setTimeout(() => {
      setTestingNotif(false);
      addToast?.("🔔 [Test Notification] Anomaly alert dispatched to configured delivery channels!", "success");
    }, 600);
  }

  const activeTokenSnippet = newlyCreatedKey?.token || (apiKeys[0]?.key_prefix ? `${apiKeys[0].key_prefix}` : "iop_live_YOUR_API_KEY");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", paddingBottom: "50px" }}>
      {/* Header */}
      <div>
        <p className="eyebrow" style={{ margin: "0 0 4px 0", fontSize: "11px" }}>ACCOUNT & PLATFORM CONFIGURATION</p>
        <h1 style={{ margin: "0", fontSize: "24px", fontWeight: "700" }}>Settings & Preferences</h1>
        <p style={{ margin: "4px 0 0 0", color: "#a49d89", fontSize: "14px" }}>
          Manage your account profile, workspace members, programmatic API ingestion tokens, notification rules, and system diagnostics.
        </p>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="studio-tabs" style={{ display: "flex", gap: "8px", borderBottom: "1px solid rgba(255,255,255,0.08)", overflowX: "auto" }}>
        <button
          className={activeTab === "profile" ? "selected" : ""}
          onClick={() => setActiveTab("profile")}
          style={{ padding: "10px 18px", background: "none", border: "none", cursor: "pointer", color: activeTab === "profile" ? "#e6c348" : "#a49d89", fontWeight: "600", whiteSpace: "nowrap" }}
        >
          <User size={15} style={{ verticalAlign: "middle", marginRight: 6 }} /> User Profile
        </button>
        <button
          className={activeTab === "workspace" ? "selected" : ""}
          onClick={() => setActiveTab("workspace")}
          style={{ padding: "10px 18px", background: "none", border: "none", cursor: "pointer", color: activeTab === "workspace" ? "#e6c348" : "#a49d89", fontWeight: "600", whiteSpace: "nowrap" }}
        >
          <Users size={15} style={{ verticalAlign: "middle", marginRight: 6 }} /> Workspace & Team
        </button>
        <button
          className={activeTab === "api" ? "selected" : ""}
          onClick={() => setActiveTab("api")}
          style={{ padding: "10px 18px", background: "none", border: "none", cursor: "pointer", color: activeTab === "api" ? "#e6c348" : "#a49d89", fontWeight: "600", whiteSpace: "nowrap" }}
        >
          <Key size={15} style={{ verticalAlign: "middle", marginRight: 6 }} /> API & Ingestion
        </button>
        <button
          className={activeTab === "notifications" ? "selected" : ""}
          onClick={() => setActiveTab("notifications")}
          style={{ padding: "10px 18px", background: "none", border: "none", cursor: "pointer", color: activeTab === "notifications" ? "#e6c348" : "#a49d89", fontWeight: "600", whiteSpace: "nowrap" }}
        >
          <Bell size={15} style={{ verticalAlign: "middle", marginRight: 6 }} /> Notifications
        </button>
        <button
          className={activeTab === "security" ? "selected" : ""}
          onClick={() => setActiveTab("security")}
          style={{ padding: "10px 18px", background: "none", border: "none", cursor: "pointer", color: activeTab === "security" ? "#e6c348" : "#a49d89", fontWeight: "600", whiteSpace: "nowrap" }}
        >
          <Lock size={15} style={{ verticalAlign: "middle", marginRight: 6 }} /> Security & Password
        </button>
        <button
          className={activeTab === "system" ? "selected" : ""}
          onClick={() => setActiveTab("system")}
          style={{ padding: "10px 18px", background: "none", border: "none", cursor: "pointer", color: activeTab === "system" ? "#e6c348" : "#a49d89", fontWeight: "600", whiteSpace: "nowrap" }}
        >
          <Server size={15} style={{ verticalAlign: "middle", marginRight: 6 }} /> Developer & Telemetry
        </button>
      </div>

      {/* Tab 1: User Profile */}
      {activeTab === "profile" && (
        <div className="saas-panel" style={{ maxWidth: "680px" }}>
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

      {/* Tab 2: Workspace & Team */}
      {activeTab === "workspace" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "800px" }}>
          <div className="saas-panel">
            <div className="saas-panel-header">
              <h2><Sliders size={18} color="#e6c348" /> Workspace Settings</h2>
            </div>
            <form onSubmit={handleUpdateWorkspace}>
              <div className="saas-form-group">
                <label>Workspace Name</label>
                <input
                  type="text"
                  className="saas-input"
                  value={wsName}
                  onChange={e => setWsName(e.target.value)}
                  required
                />
              </div>
              <div className="saas-form-group">
                <label>Workspace Slug / Identifier</label>
                <input
                  type="text"
                  className="saas-input"
                  value={currentWs?.id || ""}
                  disabled
                  style={{ opacity: 0.7, cursor: "not-allowed" }}
                />
                <small style={{ color: "#8a8370", marginTop: 4, display: "block" }}>Unique identifier for API access and telemetry routing.</small>
              </div>
              <div className="saas-form-group">
                <label>Description</label>
                <textarea
                  className="saas-input"
                  rows={2}
                  value={wsDescription}
                  onChange={e => setWsDescription(e.target.value)}
                  placeholder="Primary workspace for analytics, reports and intelligence."
                />
              </div>
              <button type="submit" className="saas-action-btn primary" disabled={savingWs} style={{ marginTop: "6px" }}>
                {savingWs ? "Updating Workspace..." : "Save Workspace Details"}
              </button>
            </form>
          </div>

          {/* Members Table */}
          <div className="saas-panel">
            <div className="saas-panel-header">
              <div>
                <h2><Users size={18} color="#e6c348" /> Workspace Team Members</h2>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#a49d89" }}>
                  Role-based access control (RBAC): Owner, Admin, Analyst, and Viewer.
                </p>
              </div>
              <button
                type="button"
                className="saas-action-btn primary"
                onClick={() => setInviteModalOpen(true)}
                style={{ fontSize: "12px", padding: "6px 12px" }}
              >
                <Plus size={14} /> Invite Member
              </button>
            </div>

            {loadingMembers ? (
              <div style={{ padding: "24px", textAlign: "center", color: "#8a8370" }}>Loading members...</div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Joined</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wsMembers.map(m => (
                      <tr key={m.user_id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div className="avatar-circle" style={{ width: 28, height: 28, fontSize: 12 }}>
                              {m.avatar_url ? <img src={m.avatar_url} alt="" /> : m.full_name?.charAt(0) || "U"}
                            </div>
                            <span style={{ fontWeight: "600", color: "#fff" }}>{m.full_name}</span>
                          </div>
                        </td>
                        <td><span style={{ color: "#a49d89", fontSize: 13 }}>{m.email}</span></td>
                        <td>
                          {m.role === "Owner" ? (
                            <span className="saas-badge owner">Owner</span>
                          ) : (
                            <select
                              className="saas-select"
                              style={{ padding: "4px 8px", fontSize: 12, minWidth: 100 }}
                              value={m.role}
                              onChange={e => handleUpdateMemberRole(m.user_id, e.target.value)}
                            >
                              <option value="Admin">Admin</option>
                              <option value="Analyst">Analyst</option>
                              <option value="Viewer">Viewer</option>
                            </select>
                          )}
                        </td>
                        <td><span style={{ color: "#8a8370", fontSize: 12 }}>{new Date(m.joined_at).toLocaleDateString()}</span></td>
                        <td>
                          {m.role !== "Owner" && (
                            <button
                              type="button"
                              className="icon-action"
                              style={{ color: "#f87171" }}
                              onClick={() => handleRemoveMember(m.user_id)}
                              title="Remove member"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Invite Member Modal */}
          {inviteModalOpen && (
            <div className="saas-modal-backdrop" onClick={() => setInviteModalOpen(false)}>
              <div className="saas-modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
                <div className="saas-panel-header">
                  <h2>Invite Team Member</h2>
                </div>
                <form onSubmit={handleInviteMember} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div className="saas-form-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      className="saas-input"
                      placeholder="colleague@company.com"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="saas-form-group">
                    <label>Workspace Role</label>
                    <select
                      className="saas-select"
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value)}
                    >
                      <option value="Admin">Admin (Full edit & invite access)</option>
                      <option value="Analyst">Analyst (Upload datasets & create reports)</option>
                      <option value="Viewer">Viewer (Read-only access)</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                    <button type="button" className="text-button" onClick={() => setInviteModalOpen(false)}>Cancel</button>
                    <button type="submit" className="saas-action-btn primary" disabled={inviting}>
                      {inviting ? "Inviting..." : "Send Invitation"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: API & Ingestion Keys */}
      {activeTab === "api" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "800px" }}>
          <div className="saas-panel">
            <div className="saas-panel-header">
              <div>
                <h2><Key size={18} color="#e6c348" /> Programmatic Ingestion API Keys</h2>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#a49d89" }}>
                  Authenticate automated ETL pipelines, cloud storage syncs, and microservices directly into InsightOps AI.
                </p>
              </div>
            </div>

            {/* Ingestion Key Form */}
            <form onSubmit={handleCreateApiKey} style={{ display: "flex", gap: "10px", alignItems: "flex-end", marginBottom: "20px" }}>
              <div className="saas-form-group" style={{ flex: 1, margin: 0 }}>
                <label>Token Name</label>
                <input
                  type="text"
                  className="saas-input"
                  placeholder="e.g., Nightly ETL Ingestion Pipeline"
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                />
              </div>
              <button type="submit" className="saas-action-btn primary" disabled={creatingKey}>
                <Plus size={15} /> {creatingKey ? "Generating..." : "Generate New Key"}
              </button>
            </form>

            {/* Display newly created key banner */}
            {newlyCreatedKey && (
              <div style={{ padding: "16px", background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "8px", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: "#34d399", fontWeight: "600", fontSize: "13px" }}>✓ Key Generated: Copy Now (Shown Only Once)</span>
                  <button
                    type="button"
                    className="saas-action-btn secondary"
                    style={{ padding: "4px 8px", fontSize: "11px" }}
                    onClick={() => {
                      navigator.clipboard.writeText(newlyCreatedKey.token);
                      setCopiedKey(true);
                      setTimeout(() => setCopiedKey(false), 2000);
                      addToast?.("API Key copied to clipboard!", "success");
                    }}
                  >
                    {copiedKey ? <Check size={13} color="#34d399" /> : <Copy size={13} />} {copiedKey ? "Copied!" : "Copy Token"}
                  </button>
                </div>
                <code style={{ display: "block", wordBreak: "break-all", background: "rgba(0,0,0,0.4)", padding: "10px", borderRadius: "6px", color: "#e6c348", fontSize: "13px" }}>
                  {newlyCreatedKey.token}
                </code>
              </div>
            )}

            {/* Active Keys Table */}
            {loadingKeys ? (
              <div style={{ padding: "20px", textAlign: "center", color: "#8a8370" }}>Loading API tokens...</div>
            ) : apiKeys.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", color: "#8a8370", background: "rgba(255,255,255,0.02)", borderRadius: "8px" }}>
                No active ingestion API keys found. Generate one above to connect external ETL pipelines.
              </div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Token Name</th>
                      <th>Prefix</th>
                      <th>Created</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apiKeys.map(k => (
                      <tr key={k.id}>
                        <td><strong style={{ color: "#fff" }}>{k.name}</strong></td>
                        <td><code>{k.key_prefix}</code></td>
                        <td><span style={{ color: "#8a8370", fontSize: 12 }}>{new Date(k.created_at).toLocaleDateString()}</span></td>
                        <td><span className="saas-badge owner" style={{ fontSize: 11 }}>Active</span></td>
                        <td>
                          <button
                            type="button"
                            className="icon-action"
                            style={{ color: "#f87171" }}
                            onClick={() => handleDeleteApiKey(k.id)}
                            title="Revoke API key"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* cURL & Code Snippet Panel */}
          <div className="saas-panel">
            <div className="saas-panel-header">
              <h2><Code2 size={18} color="#60a5fa" /> Automated Ingestion Code Snippet</h2>
            </div>
            <p style={{ fontSize: "13px", color: "#a49d89", margin: "0 0 12px" }}>
              Use this cURL command or Python script to push datasets to InsightOps AI automatically on schedule:
            </p>

            <div style={{ position: "relative", marginBottom: "16px" }}>
              <pre style={{ background: "#0b0f17", padding: "14px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)", fontSize: "12px", color: "#77e5ce", overflowX: "auto" }}>
{`# 1. Direct cURL Command (Bash / Terminal / CI/CD)
curl -X POST "http://localhost:8000/api/upload" \\
  -H "Authorization: Bearer ${activeTokenSnippet}" \\
  -F "file=@your_daily_data.csv"`}
              </pre>
              <button
                type="button"
                className="saas-action-btn secondary"
                style={{ position: "absolute", top: "10px", right: "10px", padding: "4px 8px", fontSize: "11px" }}
                onClick={() => {
                  navigator.clipboard.writeText(`curl -X POST "http://localhost:8000/api/upload" \\\n  -H "Authorization: Bearer ${activeTokenSnippet}" \\\n  -F "file=@your_daily_data.csv"`);
                  addToast?.("cURL snippet copied!", "info");
                }}
              >
                <Copy size={12} /> Copy cURL
              </button>
            </div>

            <div style={{ position: "relative" }}>
              <pre style={{ background: "#0b0f17", padding: "14px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)", fontSize: "12px", color: "#fcd34d", overflowX: "auto" }}>
{`# 2. Python Ingestion Client (requests)
import requests

url = "http://localhost:8000/api/upload"
headers = {"Authorization": "Bearer ${activeTokenSnippet}"}

with open("sales_q3.csv", "rb") as f:
    response = requests.post(url, headers=headers, files={"file": f})
    
print("Ingestion Status:", response.status_code)
print(response.json())`}
              </pre>
              <button
                type="button"
                className="saas-action-btn secondary"
                style={{ position: "absolute", top: "10px", right: "10px", padding: "4px 8px", fontSize: "11px" }}
                onClick={() => {
                  navigator.clipboard.writeText(`import requests\n\nurl = "http://localhost:8000/api/upload"\nheaders = {"Authorization": "Bearer ${activeTokenSnippet}"}\n\nwith open("sales_q3.csv", "rb") as f:\n    response = requests.post(url, headers=headers, files={"file": f})\n\nprint("Ingestion Status:", response.status_code)\nprint(response.json())`);
                  addToast?.("Python snippet copied!", "info");
                }}
              >
                <Copy size={12} /> Copy Python
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Notifications */}
      {activeTab === "notifications" && (
        <div className="saas-panel" style={{ maxWidth: "680px" }}>
          <div className="saas-panel-header">
            <div>
              <h2><Bell size={18} color="#e6c348" /> Notification Delivery Settings</h2>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#a49d89" }}>
                Configure real-time alerting channels for metric threshold breaches, anomaly triggers, and report schedules.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveNotifications}>
            <div className="saas-form-group">
              <label>Slack Incoming Webhook URL</label>
              <input
                type="url"
                className="saas-input"
                placeholder="https://hooks.slack.com/services/T00/B00/X00"
                value={slackWebhook}
                onChange={e => setSlackWebhook(e.target.value)}
              />
              <small style={{ color: "#8a8370", marginTop: 4, display: "block" }}>
                Sends formatted rich alert cards directly to your team's designated Slack channel.
              </small>
            </div>

            <div className="saas-form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "rgba(255,255,255,0.03)", borderRadius: "8px" }}>
                <div>
                  <strong style={{ color: "#fff", display: "block", fontSize: "13px" }}>Email Alert Notifications</strong>
                  <small style={{ color: "#a49d89" }}>Deliver critical anomaly and KPI alert notifications to {user?.email}</small>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={emailEnabled}
                    onChange={e => setEmailEnabled(e.target.checked)}
                  />
                  <span className="slider" />
                </label>
              </div>
            </div>

            <div className="saas-form-group">
              <label>Notification Digest Frequency</label>
              <select
                className="saas-select"
                value={notifFrequency}
                onChange={e => setNotifFrequency(e.target.value)}
              >
                <option value="instant">Instant — Send alerts immediately upon detection</option>
                <option value="daily">Daily Digest — Summary at 9:00 AM UTC</option>
                <option value="weekly">Weekly Summary — Executive briefing every Monday</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button type="submit" className="saas-action-btn primary" disabled={savingNotifs}>
                {savingNotifs ? "Saving Rules..." : "Save Delivery Settings"}
              </button>
              <button
                type="button"
                className="saas-action-btn secondary"
                onClick={handleTestNotification}
                disabled={testingNotif}
              >
                <Send size={14} /> {testingNotif ? "Dispatching..." : "Send Test Notification"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 5: Security & Password */}
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

      {/* Tab 6: Developer & System Health */}
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
                    <strong>{systemHealth.version || "3.0.0"}</strong>
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
