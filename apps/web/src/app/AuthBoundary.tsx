import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { ApiError, AUTH_REQUIRED_EVENT } from "../api/http";
import { platformApi } from "../api/platform";
import { services } from "./service-registry";

type Profile = {
  user: { login: string; email?: string | null };
  orgs: Array<{ login: string; role?: "guest" | "member" | "admin" }>;
};

const githubClientId = import.meta.env.VITE_GITHUB_APP_CLIENT_ID || "Iv23liSD7Nx3fmV1OQfr";

export function AuthBoundary({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [initialScope] = useState(() => {
    const parts = window.location.pathname.split("/").filter(Boolean);
    return { organizationId: parts[0] ?? "", projectId: parts[1] === "select" ? "" : parts[1] ?? "" };
  });
  const location = useLocation();
  const navigate = useNavigate();
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
        return response.json() as Promise<Profile>;
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

  useEffect(() => {
    if (!profile || location.pathname !== "/") return;
    const preferred = profile.orgs[0];
    if (!preferred) return;

    const organizationId = preferred.login.toLowerCase();
    const controller = new AbortController();
    void platformApi.bootstrap(organizationId, "", controller.signal).then((bootstrap) => {
      const project = bootstrap.projects[0];
      if (!project) {
        setError("No project is available for this workspace");
        return;
      }

      const guestService = services.find((service) => !service.hidden && bootstrap.actor.allowedServiceIds.includes(service.id));
      if (bootstrap.actor.accessLevel === "guest" && !guestService) {
        setError("No project capability is available for this account");
        return;
      }

      // The project list and actor access do not change when the canonical
      // project ID is added to the route. Seed that query so login performs
      // one bootstrap request instead of immediately fetching the same data
      // again after navigation.
      queryClient.setQueryData(["platform", "bootstrap", organizationId, project.id], bootstrap);
      const destination = bootstrap.actor.accessLevel === "guest" && guestService
        ? `${guestService.id}/${guestService.defaultView}`
        : "connect/overview";
      void navigate(`/${encodeURIComponent(organizationId)}/${encodeURIComponent(project.id)}/${destination}`, { replace: true });
    }).catch((cause: unknown) => {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      if (cause instanceof ApiError && cause.status === 401) return;
      setError(cause instanceof Error ? cause.message : "Could not open your Nox workspace");
    });
    return () => controller.abort();
  }, [location.pathname, navigate, profile, queryClient]);

  if (loading) return <div className="state-message" role="status"><span className="spinner" />Loading…</div>;
  if (error) return <div className="state-message error" role="alert"><b>Could not open Nox</b><span>{error}</span><button className="button secondary" onClick={() => window.location.reload()}>Retry</button></div>;
  if (!profile) return <Login />;
  if (!profile.orgs.length) return <div className="state-message"><b>No workspace access</b><span>Ask an administrator to invite this email or add your GitHub account.</span></div>;
  if (location.pathname === "/") return <div className="state-message" role="status"><span className="spinner" />Opening your project…</div>;
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
