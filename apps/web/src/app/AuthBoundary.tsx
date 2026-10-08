import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate, useLocation } from "react-router-dom";
import { AUTH_REQUIRED_EVENT } from "../api/http";
import { platformApi } from "../api/platform";
import { WorkspaceProjectSelector, type WorkspaceProfile } from "./WorkspaceProjectSelector";
import { readLastProject } from "./last-project";

const githubClientId = import.meta.env.VITE_GITHUB_APP_CLIENT_ID || "Iv23liSD7Nx3fmV1OQfr";

export function AuthBoundary({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<WorkspaceProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [initialScope] = useState(() => {
    const parts = window.location.pathname.split("/").filter(Boolean);
    return { organizationId: parts[0] ?? "", projectId: parts[1] === "select" ? "" : parts[1] ?? "" };
  });
  const location = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (initialScope.organizationId && initialScope.projectId) {
      void queryClient.prefetchQuery({
        queryKey: ["platform", "bootstrap", initialScope.organizationId, initialScope.projectId],
        queryFn: ({ signal }) => platformApi.bootstrap(initialScope.organizationId, initialScope.projectId, signal),
        staleTime: 5 * 60_000,
      });
    }
    fetch("/api/auth/profile", { credentials: "same-origin" })
      .then(async (response) => {
        if (response.status === 401) return null;
        if (!response.ok) throw new Error("Could not verify your Nox session");
        return response.json() as Promise<WorkspaceProfile>;
      })
      .then(setProfile)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not verify your Nox session"))
      .finally(() => setLoading(false));
  }, [initialScope, queryClient]);

  useEffect(() => {
    const requireAuthentication = () => {
      setError("");
      setLoading(false);
      setProfile(null);
    };
    window.addEventListener(AUTH_REQUIRED_EVENT, requireAuthentication);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, requireAuthentication);
  }, []);

  if (loading) return <div className="state-message" role="status"><span className="spinner" />Loading…</div>;
  if (error) return <div className="state-message error" role="alert"><b>Could not open Nox</b><span>{error}</span><button className="button secondary" onClick={() => window.location.reload()}>Retry</button></div>;
  if (!profile) return <Login />;
  if (!profile.orgs.length) return <div className="state-message"><b>No workspace access</b><span>Ask an administrator to invite this email or add your GitHub account.</span></div>;
  if (location.pathname === "/") {
    const chooseProject = new URLSearchParams(location.search).get("choose") === "1";
    const lastProject = chooseProject ? null : readLastProject(profile.user.login);
    const canOpenLastProject = lastProject && profile.orgs.some((organization) => organization.login.toLowerCase() === lastProject.organizationId.toLowerCase());
    if (canOpenLastProject) return <Navigate replace to={`/${encodeURIComponent(lastProject.organizationId)}/${encodeURIComponent(lastProject.projectId)}/connect/overview`} />;
    return <WorkspaceProjectSelector profile={profile} />;
  }
  return children;
}

function Login() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function requestLink(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError("");
    const response = await fetch("/api/auth/email/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    }).catch(() => null);
    setSending(false);
    if (!response?.ok) {
      setError("The sign-in link could not be sent. Check the address or try again.");
      return;
    }
    setSent(true);
  }

  function githubLogin() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const state = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
    document.cookie = `ut_oauth_state=${state}; Path=/; Max-Age=600; SameSite=Lax; Secure`;
    const redirect = `${window.location.origin}/auth/github/callback`;
    window.location.assign(`https://github.com/login/oauth/authorize?client_id=${githubClientId}&redirect_uri=${encodeURIComponent(redirect)}&state=${state}`);
  }

  return <main className="login-page"><section className="login-panel">
    <div className="login-mark">N</div>
    <h1>Sign in to Nox</h1>
    <p>Open your projects, product activity, feedback, and alerts.</p>
    <form onSubmit={requestLink}>
      <label>Email address<input type="email" autoComplete="email" required value={email} onChange={(event) => { setEmail(event.target.value); setSent(false); }} placeholder="you@company.com" /></label>
      <button className="button primary" disabled={sending || !email.trim()}>{sending ? "Sending…" : "Email me a sign-in link"}</button>
      {sent ? <small className="login-success">If this email has access, the link is on its way.</small> : null}
      {error ? <small className="login-error" role="alert">{error}</small> : null}
    </form>
    <div className="login-divider"><span />or<span /></div>
    <button className="button github" type="button" onClick={githubLogin}>Continue with GitHub</button>
    <small>Guests use email. Verified GitHub members get their organization access automatically.</small>
  </section></main>;
}
