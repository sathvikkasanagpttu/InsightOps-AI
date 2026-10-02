import React, { lazy, Suspense, useState } from "react";
import { ArrowRight, Eye, EyeOff, Lightbulb, LockKeyhole, Mail } from "lucide-react";
import "./login.css";

const LampScene = lazy(() => import("./LampScene"));
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage({ onSuccess }) {
  const rememberedEmail = localStorage.getItem("insightops.rememberedEmail") || "";
  const [email, setEmail] = useState(rememberedEmail);
  const [password, setPassword] = useState("");
  const [rememberEmail, setRememberEmail] = useState(Boolean(rememberedEmail));
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function signIn(event) {
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
    if (rememberEmail) localStorage.setItem("insightops.rememberedEmail", email.trim());
    else localStorage.removeItem("insightops.rememberedEmail");
    window.setTimeout(() => {
      sessionStorage.setItem("insightops.demo-auth", "local-preview");
      onSuccess();
    }, 260);
  }

  return <main className="login-page">
    <Suspense fallback={<div className="lamp-scene"><div className="scene-fallback" /></div>}><LampScene /></Suspense>
    <div className="login-vignette" aria-hidden="true" />
    <header className="login-topbar">
      <a className="login-brand" href="#home" aria-label="InsightOps home"><span className="login-brand-mark"><Lightbulb size={18} /></span><span>INSIGHTOPS</span></a>
      <span className="preview-label"><i /> LOCAL PREVIEW</span>
    </header>

    <div className="login-layout">
      <section className="login-intro" aria-labelledby="login-title">
        <p className="login-eyebrow">BUSINESS INTELLIGENCE, IN FOCUS</p>
        <h1 id="login-title">See the shape<br />of your <em>data.</em></h1>
        <p className="login-lede">One clear view of your records, patterns and next steps.</p>
        <div className="scene-caption"><span /> Dataset intelligence · made visible</div>
      </section>

      <section className="login-panel" aria-label="Sign in to InsightOps">
        <div className="login-panel-heading"><div><p className="login-kicker">WELCOME BACK</p><h2>Sign in</h2><p>Open your analytics workspace.</p></div><span className="login-status-dot" aria-label="Preview available" /></div>
        <form onSubmit={signIn} noValidate>
          <label className="login-label" htmlFor="login-email">Email address</label>
          <div className="login-field"><Mail size={17} aria-hidden="true" /><input id="login-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@company.com" required /></div>

          <div className="password-label-row"><label className="login-label" htmlFor="login-password">Password</label><span>Demo access</span></div>
          <div className="login-field"><LockKeyhole size={17} aria-hidden="true" /><input id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters" required minLength={8} /><button className="password-toggle" type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>

          <div className="login-options"><label className="remember-email"><input type="checkbox" checked={rememberEmail} onChange={event => setRememberEmail(event.target.checked)} /><span>Remember this email</span></label><span className="local-lock"><LockKeyhole size={12} /> Stays in this browser</span></div>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="login-submit" type="submit" disabled={submitting}>{submitting ? "Opening workspace..." : <>Continue to workspace <ArrowRight size={17} /></>}</button>
        </form>
        <div className="login-divider"><span>PREVIEW MODE</span></div>
        <p className="login-disclaimer">This local preview uses the email only as a sign-in label. Credentials are not sent to a server.</p>
      </section>
    </div>
    <footer className="login-footer"><span>INSIGHTOPS AI</span><span>PRIVATE DATA WORKSPACE</span></footer>
  </main>;
}
