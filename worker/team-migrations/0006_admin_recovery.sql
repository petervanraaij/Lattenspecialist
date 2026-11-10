CREATE TABLE admin_recovery_tokens (
 token_hash TEXT PRIMARY KEY,
 credential_version TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 consumed_at INTEGER
);
CREATE TABLE admin_recovery_rate (
 id INTEGER PRIMARY KEY CHECK(id=1),
 requested_at INTEGER NOT NULL,
 day TEXT NOT NULL,
 attempts INTEGER NOT NULL
);
