CREATE TABLE IF NOT EXISTS task_quarantine (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quarantine_key TEXT NOT NULL UNIQUE,
  owner_id TEXT,
  delivery_id TEXT,
  task_type TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (length(payload_json) <= 32768),
  attempts INTEGER NOT NULL CHECK (attempts BETWEEN 1 AND 5),
  error TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'quarantined' CHECK (status IN ('quarantined', 'requeuing', 'requeued')),
  quarantined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  requeued_at TEXT
);

CREATE INDEX IF NOT EXISTS task_quarantine_owner_status
  ON task_quarantine(owner_id, status, quarantined_at DESC);
