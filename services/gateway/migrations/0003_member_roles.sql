PRAGMA foreign_keys = ON;

-- GitHub remains authoritative for membership and organization ownership.
-- NoxHere may assign a managed role only to non-owner members.
ALTER TABLE org_memberships ADD COLUMN managed_role TEXT
  CHECK (managed_role IS NULL OR managed_role IN ('admin', 'member', 'viewer'));

CREATE INDEX IF NOT EXISTS idx_org_memberships_org_role
  ON org_memberships(org_id, role, managed_role);
