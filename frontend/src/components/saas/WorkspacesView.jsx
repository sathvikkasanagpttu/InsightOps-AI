import React, { useEffect, useState } from "react";
import {
  Layers, Plus, Users, Shield, Check, Trash2, Edit2, UserPlus,
  Briefcase, ArrowRight, X, AlertCircle
} from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

export default function WorkspacesView({ addToast }) {
  const { user, workspaces, activeWorkspace, switchWorkspace, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedWs, setSelectedWs] = useState(null);
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newWsName, setNewWsName] = useState("");
  const [newWsDesc, setNewWsDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Analyst");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (activeWorkspace) {
      setSelectedWs(activeWorkspace);
    } else if (workspaces?.length > 0) {
      setSelectedWs(workspaces[0]);
    }
  }, [activeWorkspace, workspaces]);

  useEffect(() => {
    if (!selectedWs) return;
    async function fetchMembers() {
      setLoadingMembers(true);
      try {
        const mems = await api(`/api/workspaces/${selectedWs.id}/members`);
        setMembers(Array.isArray(mems) ? mems : []);
      } catch (err) {
        console.warn("Failed to load workspace members:", err);
        setMembers([]);
      } finally {
        setLoadingMembers(false);
      }
    }
    fetchMembers();
  }, [selectedWs]);

  async function handleCreateWorkspace(e) {
    e.preventDefault();
    if (!newWsName.trim()) return;
    setCreating(true);
    try {
      const created = await api("/api/workspaces", {
        method: "POST",
        body: JSON.stringify({ name: newWsName.trim(), description: newWsDesc.trim() })
      });
      await refreshUser();
      switchWorkspace(created.id);
      setSelectedWs(created);
      setCreateModalOpen(false);
      setNewWsName("");
      setNewWsDesc("");
      addToast?.("Workspace created successfully!", "success");
    } catch (err) {
      addToast?.(err.message || "Failed to create workspace", "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleInviteMember(e) {
    e.preventDefault();
    if (!inviteEmail.trim() || !selectedWs) return;
    setInviting(true);
    try {
      await api(`/api/workspaces/${selectedWs.id}/members`, {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole })
      });
      const updatedMembers = await api(`/api/workspaces/${selectedWs.id}/members`);
      setMembers(updatedMembers);
      setInviteModalOpen(false);
      setInviteEmail("");
      addToast?.(`Added ${inviteEmail} as ${inviteRole}`, "success");
    } catch (err) {
      addToast?.(err.message || "Failed to invite member", "error");
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(userId, newRole) {
    if (!selectedWs) return;
    try {
      await api(`/api/workspaces/${selectedWs.id}/members/${userId}`, {
        method: "PUT",
        body: JSON.stringify({ role: newRole })
      });
      setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, role: newRole } : m));
      addToast?.(`Updated member role to ${newRole}`, "success");
    } catch (err) {
      addToast?.(err.message || "Failed to update role", "error");
    }
  }

  async function handleRemoveMember(userId) {
    if (!selectedWs) return;
    if (!window.confirm("Are you sure you want to remove this member from the workspace?")) return;
    try {
      await api(`/api/workspaces/${selectedWs.id}/members/${userId}`, {
        method: "DELETE"
      });
      setMembers(prev => prev.filter(m => m.user_id !== userId));
      addToast?.("Member removed from workspace", "success");
    } catch (err) {
      addToast?.(err.message || "Failed to remove member", "error");
    }
  }

  const isCurrentWsOwnerOrAdmin = selectedWs?.role === "Owner" || selectedWs?.role === "Admin";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", paddingBottom: "40px" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p className="eyebrow" style={{ margin: "0 0 4px 0", fontSize: "11px" }}>ORGANIZATION & PERMISSIONS</p>
          <h1 style={{ margin: "0", fontSize: "24px", fontWeight: "700" }}>Workspace Management</h1>
          <p style={{ margin: "4px 0 0 0", color: "#a49d89", fontSize: "14px" }}>
            Isolate datasets, reports, dashboards and collaborate with team members using Role-Based Access Control (RBAC).
          </p>
        </div>
        <button className="saas-action-btn primary" onClick={() => setCreateModalOpen(true)}>
          <Plus size={16} /> Create Workspace
        </button>
      </div>

      {/* Workspaces Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
        {(workspaces || []).map(ws => {
          const isActive = activeWorkspace?.id === ws.id;
          const isSelected = selectedWs?.id === ws.id;
          return (
            <div
              key={ws.id}
              onClick={() => setSelectedWs(ws)}
              style={{
                background: isSelected ? "rgba(230, 195, 72, 0.08)" : "rgba(255, 255, 255, 0.03)",
                border: isSelected ? "1px solid rgba(230, 195, 72, 0.4)" : "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "12px",
                padding: "20px",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                <div>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", color: "#fff" }}>{ws.name}</h3>
                  <span className={`saas-badge ${ws.role?.toLowerCase() || "viewer"}`}>{ws.role || "Member"}</span>
                </div>
                {isActive && (
                  <span style={{ fontSize: "11px", color: "#e6c348", background: "rgba(230,195,72,0.15)", padding: "2px 8px", borderRadius: "4px", fontWeight: "600" }}>
                    ACTIVE
                  </span>
                )}
              </div>

              <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#a49d89", minHeight: "36px" }}>
                {ws.description || "No description provided."}
              </p>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontSize: "12px", color: "#8a8370" }}>
                  {ws.member_count ? `${ws.member_count} Members` : "Team Workspace"}
                </span>
                {!isActive ? (
                  <button
                    className="saas-action-btn secondary"
                    style={{ padding: "4px 10px", fontSize: "12px" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      switchWorkspace(ws.id);
                      setSelectedWs(ws);
                      addToast?.(`Switched to workspace: ${ws.name}`, "success");
                    }}
                  >
                    Switch to Workspace
                  </button>
                ) : (
                  <span style={{ fontSize: "12px", color: "#10b981", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Check size={14} /> Currently Selected
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Workspace Members & RBAC */}
      {selectedWs && (
        <div className="saas-panel">
          <div className="saas-panel-header">
            <div>
              <h2><Users size={18} color="#e6c348" /> {selectedWs.name} — Team Members & Roles</h2>
              <p style={{ margin: "2px 0 0 0", color: "#a49d89", fontSize: "12px" }}>
                Control access permissions: Owner (full admin), Admin (manage members), Analyst (create visuals/reports), Viewer (read-only).
              </p>
            </div>
            {isCurrentWsOwnerOrAdmin && (
              <button className="saas-action-btn primary" onClick={() => setInviteModalOpen(true)}>
                <UserPlus size={15} /> Add Member
              </button>
            )}
          </div>

          {loadingMembers ? (
            <div style={{ padding: "30px", textAlign: "center", color: "#8a8370" }}>Loading team members...</div>
          ) : members.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: "#8a8370" }}>
              No other members in this workspace. Invite colleagues to collaborate.
            </div>
          ) : (
            <table className="saas-table">
              <thead>
                <tr>
                  <th>Member Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined Date</th>
                  {isCurrentWsOwnerOrAdmin && <th style={{ textAlign: "right" }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.user_id}>
                    <td style={{ fontWeight: "600", color: "#fff" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div className="avatar-circle" style={{ width: "26px", height: "26px", fontSize: "11px" }}>
                          {m.full_name?.charAt(0) || "U"}
                        </div>
                        <span>{m.full_name || "Workspace Member"}</span>
                        {m.user_id === user?.id && <span style={{ fontSize: "10px", color: "#e6c348" }}>(You)</span>}
                      </div>
                    </td>
                    <td>{m.email}</td>
                    <td>
                      {isCurrentWsOwnerOrAdmin && m.user_id !== user?.id && m.role !== "Owner" ? (
                        <select
                          className="saas-select"
                          value={m.role}
                          onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                          style={{ padding: "4px 8px", fontSize: "12px", width: "auto" }}
                        >
                          <option value="Admin">Admin</option>
                          <option value="Analyst">Analyst</option>
                          <option value="Viewer">Viewer</option>
                        </select>
                      ) : (
                        <span className={`saas-badge ${m.role?.toLowerCase() || "viewer"}`}>{m.role}</span>
                      )}
                    </td>
                    <td style={{ color: "#8a8370", fontSize: "12px" }}>
                      {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : "Active"}
                    </td>
                    {isCurrentWsOwnerOrAdmin && (
                      <td style={{ textAlign: "right" }}>
                        {m.user_id !== user?.id && m.role !== "Owner" && (
                          <button
                            className="text-button"
                            style={{ color: "#f87171" }}
                            onClick={() => handleRemoveMember(m.user_id)}
                            title="Remove member from workspace"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Create Workspace Modal */}
      {createModalOpen && (
        <div className="saas-modal-backdrop" onClick={() => setCreateModalOpen(false)}>
          <div className="saas-modal" onClick={e => e.stopPropagation()}>
            <div className="saas-modal-header">
              <h3>Create New Workspace</h3>
              <button className="text-button" onClick={() => setCreateModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateWorkspace}>
              <div className="saas-modal-body">
                <div className="saas-form-group">
                  <label>Workspace Name *</label>
                  <input
                    type="text"
                    className="saas-input"
                    placeholder="e.g. Sales Analytics, Finance Q3, HR Team"
                    value={newWsName}
                    onChange={e => setNewWsName(e.target.value)}
                    required
                  />
                </div>
                <div className="saas-form-group">
                  <label>Description</label>
                  <textarea
                    className="saas-textarea"
                    rows={3}
                    placeholder="Describe the purpose or domain of this workspace..."
                    value={newWsDesc}
                    onChange={e => setNewWsDesc(e.target.value)}
                  />
                </div>
              </div>
              <div className="saas-modal-footer">
                <button type="button" className="saas-action-btn secondary" onClick={() => setCreateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="saas-action-btn primary" disabled={creating}>
                  {creating ? "Creating..." : "Create Workspace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {inviteModalOpen && (
        <div className="saas-modal-backdrop" onClick={() => setInviteModalOpen(false)}>
          <div className="saas-modal" onClick={e => e.stopPropagation()}>
            <div className="saas-modal-header">
              <h3>Add Member to {selectedWs?.name}</h3>
              <button className="text-button" onClick={() => setInviteModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleInviteMember}>
              <div className="saas-modal-body">
                <div className="saas-form-group">
                  <label>Member Email Address *</label>
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
                    <option value="Admin">Admin (Can manage settings, datasets & members)</option>
                    <option value="Analyst">Analyst (Can create reports, visuals & queries)</option>
                    <option value="Viewer">Viewer (Can view reports & dashboards only)</option>
                  </select>
                </div>
              </div>
              <div className="saas-modal-footer">
                <button type="button" className="saas-action-btn secondary" onClick={() => setInviteModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="saas-action-btn primary" disabled={inviting}>
                  {inviting ? "Adding..." : "Add to Workspace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
