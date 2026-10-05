CREATE TABLE materials (
 id TEXT PRIMARY KEY,
 scan_token TEXT NOT NULL UNIQUE,
 display_code TEXT NOT NULL UNIQUE,
 reference TEXT NOT NULL,
 item_number INTEGER NOT NULL,
 kind TEXT NOT NULL,
 package_name TEXT,
 wax_type TEXT,
 assigned_to TEXT REFERENCES members(id),
 internal_status TEXT NOT NULL DEFAULT 'label_created',
 customer_status TEXT NOT NULL DEFAULT 'Afspraak bevestigd',
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 received_at TEXT,
 ready_at TEXT,
 delivered_at TEXT
);
CREATE INDEX materials_reference ON materials(reference);
CREATE INDEX materials_assigned ON materials(assigned_to,internal_status);

CREATE TABLE material_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 material_id TEXT NOT NULL REFERENCES materials(id),
 actor TEXT NOT NULL,
 event_type TEXT NOT NULL,
 detail TEXT,
 created_at TEXT NOT NULL
);
CREATE INDEX material_events_material ON material_events(material_id,created_at);

CREATE TABLE work_sessions (
 id TEXT PRIMARY KEY,
 material_id TEXT REFERENCES materials(id),
 member_id TEXT NOT NULL REFERENCES members(id),
 activity TEXT NOT NULL CHECK(activity IN ('maintenance','pickup','delivery')),
 started_at TEXT NOT NULL,
 ended_at TEXT,
 duration_seconds INTEGER
);
CREATE INDEX work_sessions_member ON work_sessions(member_id,started_at);
CREATE INDEX work_sessions_material ON work_sessions(material_id,started_at);

CREATE TABLE member_availability (
 member_id TEXT NOT NULL REFERENCES members(id),
 work_date TEXT NOT NULL,
 preference TEXT NOT NULL CHECK(preference IN ('available','preferred','unavailable')),
 note TEXT,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(member_id,work_date)
);

CREATE TABLE hrm_settings (
 setting_key TEXT PRIMARY KEY,
 setting_value TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE member_hrm (
 member_id TEXT PRIMARY KEY REFERENCES members(id),
 pin_hash TEXT,
 profile_ciphertext TEXT,
 terms_ciphertext TEXT,
 updated_at TEXT NOT NULL
);
CREATE TABLE hrm_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 member_id TEXT,
 actor TEXT NOT NULL,
 action TEXT NOT NULL,
 created_at TEXT NOT NULL
);

CREATE TABLE routes (
 id TEXT PRIMARY KEY,
 route_date TEXT NOT NULL,
 assigned_to TEXT REFERENCES members(id),
 status TEXT NOT NULL DEFAULT 'planned',
 maps_url TEXT,
 started_at TEXT,
 ended_at TEXT,
 created_at TEXT NOT NULL
);
CREATE TABLE route_stops (
 id TEXT PRIMARY KEY,
 route_id TEXT NOT NULL REFERENCES routes(id),
 reference TEXT NOT NULL,
 stop_order INTEGER NOT NULL,
 customer_name TEXT NOT NULL,
 address TEXT NOT NULL,
 latitude REAL,
 longitude REAL,
 status TEXT NOT NULL DEFAULT 'planned',
 arrived_at TEXT,
 departed_at TEXT,
 item_count INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX route_stops_route ON route_stops(route_id,stop_order);

CREATE TABLE customer_feedback (
 reference TEXT PRIMARY KEY,
 overall INTEGER NOT NULL CHECK(overall BETWEEN 1 AND 5),
 quality INTEGER CHECK(quality BETWEEN 1 AND 5),
 communication INTEGER CHECK(communication BETWEEN 1 AND 5),
 pickup INTEGER CHECK(pickup BETWEEN 1 AND 5),
 speed INTEGER CHECK(speed BETWEEN 1 AND 5),
 comment TEXT,
 created_at TEXT NOT NULL
);
