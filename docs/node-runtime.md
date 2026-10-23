# Supported Node.js runtime

Use Node.js **22.23.4** for repository development and builds. The supported
stable release lines are 22.23.4 or later in 22.x, 24.22.1 or later in 24.x,
and 26.12.1 or later in 26.x. Older, end-of-life, prerelease, and unreviewed
major versions are not supported. These minimums include the
[October 2026 Node.js security fixes](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases).

## Upgrade and verify before installing or fetching

Obtain a supported binary from [Node.js](https://nodejs.org/en/download), or
use an already installed, trusted version manager. For example, with nvm:

```sh
nvm install 22.23.4
nvm use 22.23.4
node --version
node scripts/check-node-version.mjs
node --test scripts/node-version-policy-checks.mjs
npm ci
```

Run the repository's normal validation commands after switching runtimes.
Repeat the version check in each shell, IDE, automation executor, and build
environment that runs Node-based tools. A pin or dependency update does not
replace an already running binary. Restart long-running development/build
processes under the patched runtime.

The guard checks `process.versions.node`, not a configurable version hint.
Package engine metadata and install lifecycle checks are supplementary:
**npm can perform network requests before a preinstall hook**, so run the
explicit guard before `npm install`, `npm ci`, or `npx`. Repository npm scripts
check the binary before starting their underlying tools. Direct tool commands
also require this explicit preflight. Do not bypass a rejected runtime.

## Build configuration

`.nvmrc` and `.node-version` pin the default. GitHub workflows pin each existing
Node major to a patched exact release and assert the actual version before
project install/build/deploy commands. The SDK publishing job, where present,
keeps Node 24 and pins 24.22.1.

For Git-connected Cloudflare builds, ensure the configured project root can
see the pin and that an existing `NODE_VERSION` setting does not select a
different runtime. See the official [Pages build-image documentation](https://developers.cloudflare.com/pages/configuration/build-image/)
and [Workers build-image documentation](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/).
Verify the actual build log, not just the configured value. Node.js used for
build tooling is distinct from the runtime serving a deployed Worker.
