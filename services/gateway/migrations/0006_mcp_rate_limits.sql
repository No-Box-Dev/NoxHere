-- MCP-only counters in CONTROL_DB. Keys are purpose-separated SHA-256 digests;
-- raw IP addresses, bearer credentials and tenant names are never stored.
CREATE TABLE IF NOT EXISTS mcp_rate_limits (
  rate_key TEXT PRIMARY KEY CHECK (
    length(rate_key) = 64 AND rate_key NOT GLOB '*[^0-9a-f]*'
  ),
  window_start INTEGER NOT NULL CHECK (window_start >= 0),
  request_count INTEGER NOT NULL CHECK (request_count > 0),
  expires_at INTEGER NOT NULL CHECK (expires_at > window_start)
);
CREATE INDEX IF NOT EXISTS idx_mcp_rate_limits_expiry ON mcp_rate_limits(expires_at);
