const MAX_PAYLOAD_BYTES = 32_768;
const CREDENTIAL_FIELD = /(?:authorization|cookie|password|secret|token|private.?key)/i;

function safePayload(value, path = "task") {
  if (Array.isArray(value)) return value.map((item, index) => safePayload(item, `${path}[${index}]`));
  if (!value || typeof value !== "object") return value;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (CREDENTIAL_FIELD.test(key)) throw new Error(`credential_field_forbidden:${path}.${key}`);
    result[key] = safePayload(item, `${path}.${key}`);
  }
  return result;
}

export async function quarantineTask(db, task, attempts, error) {
  if (!db || !task || typeof task !== "object" || typeof task.type !== "string") {
    throw new Error("invalid_quarantine_task");
  }
  const payloadJson = JSON.stringify(safePayload(task));
  if (new TextEncoder().encode(payloadJson).byteLength > MAX_PAYLOAD_BYTES) {
    throw new Error("quarantine_payload_too_large");
  }
  const message = (error instanceof Error ? error.stack ?? error.message : String(error ?? "")).slice(0, 4000);
  const quarantineKey = task.deliveryId
    ? `${task.type}:${task.deliveryId}`
    : `${task.type}:${crypto.randomUUID()}`;
  await db.prepare(
    `INSERT INTO task_quarantine
       (quarantine_key, owner_id, delivery_id, task_type, payload_json, attempts, error)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(quarantine_key) DO UPDATE SET
       attempts = excluded.attempts,
       error = excluded.error,
       quarantined_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`,
  ).bind(
    quarantineKey,
    typeof task.ownerId === "string" ? task.ownerId : null,
    typeof task.deliveryId === "string" ? task.deliveryId : null,
    task.type,
    payloadJson,
    attempts,
    message,
  ).run();
  return quarantineKey;
}

export async function requeueQuarantinedTask(db, queue, ownerId, id) {
  const row = await db.prepare(
    `UPDATE task_quarantine SET status = 'requeuing'
      WHERE id = ? AND owner_id = ? AND status = 'quarantined'
      RETURNING id, payload_json`,
  ).bind(id, ownerId).first();
  if (!row) return { status: "not_found" };
  try {
    await queue.send(JSON.parse(row.payload_json));
    await db.prepare(
      `UPDATE task_quarantine
          SET status = 'requeued', requeued_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = ? AND status = 'requeuing'`,
    ).bind(row.id).run();
    return { status: "requeued", id: row.id };
  } catch (error) {
    await db.prepare("UPDATE task_quarantine SET status = 'quarantined' WHERE id = ? AND status = 'requeuing'")
      .bind(row.id).run();
    throw error;
  }
}
