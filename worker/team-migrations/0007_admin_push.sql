CREATE TABLE admin_push_devices (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, token_ciphertext TEXT NOT NULL,
 credential_version TEXT NOT NULL, generation INTEGER NOT NULL, enabled INTEGER NOT NULL DEFAULT 1,
 registered_at INTEGER NOT NULL, last_received_at INTEGER, last_sent_at INTEGER
);
CREATE INDEX admin_push_devices_token ON admin_push_devices(token_hash);
CREATE TABLE admin_push_events (id TEXT PRIMARY KEY, reference TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE admin_push_deliveries (
 event_id TEXT NOT NULL REFERENCES admin_push_events(id), device_id TEXT NOT NULL REFERENCES admin_push_devices(id),
 state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
 next_at INTEGER NOT NULL DEFAULT 0, lease_until INTEGER NOT NULL DEFAULT 0, accepted_at INTEGER,
 PRIMARY KEY(event_id,device_id)
);
