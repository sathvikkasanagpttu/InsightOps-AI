import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("insightops_token") || "");
  const [user, setUser] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize and verify user on mount or token change
  useEffect(() => {
    async function initAuth() {
      if (!token) {
        setUser(null);
        setWorkspaces([]);
        setActiveWorkspace(null);
        setLoading(false);
        return;
      }
      try {
        const me = await api("/api/auth/me");
        setUser(me);
        setWorkspaces(me.workspaces || []);
        
        // Select active workspace
        const storedWsId = localStorage.getItem("insightops_active_workspace_id");
        const matching = (me.workspaces || []).find(w => w.id === storedWsId) || (me.workspaces || [])[0] || null;
        setActiveWorkspace(matching);
      } catch (err) {
        console.warn("Auth initialization error:", err.message);
        // If token expired, clear it
        localStorage.removeItem("insightops_token");
        localStorage.removeItem("insightops_refresh_token");
        setToken("");
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    initAuth();
  }, [token]);

  async function login(email, password, rememberMe = true) {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, remember_me: rememberMe })
    });
    localStorage.setItem("insightops_token", data.access_token);
    if (data.refresh_token) {
      localStorage.setItem("insightops_refresh_token", data.refresh_token);
    }
    if (rememberMe) {
      localStorage.setItem("insightops.rememberedEmail", email);
    } else {
      localStorage.removeItem("insightops.rememberedEmail");
    }
    setToken(data.access_token);
    setUser(data.user);
    setWorkspaces(data.user.workspaces || []);
    if (data.user.active_workspace_id) {
      const activeWs = (data.user.workspaces || []).find(w => w.id === data.user.active_workspace_id) || data.user.workspaces?.[0] || null;
      setActiveWorkspace(activeWs);
      if (activeWs) {
        localStorage.setItem("insightops_active_workspace_id", activeWs.id);
      }
    }
    return data;
  }

  async function signup({ email, password, full_name, workspace_name }) {
    const data = await api("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, full_name, workspace_name })
    });
    localStorage.setItem("insightops_token", data.access_token);
    if (data.refresh_token) {
      localStorage.setItem("insightops_refresh_token", data.refresh_token);
    }
    setToken(data.access_token);
    setUser(data.user);
    setWorkspaces(data.user.workspaces || []);
    if (data.user.active_workspace_id) {
      const activeWs = (data.user.workspaces || []).find(w => w.id === data.user.active_workspace_id) || data.user.workspaces?.[0] || null;
      setActiveWorkspace(activeWs);
      if (activeWs) {
        localStorage.setItem("insightops_active_workspace_id", activeWs.id);
      }
    }
    return data;
  }

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch (e) {
      // Ignore network errors on logout
    }
    localStorage.removeItem("insightops_token");
    localStorage.removeItem("insightops_refresh_token");
    localStorage.removeItem("insightops_active_workspace_id");
    setToken("");
    setUser(null);
    setWorkspaces([]);
    setActiveWorkspace(null);
  }

  async function refreshUser() {
    try {
      const me = await api("/api/auth/me");
      setUser(me);
      setWorkspaces(me.workspaces || []);
      if (activeWorkspace) {
        const updated = (me.workspaces || []).find(w => w.id === activeWorkspace.id);
        if (updated) setActiveWorkspace(updated);
      }
      return me;
    } catch (err) {
      console.warn("Failed to refresh user:", err.message);
    }
  }

  function switchWorkspace(workspaceId) {
    const target = workspaces.find(w => w.id === workspaceId);
    if (target) {
      setActiveWorkspace(target);
      localStorage.setItem("insightops_active_workspace_id", target.id);
    }
  }

  async function updateProfile(profileData) {
    const updated = await api("/api/auth/profile", {
      method: "PUT",
      body: JSON.stringify(profileData)
    });
    setUser(prev => ({ ...prev, ...updated }));
    return updated;
  }

  async function demoLogin(role = "admin") {
    // Quick one-click demo login
    if (role === "admin") {
      return await login("admin@insightops.ai", "Password123!", true);
    } else {
      // Create or log in analyst
      try {
        return await login("analyst@insightops.ai", "Password123!", true);
      } catch (err) {
        // If not registered yet, signup
        return await signup({
          email: "analyst@insightops.ai",
          password: "Password123!",
          full_name: "Senior Data Analyst",
          workspace_name: "Analytics Sandbox"
        });
      }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        workspaces,
        activeWorkspace,
        loading,
        login,
        signup,
        logout,
        refreshUser,
        switchWorkspace,
        updateProfile,
        demoLogin
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
