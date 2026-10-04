# NoxConnect service boundaries

NoxConnect is the customer-facing product: the web app, public API, CLI,
sessions, organization/project authorization, capability enablement, and API
documentation. Its current compatibility origin is `app.noxhere.com`, and the
gateway is still deployed from the `NoxHere` repository during migration. The
gateway authenticates and scopes every request before it calls an internal
module or service.

The private connectors layer owns GitHub and Slack installations, encrypted
provider tokens, provider clients, connection health, channel routing, the
durable delivery outbox, retries, and final provider delivery. It does not own
the public user experience or decide what a capability says or renders.

GitHub is exclusively a NoxConnect capability. NoxConnect owns webhook receipt
and normalization, installation-token minting, repository discovery, issue and
pull-request synchronization, GitHub reads, and GitHub mutations. Product
services receive bounded domain records or public GitHub URLs only; they never
receive an installation token, App private key, GitHub client, or permission to
call GitHub directly. Generic issue transport lives in `functions/lib/github-issues.js`.
Browser, CLI, and native clients use `/api/v1/auth/profile`,
`/api/v1/github/details`, and the other canonical NoxConnect APIs rather than
Octokit or `api.github.com`. The gateway brokers GitHub approval, the connectors
layer stores the encrypted provider credential, and the gateway issues the
app-facing `nox_at_…`/`nox_rt_…` session. Clients never receive, keep, or forward
the GitHub credential.

| Capability | Owns | Shared connectors plumbing it uses |
| --- | --- | --- |
| Activity | Post/release-note generation, output validation, Slack presentation, and delivery-test content | GitHub event intake, org/project data, managed AI, channel selection, outbox and delivery |
| Feedback | Widget and capture runtime, issue rendering, Slack presentation, and delivery-test content | org/site administration, GitHub installation, destination selection, outbox and delivery |
| Planning | Feature/backlog behavior and planning Slack content | GitHub issue transport, org/repository selection, destination selection, outbox and delivery |
| Incidents | User-event validation, identity hashing, incident detection/repeat policy, and Slack digest presentation | source/key administration, event facts, project metrics, aggregation, GitHub issue transport, destination selection, outbox and delivery |

## Runtime contracts

- Feedback exposes the compatibility contract `noxspot.response` version 1 through the private `NOXSPOT_RESPONSE` binding.
- Incidents exposes the compatibility contract `noxcue.response` version 1 through the private `NOXCUE_RESPONSE` binding.
- Activity exposes the compatibility contract `noxfeed.response` version 1 through the private `NOXFEED_RESPONSE` binding. Its Worker returns either validated generated content or a typed unavailable result; `generationInfo()` reports only provider, model, and secret availability.
- Planning response policy currently lives under `functions/products/noxticket`; the directory and identifiers remain for contract compatibility.

Every adapter validates the contract version, structure, and Slack payload size before shared plumbing stores it. Product services receive only the data needed to render their response; they do not receive Slack tokens, connection IDs, or delivery state.

## Control plane versus product policy

The NoxConnect Admin UI and authenticated `/api/v1` endpoints are the public
control plane. Turning a capability off keeps its data but gates its
public/runtime paths. Capability modules own execution and presentation policy.
Private Workers must not receive the gateway database binding.

When adding behavior, use these rules:

- If it answers “who may do this, for which organization/project, and which
  capability is enabled?”, it belongs to the NoxConnect gateway.
- If it answers “which provider is connected, how do we call it, where should
  this go, and was it delivered?”, it belongs to NoxConnect.
- If it answers “what should this capability store, do, detect, or say?”, it
  belongs to that capability module.
