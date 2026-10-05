# NoxConnect setup for AI agents

Use this workflow to configure NoxConnect without relying on the Settings UI. The canonical schema is [`/openapi.json`](/openapi.json), and current progress is always available from `GET /api/v1/integrations/setup`.

## Connect the agent

Choose the credential flow that matches how the agent runs:

- **Supervised local agent:** a human runs `noxconnect login`, completes GitHub
  approval in the browser, then runs
  `noxconnect use <organization>/<project>`. The agent can use the resulting CLI
  session without seeing its access or refresh credentials. The session is
  shared by every NoxConnect process for that operating-system user even when
  agents use different configuration directories; concurrent processes share
  one login and one refresh-token rotation. Install it with
  `npm install --global noxconnect`. Repository maintainers may run the same
  commands as `npm run cli -- login` and
  `npm run cli -- use <organization>/<project>`.
- **Headless agent or CI:** create a project-bound `nox_sk_…` automation token
  in NoxConnect → API access and inject it through the approved runtime secret
  manager. Do not automate a human login or copy a browser session into CI.

Verify a supervised session with `noxconnect whoami`. Use `noxconnect projects`
to discover project names, `noxconnect activity`, `incidents`, `issues`, or
`feedback` for the active project, and `noxconnect api <path>` for another
documented operation. `noxconnect logout` revokes the shared session for every
local process using that operating-system account. The
complete command reference is maintained on [`/developers#cli`](/developers#cli)
and checked against the CLI command catalog in CI.

Incident responses contain a stable `inc_…` ID. Use that ID for actions, for
example `noxconnect incidents resolve <incident-id>`. A fingerprint describes
how occurrences are grouped; it is not an API resource identifier and must not
be encoded into an action URL.

Never ask a user to paste a token, browser cookie, GitHub credential, or Slack
credential into chat. Login and provider consent are human browser actions.

## Discover capabilities

Start with `GET /api/v1/services`. The compatibility path returns NoxConnect's
Planning, Activity, Feedback, and Incidents capabilities. Its stable legacy IDs
remain `noxticket`, `noxfeed`, `noxspot`, and `noxcue` until a versioned
replacement is published. Each entry includes:

- its focus and description;
- the capabilities it provides;
- whether each capability is ready, blocked, or disabled;
- required and optional GitHub or Slack connections; and
- setup sections that group related capabilities; and
- callable operations with a stable ID, HTTP method, path, authentication mode,
  and purpose.

Use `GET /api/v1/services/{service}` when only one capability is relevant. Every
entry exposes the same control-plane shape:

- `GET /api/v1/services/{service}/setup` for its sections and blockers;
- `GET /api/v1/services/{service}/config` for only the settings it owns;
- `PATCH /api/v1/services/{service}/config` for an admin-only partial update; and
- `GET /api/v1/services/{service}/health` for readiness checks.

Capability discovery is read-only; it never starts OAuth or changes organization settings.

## Safe configuration updates

Fetch the service config, retain its `ETag` response header, and send that value
as `If-Match` on `PATCH`. A `412` means another update won the race: fetch the
config again, reapply the intended field changes, and retry. A missing
`If-Match` returns `428`.

```http
GET /api/v1/services/noxticket/config

PATCH /api/v1/services/noxticket/config
If-Match: "<revision-from-get>"
Content-Type: application/json

{ "featureRepository": "product" }
```

NoxConnect owns capability toggles and repository-discovery policy. Planning owns
its feature repository and workflow stages. Activity owns its release-notes
prompt. Feedback site settings and Incidents source settings stay on
their dedicated resource APIs, linked from each service config response. Slack
workspace connections and delivery routes remain shared NoxConnect resources.

The config response includes a `configuration` descriptor. `mode: service`
means the document can be patched using its advertised `writableFields`.
`mode: resource` means configuration belongs to child resources such as sites
or sources. Attempting to patch a resource-scoped service config returns
`409 resource_scoped_config` with the correct resource links.

## Error contract

All canonical `/api/v1/*` endpoints use one error envelope:

```json
{
  "apiVersion": 1,
  "error": {
    "code": "revision_conflict",
    "message": "Settings changed concurrently; fetch config and retry",
    "details": {}
  }
}
```

Clients should branch on `error.code`, not message text. Every `/api/v1/*`
response, including authentication, organization, rate-limit, and service
availability failures raised by middleware, uses this envelope. Existing
unversioned `/api/*` product routes retain their legacy `{ "error": "..." }`
responses for older deployed clients while first-party clients use `/api/v1`.
Compatibility responses include `Deprecation: true` and an OpenAPI link. No
`Sunset` date is set yet; removal will be scheduled only after usage confirms
that supported clients have migrated.

## Authentication

Use the credential class that matches the client:

- The web app authenticates with an opaque HttpOnly NoxConnect session cookie.
  Browser mutations also send the matching CSRF proof. JavaScript never reads
  the session or the encrypted GitHub provider token behind it.
- First-party native apps use a short-lived `nox_at_…` bearer token and rotate it
  with a `nox_rt_…` refresh token through `/api/v1/auth/native/*`.
- User-approved automation uses an expiring, one-project `nox_sk_…` bearer token
  with explicit service scopes. The token supplies its own organization and
  project context; an optional `X-Org` or `X-Project-ID` may only repeat, never
  override, those bounds.
- Public Incidents ingestion uses `X-Nox-Ingest-Key`. It never accepts a browser,
  native, automation, GitHub, or Slack credential.

A native or automation request uses:

```http
Authorization: Bearer <nox_at_… or nox_sk_…>
X-Org: <GitHub organization login>  # required for native; optional for nox_sk
```

For browser and native organization requests, `X-Project-ID` is optional: omit
it to work across the organization, or provide an active project ID to narrow
the request. A project ID in the URL or `project_id` query parameter is also a
selector, and multiple selectors must agree. Automation tokens are the
exception: every `nox_sk_…` token is bound to one project, so any explicit
selector may only repeat that project. Project-restricted guests must select one
of their grants; organization-wide guests may omit the selector.

The user must belong to the organization. Setup mutations require a NoxConnect
organization admin browser session. Never place GitHub credentials or Slack bot
tokens in request bodies; NoxConnect stores provider credentials server-side.

The hosted API is currently for first-party Nox clients and user-approved
automation. It does not issue third-party OAuth client credentials. Create an
automation token from an authenticated organization-admin browser session and
pass it to an agent only through the user's approved secret manager or runtime
environment. Never extract a browser cookie, ask a user to paste a credential
into chat, or print or persist it in logs. Raw GitHub bearer tokens are rejected
as `unsupported_credential`; they are not part of the hosted API authentication
model.

## Resumable workflow

1. Call `GET /api/v1/integrations/setup` for the global onboarding workflow, or a service's `/setup` endpoint for its bounded view.
2. Execute actions whose `state` is `available` and whose `automatable` value is `true`.
3. For a connection step, call its action. The result has `status: requires_user_action` and a `userAction.url`.
4. Give that URL to the user and ask them to open it in a browser and approve the provider. Do not fetch it in a headless HTTP client.
5. Poll `GET /api/v1/integrations/setup` no more than once every five seconds until that step is `complete`, then continue.

GitHub and Slack consent are intentionally human actions. The Slack URL is a
signed, single-purpose first-party browser handoff: opening it sets the OAuth
CSRF cookie and redirects to Slack. Treat the URL as temporary secret material:
do not log it, persist it, prefetch it, or open it in a headless HTTP client. It
works even when the agent initiated the API request on a different machine. The
URL expires after 10 minutes (600 seconds); an expired link returns an
invalid-or-expired authorization error, after which the agent must restart the
Slack connection step to obtain a fresh URL.

## Slack routing

Discover channels:

```http
GET /api/v1/slack/channels
```

Patch only the routes that should change:

```http
PATCH /api/v1/integrations/slack/routing
Content-Type: application/json

{
  "routes": {
    "fallback": "C0123456789",
    "noxcue": "C0123456789",
    "noxticket": "C0234567890",
    "noxfeed_posts": "C0345678901",
    "noxfeed_release_notes": "C0456789012"
  }
}
```

Use `null` to clear a route. The route keys are stable compatibility identifiers:
`noxcue` maps to Incidents, `noxticket` maps to Planning, and the `noxfeed_*`
keys map to Activity. Capability routes fall back to `fallback`; Feedback first
uses its per-site channel and then the organization fallback. For private Slack
channels, invite the NoxConnect bot before assigning the channel.

Project routing is owned by NoxConnect. Discover project candidates, their explicit enabled state, installed repositories, and current named destinations with:

```http
GET /api/v1/projects/routing
```

Update one project atomically with `PUT /api/v1/projects/{projectId}/routing`. The body sets `enabled`, assigns its `repositories`, and supplies the compatibility fields `noxfeedPosts` (Activity posts), `noxfeedReleaseNotes` (Activity release notes), and `noxCue` (Incidents) workspace/channel pairs. Repository mirror rows never participate until explicitly enabled. A repository belongs to one enabled project; assigning it here moves future traffic from its previous project. Empty destination pairs use the corresponding organization route. A project-assigned Slack workspace cannot be used by another project.

Verify a saved route:

```http
POST /api/v1/integrations/slack/test
Content-Type: application/json

{ "route": "noxfeed_release_notes" }
```

An optional `channelId` tests a candidate channel before saving it.

## Feature setup APIs

After connections and organization routes are ready, feature-specific resources remain API-first:

- Feedback sites: `GET`/`POST /api/v1/spots/sites` and `PATCH /api/v1/spots/sites/{siteId}`. Creating a site returns an anonymous-by-default install snippet; it does not grant the widget access to the host website's login session or signup database. The current compatibility JavaScript global is `NoxSpot`: call `NoxSpot.identify({ name, email })` after the widget loads and whenever the account changes, then call `NoxSpot.identify(null)` on sign-out. A manually initialized widget may use `NoxSpot.init({ siteId, getReporter: () => ({ name, email }) })`. Set `notifyOnResolution: true` only when the host has already obtained consent.
- Incidents sources: `GET/POST /api/v1/cues/sources`, project metrics: `GET/PUT /api/v1/cues/projects/{projectId}/metrics`, GitHub incident policy: `GET/PUT /api/v1/cues/github-issues`, keys: `POST /api/v1/cues/sources/{sourceId}/keys`, custom feature health under `/features`, and custom activity statistics under `/custom-metrics`. Register every `custom.*` name before ingest. Each custom activity event is idempotent. GitHub incident routing additionally requires NoxConnect's GitHub connection and a repository linked to the selected project. A source destination overrides its linked project's compatibility `noxCue` route; otherwise the organization route is used. A newly created ingest key is returned only once; transfer it securely and never log it.
- Public Incidents clients submit events to the stable same-origin gateway `POST /api/v1/cues/public/events`; the gateway forwards them through a private service binding. Put the source key in `X-Nox-Ingest-Key`, not the NoxConnect bearer-token headers. Configure each source's workspace, channel, IANA timezone, and local delivery time through its source API. Reusing the same event identity is idempotent.
- Activity resolves each GitHub repository through NoxConnect project routing before using the compatibility `noxfeed_posts` or `noxfeed_release_notes` route.
- Planning uses the compatibility `noxticket` route.

Read the live endpoint response before acting; action links and state in `/api/v1/integrations/setup` take precedence over this narrative guide.

## Mutation and retry safety

Use the operation's `x-change-safety` value in OpenAPI before calling a write.
Do not automatically retry operations marked `write_not_safe_to_retry` or
`destructive`; read the resulting state first and require explicit user
confirmation for deletes, disconnects, revocations, archives, and restores.
Revision-protected config updates are safe only after refetching and reapplying
the intended patch. Incidents event ingestion is the exception: duplicate event
identities are handled idempotently.

On `429`, honor `Retry-After` and stop sending until that delay has elapsed. On
`401`, obtain a fresh user-approved credential instead of retrying the same
token. One-time secrets and OAuth handoff URLs cannot be recovered after they
have been displayed or expired; create a replacement through the advertised
operation.
