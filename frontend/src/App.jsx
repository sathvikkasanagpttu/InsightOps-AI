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

export default function App() {
  return (
    <AuthProvider>
      <MainRouter />
    </AuthProvider>
  );
}
