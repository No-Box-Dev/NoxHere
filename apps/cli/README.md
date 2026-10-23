# NoxHere CLI

For Node.js use, require stable 22.23.4+ (22.x), 24.22.1+ (24.x), or 26.12.1+ (26.x). Upgrade the binary before installing or making requests.

One NoxHere login works across every organization, project, and enabled
capability available to the signed-in person.

```sh
npm install --global noxhere
noxhere login
noxhere use No-Box-Dev/project
noxhere whoami
noxhere activity
noxhere incidents
noxhere incidents resolve inc_0123456789abcdef0123456789abcdef
noxhere issues
noxhere feedback
noxhere keys create --name "Production server" --preset write --environment production
noxhere keys list
noxhere login --create-key --project my-project --key-name "Production server"
```

Changing project context never signs in again or creates another credential.
Interactive sessions are stored in the operating-system credential store when
one is available and are shared across config directories for the same
operating-system user. Concurrent login and refresh operations are serialized.
`noxhere logout` therefore signs out every local process sharing the session.
CI should use a project-scoped automation token instead of a person's session.
The `write` preset can ingest telemetry, submit feedback, send configured Slack
messages, and submit developer feedback. Use `--scope` to add individual
capabilities, or choose the smaller `ingest` or read-only `read` preset. The
secret is printed once; only its prefix and audit metadata remain available.

Incident actions use the fixed `inc_…` ID returned by `noxhere incidents`.
Fingerprints are diagnostic grouping data and are never placed in action URLs.

During the domain migration the public gateway remains
`https://app.noxhere.com`; this is an endpoint detail, not a second identity.
