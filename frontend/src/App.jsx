import React, { lazy, Suspense } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";

const LoginPage = lazy(() => import("./LoginPage"));
const UniversalApp = lazy(() => import("./UniversalApp"));

function MainRouter() {
  const { user, token, loading, logout } = useAuth();

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#080807", color: "#e6c348", fontFamily: "sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div className="logo" style={{ width: "48px", height: "48px", margin: "0 auto 16px auto", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: "bold" }}>
            IO
          </div>
          <p style={{ letterSpacing: "1px", textTransform: "uppercase", fontSize: "12px", color: "#a49d89" }}>
            Connecting to InsightOps AI SaaS...
          </p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="app-loading">Loading workspace...</div>}>
      {token && user ? (
        <UniversalApp onSignOut={logout} />
      ) : (
        <LoginPage onSuccess={() => {}} />
      )}
    </Suspense>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("InsightOps UI Caught Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#07090e",
          color: "#f8fafc",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          padding: "24px"
        }}>
          <div style={{
            maxWidth: "480px",
            width: "100%",
            background: "rgba(15, 23, 42, 0.8)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            borderRadius: "16px",
            padding: "32px",
            textAlign: "center",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)"
          }}>
            <div style={{
              width: "48px",
              height: "48px",
              margin: "0 auto 16px",
              borderRadius: "50%",
              background: "rgba(239, 68, 68, 0.15)",
              color: "#f87171",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
              fontWeight: "bold"
            }}>!</div>
            <h2 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "8px" }}>Platform Interface Notice</h2>
            <p style={{ fontSize: "14px", color: "#94a3b8", lineHeight: "1.5", marginBottom: "20px" }}>
              {this.state.error?.message || "An unexpected rendering event occurred while mounting workspace modules."}
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  padding: "10px 18px",
                  background: "#4f46e5",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                Reload Platform
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                style={{
                  padding: "10px 18px",
                  background: "rgba(255,255,255,0.08)",
                  color: "#cbd5e1",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: "8px",
                  fontWeight: "500",
                  cursor: "pointer"
                }}
              >
                Reset Session
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <MainRouter />
      </AuthProvider>
    </ErrorBoundary>
  );
}
