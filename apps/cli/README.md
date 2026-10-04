# NoxConnect CLI

One NoxConnect login works across every organization, project, and enabled
capability available to the signed-in person.

```sh
npm install --global noxconnect
noxconnect login
noxconnect use No-Box-Dev/project
noxconnect whoami
noxconnect activity
noxconnect incidents
noxconnect incidents resolve inc_0123456789abcdef0123456789abcdef
noxconnect issues
noxconnect feedback
```

Changing project context never signs in again or creates another credential.
Interactive sessions are stored in the operating-system credential store when
one is available and are shared across config directories for the same
operating-system user. Concurrent login and refresh operations are serialized.
`noxconnect logout` therefore signs out every local process sharing the session.
CI should use a project-scoped automation token instead of a person's session.

Incident actions use the fixed `inc_…` ID returned by `noxconnect incidents`.
Fingerprints are diagnostic grouping data and are never placed in action URLs.

During the domain migration the public gateway remains
`https://app.noxhere.com`; this is an endpoint detail, not a second identity.
