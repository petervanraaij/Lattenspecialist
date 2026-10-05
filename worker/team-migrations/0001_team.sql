CREATE TABLE members (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, login TEXT NOT NULL UNIQUE,
 key_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), created_at TEXT NOT NULL
);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id), expires_at INTEGER NOT NULL);
CREATE INDEX sessions_member ON sessions(member_id);
CREATE TABLE login_limits (bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE records (
 reference TEXT PRIMARY KEY, payload TEXT NOT NULL CHECK(json_valid(payload)),
 revision INTEGER NOT NULL DEFAULT 0, assigned_to TEXT REFERENCES members(id), actor TEXT NOT NULL DEFAULT 'owner', updated_at TEXT NOT NULL
);
CREATE INDEX records_assigned ON records(assigned_to);
CREATE UNIQUE INDEX records_service_code ON records(json_extract(payload,'$.serviceCode')) WHERE json_extract(payload,'$.serviceCode') IS NOT NULL;
CREATE TABLE team_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT, reference TEXT NOT NULL, actor TEXT NOT NULL, revision INTEGER NOT NULL,
 current_step INTEGER, wax_type TEXT, assigned_to TEXT, closed INTEGER, work_note TEXT, created_at TEXT NOT NULL
);
CREATE TRIGGER record_audit AFTER UPDATE ON records BEGIN
 INSERT INTO team_audit(reference,actor,revision,current_step,wax_type,assigned_to,closed,work_note,created_at)
 VALUES(NEW.reference,NEW.actor,NEW.revision,json_extract(NEW.payload,'$.currentStep'),json_extract(NEW.payload,'$.waxType'),NEW.assigned_to,
 json_extract(NEW.payload,'$.closedAt') IS NOT NULL,json_extract(NEW.payload,'$.workNote'),NEW.updated_at);
END;
