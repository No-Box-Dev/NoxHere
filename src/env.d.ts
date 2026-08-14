// Standard Worker secrets are intentionally absent from wrangler.jsonc.
// Merge only their names into Wrangler's generated Env binding interface.
interface Env {
  CANARY_TOKEN: string;
}
