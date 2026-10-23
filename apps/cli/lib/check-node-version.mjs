import { assertSupportedNodeVersion } from './node-version-policy.mjs';

// Always inspect the running binary. Environment variables and CLI arguments
// must not override this value.
assertSupportedNodeVersion(process.versions.node);
