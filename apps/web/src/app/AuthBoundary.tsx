import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate, useLocation } from "react-router-dom";
import { AUTH_REQUIRED_EVENT, postRawJson } from "../api/http";
import { platformApi } from "../api/platform";
import { WorkspaceProjectSelector, type WorkspaceProfile } from "./WorkspaceProjectSelector";
import { readLastProject } from "./last-project";

const githubClientId = import.meta.env.VITE_GITHUB_APP_CLIENT_ID || "Iv23liSD7Nx3fmV1OQfr";

export function AuthBoundary({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<WorkspaceProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const location = useLocation();
  const queryClient = useQueryClient();
  const routeParts = location.pathname.split("/").filter(Boolean);
  const routeOrganizationId = routeParts[0] ?? "";
  const routeProjectId = routeParts[1] === "select" ? "" : routeParts[1] ?? "";
  const scopedOrganization = profile?.orgs.find(
    (organization) => organization.login.toLowerCase() === routeOrganizationId.toLowerCase(),
  );

  useEffect(() => {
    fetch("/api/auth/profile", { credentials: "same-origin" })
      .then(async (response) => {
        if (response.status === 401) return null;
        if (!response.ok) throw new Error("Could not verify your Nox session");
        return response.json() as Promise<WorkspaceProfile>;
      })
      .then(setProfile)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not verify your Nox session"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!scopedOrganization || !routeProjectId) return;
    void queryClient.prefetchQuery({
      queryKey: ["platform", "bootstrap", scopedOrganization.login, routeProjectId],
      queryFn: ({ signal }) => platformApi.bootstrap(scopedOrganization.login, routeProjectId, signal),
      staleTime: 5 * 60_000,
    });
  }, [queryClient, routeProjectId, scopedOrganization]);

  useEffect(() => {
    const requireAuthentication = () => {
      setError("");
      setLoading(false);
      setProfile(null);
    };
    window.addEventListener(AUTH_REQUIRED_EVENT, requireAuthentication);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, requireAuthentication);
  }, []);

  useEffect(() => {
    if (!profile?.user.login) return;
    const organizationId = scopedOrganization?.login ?? profile.orgs[0]?.login;
    if (!organizationId) return;
    // Product telemetry is deliberately server-side: the browser never sees an
    // ingest key or identity hashing key, and a telemetry failure cannot block
    // opening the app. The endpoint de-duplicates activity to one fact per user
    // per day.
    void postRawJson("/api/v1/app-activity", {}, { organizationId }).catch(() => undefined);
  }, [profile, scopedOrganization]);

  if (loading) return <div className="state-message" role="status"><span className="spinner" />Loading…</div>;
  if (error) return <div className="state-message error" role="alert"><b>Could not open Nox</b><span>{error}</span><button className="button secondary" onClick={() => window.location.reload()}>Retry</button></div>;
  if (!profile) return <Login />;
  if (!profile.orgs.length) return <div className="state-message"><b>No workspace access</b><span>Ask an administrator to invite this email or add your GitHub account.</span></div>;
  if (location.pathname !== "/" && routeOrganizationId && !scopedOrganization) return <Navigate replace to="/" />;
  if (location.pathname === "/") {
    const chooseProject = new URLSearchParams(location.search).get("choose") === "1";
    const lastProject = chooseProject ? null : readLastProject(profile.user.login);
    const canOpenLastProject = lastProject && profile.orgs.some((organization) => organization.login.toLowerCase() === lastProject.organizationId.toLowerCase());
    if (canOpenLastProject) return <Navigate replace to={`/${encodeURIComponent(lastProject.organizationId)}/${encodeURIComponent(lastProject.projectId)}/connections/overview`} />;
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
