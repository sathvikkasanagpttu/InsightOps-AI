import React, { lazy, Suspense, useState } from "react";

const LoginPage = lazy(() => import("./LoginPage"));
const UniversalApp = lazy(() => import("./UniversalApp"));

export default function App() {
  const [authenticated, setAuthenticated] = useState(() => sessionStorage.getItem("insightops.demo-auth") === "local-preview");

  function signOut() {
    sessionStorage.removeItem("insightops.demo-auth");
    setAuthenticated(false);
  }

  return <Suspense fallback={<div className="app-loading">Preparing your workspace...</div>}>
    {authenticated
      ? <UniversalApp onSignOut={signOut} />
      : <LoginPage onSuccess={() => setAuthenticated(true)} />}
  </Suspense>;
}
