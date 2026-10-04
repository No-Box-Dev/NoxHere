ALTER TABLE cue_digest_runs ADD COLUMN transport_outbox_id TEXT REFERENCES transport_outbox(id) ON DELETE SET NULL;
CREATE INDEX idx_cue_digest_runs_transport_outbox ON cue_digest_runs(transport_outbox_id);
