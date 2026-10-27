-- Operationele voorraad, kostprijs en stap-voor-stap onderhoud.
-- Een bestelling verhoogt alleen `on_order`; voorraad ontstaat pas bij ontvangst.

ALTER TABLE materials ADD COLUMN is_training INTEGER NOT NULL DEFAULT 0 CHECK(is_training IN (0,1));
ALTER TABLE materials ADD COLUMN package_code TEXT;
ALTER TABLE materials ADD COLUMN selected_options TEXT CHECK(selected_options IS NULL OR json_valid(selected_options));

CREATE TABLE operational_suppliers (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT, postal_code TEXT, city TEXT, country TEXT,
 vat_number TEXT, chamber_of_commerce TEXT, iban TEXT, bic TEXT, email TEXT, administration_email TEXT,
 phone TEXT, portal_url TEXT, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE inventory_items (
 sku TEXT PRIMARY KEY, ean TEXT, name TEXT NOT NULL, category TEXT NOT NULL,
 tracking_mode TEXT NOT NULL CHECK(tracking_mode IN ('mass','volume','length','count','tool','equipment','resale')),
 base_unit TEXT NOT NULL, purchase_unit_label TEXT NOT NULL,
 contents_per_purchase_unit REAL NOT NULL CHECK(contents_per_purchase_unit>0),
 procedure TEXT NOT NULL CHECK(procedure IN ('wax','cleaning','repair','filing','setup','resale')),
 on_hand REAL NOT NULL DEFAULT 0 CHECK(on_hand>=0), on_order REAL NOT NULL DEFAULT 0 CHECK(on_order>=0),
 average_cost_per_base REAL NOT NULL DEFAULT 0 CHECK(average_cost_per_base>=0),
 allocation_target INTEGER NOT NULL DEFAULT 300 CHECK(allocation_target>0),
 minimum_stock REAL NOT NULL DEFAULT 0 CHECK(minimum_stock>=0), active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 updated_at TEXT NOT NULL
);

CREATE TABLE purchase_orders (
 id TEXT PRIMARY KEY, supplier_id TEXT NOT NULL REFERENCES operational_suppliers(id), order_number TEXT NOT NULL UNIQUE,
 order_date TEXT, requested_delivery TEXT, status TEXT NOT NULL DEFAULT 'ordered' CHECK(status IN ('draft','ordered','part_received','received','cancelled')),
 discount_percent REAL NOT NULL DEFAULT 0, net_total REAL NOT NULL DEFAULT 0, source_filename TEXT, notes TEXT,
 created_at TEXT NOT NULL, received_at TEXT
);
CREATE TABLE purchase_order_lines (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES purchase_orders(id), sku TEXT NOT NULL REFERENCES inventory_items(sku),
 quantity_ordered REAL NOT NULL CHECK(quantity_ordered>0), quantity_received REAL NOT NULL DEFAULT 0 CHECK(quantity_received>=0),
 net_unit_price REAL NOT NULL CHECK(net_unit_price>=0), line_total REAL NOT NULL CHECK(line_total>=0),
 delivery_batch INTEGER NOT NULL DEFAULT 1, UNIQUE(order_id,sku)
);
CREATE INDEX purchase_order_lines_order ON purchase_order_lines(order_id);

CREATE TABLE inventory_movements (
 id TEXT PRIMARY KEY, sku TEXT NOT NULL REFERENCES inventory_items(sku),
 movement_type TEXT NOT NULL CHECK(movement_type IN ('receipt','maintenance','training','adjustment','tool_replacement')),
 quantity REAL NOT NULL, unit_cost REAL NOT NULL DEFAULT 0, reference_type TEXT, reference_id TEXT, note TEXT,
 actor TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX inventory_movements_item ON inventory_movements(sku,created_at);
CREATE INDEX inventory_movements_reference ON inventory_movements(reference_type,reference_id);

CREATE TABLE tool_assets (
 id TEXT PRIMARY KEY, sku TEXT NOT NULL REFERENCES inventory_items(sku), label TEXT NOT NULL,
 acquisition_cost REAL NOT NULL DEFAULT 0 CHECK(acquisition_cost>=0), allocation_target INTEGER NOT NULL DEFAULT 300 CHECK(allocation_target>0),
 uses_count INTEGER NOT NULL DEFAULT 0 CHECK(uses_count>=0), total_seconds INTEGER NOT NULL DEFAULT 0 CHECK(total_seconds>=0),
 acquired_at TEXT NOT NULL, first_used_at TEXT, last_used_at TEXT, retired_at TEXT,
 replacement_asset_id TEXT REFERENCES tool_assets(id), active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 source_order_line_id TEXT REFERENCES purchase_order_lines(id)
);
CREATE INDEX tool_assets_item ON tool_assets(sku,active,acquired_at);

CREATE TABLE maintenance_steps (
 id TEXT PRIMARY KEY, material_id TEXT NOT NULL REFERENCES materials(id), step_order INTEGER NOT NULL,
 step_code TEXT NOT NULL, title TEXT NOT NULL, instruction TEXT NOT NULL,
 procedure TEXT NOT NULL CHECK(procedure IN ('inspection','setup','cleaning','repair','filing','wax','finish')),
 required_items TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(required_items)),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','paused','completed','skipped')),
 started_at TEXT, completed_at TEXT, duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK(duration_seconds>=0),
 member_id TEXT REFERENCES members(id), created_at TEXT NOT NULL,
 UNIQUE(material_id,step_order), UNIQUE(material_id,step_code)
);
CREATE INDEX maintenance_steps_material ON maintenance_steps(material_id,step_order);
CREATE TABLE maintenance_step_sessions (
 id TEXT PRIMARY KEY, step_id TEXT NOT NULL REFERENCES maintenance_steps(id), material_id TEXT NOT NULL REFERENCES materials(id),
 member_id TEXT NOT NULL REFERENCES members(id), is_training INTEGER NOT NULL DEFAULT 0 CHECK(is_training IN (0,1)),
 started_at TEXT NOT NULL, ended_at TEXT, duration_seconds INTEGER
);
CREATE UNIQUE INDEX one_active_step_per_member ON maintenance_step_sessions(member_id) WHERE ended_at IS NULL;
CREATE UNIQUE INDEX one_active_session_per_step ON maintenance_step_sessions(step_id) WHERE ended_at IS NULL;
CREATE INDEX maintenance_step_sessions_step ON maintenance_step_sessions(step_id,started_at);
CREATE TABLE maintenance_measurements (
 id TEXT PRIMARY KEY, step_id TEXT NOT NULL REFERENCES maintenance_steps(id), material_id TEXT NOT NULL REFERENCES materials(id),
 sku TEXT REFERENCES inventory_items(sku), measurement_type TEXT NOT NULL CHECK(measurement_type IN ('weight_start','weight_end','correction')),
 value REAL NOT NULL CHECK(value>=0), unit TEXT NOT NULL, note TEXT, member_id TEXT NOT NULL REFERENCES members(id), created_at TEXT NOT NULL
);
CREATE INDEX maintenance_measurements_step ON maintenance_measurements(step_id,created_at);
CREATE TABLE maintenance_usage (
 id TEXT PRIMARY KEY, step_id TEXT NOT NULL REFERENCES maintenance_steps(id), material_id TEXT NOT NULL REFERENCES materials(id),
 sku TEXT NOT NULL REFERENCES inventory_items(sku), tool_asset_id TEXT REFERENCES tool_assets(id),
 quantity REAL NOT NULL CHECK(quantity>=0), unit TEXT NOT NULL, cost_snapshot REAL NOT NULL DEFAULT 0 CHECK(cost_snapshot>=0),
 is_training INTEGER NOT NULL DEFAULT 0 CHECK(is_training IN (0,1)), member_id TEXT NOT NULL REFERENCES members(id), created_at TEXT NOT NULL
);
CREATE INDEX maintenance_usage_material ON maintenance_usage(material_id,created_at);
CREATE INDEX maintenance_usage_item ON maintenance_usage(sku,created_at);

INSERT INTO operational_suppliers(id,name,address,postal_code,city,country,vat_number,chamber_of_commerce,iban,bic,email,administration_email,phone,portal_url,notes,created_at,updated_at) VALUES
('newsports','Newsports B.V.','Goudstraat 36','2718 RC','Zoetermeer','Nederland','NL859429787B01','73268119','NL65INGB0008162273','INGBNL2A','office@newsports.nl','Admin@newsports.nl','+31 (0)85 877 17 51','https://www.newsports.nl','Nieuw adres vanaf 01-08-2026; voorheen Amethistweg 31, 2665 NT Bleiswijk. Claims via claims@newsports.nl.','2026-09-29T00:00:00.000Z','2026-09-29T00:00:00.000Z');

INSERT INTO inventory_items(sku,name,category,tracking_mode,base_unit,purchase_unit_label,contents_per_purchase_unit,procedure,on_order,average_cost_per_base,allocation_target,minimum_stock,updated_at) VALUES
('25018','Holmenkol Natural Skiwax Stick 50 g','Verkoopproduct','resale','stuk','stuk',1,'resale',12,9.5,300,2,'2026-09-29T00:00:00.000Z'),
('24101','Holmenkol Alpha Mix Yellow 150 g','Warme wax','mass','g','blok 150 g',150,'wax',450,9.5/150.0,300,150,'2026-09-29T00:00:00.000Z'),
('24121','Holmenkol Ultra Mix Blue 150 g','Koude wax','mass','g','blok 150 g',150,'wax',450,9.5/150.0,300,150,'2026-09-29T00:00:00.000Z'),
('27933','Holmenkol Performance Bar Purple 150 g','Performance wax','mass','g','blok 150 g',150,'wax',150,23.75/150.0,300,50,'2026-09-29T00:00:00.000Z'),
('24057','Holmenkol Beta Mix Red 5 x 190 g','Universele wax','mass','g','doos 5 x 190 g',950,'wax',1900,47.5/950.0,300,380,'2026-09-29T00:00:00.000Z'),
('24408','Holmenkol Repair-Strips transparant 50 stuks','Belagreparatie','count','stuk','doos 50',50,'repair',50,11.875/50.0,300,10,'2026-09-29T00:00:00.000Z'),
('24409','Holmenkol Repair-Strips zwart 50 stuks','Belagreparatie','count','stuk','doos 50',50,'repair',50,11.875/50.0,300,10,'2026-09-29T00:00:00.000Z'),
('25502','Holmenkol Stopper Holder 12 stuks','Werkplaatsgereedschap','tool','stuk','set 12',12,'setup',12,4.75/12.0,300,0,'2026-09-29T00:00:00.000Z'),
('20687set','Holmenkol SPEEDBORSTEL SET premium','Waxgereedschap','equipment','stuk','set',1,'wax',1,211.984425,300,0,'2026-09-29T00:00:00.000Z'),
('20551','Holmenkol Slijpset PRO','Slijpgereedschap','equipment','stuk','set',1,'filing',1,100.689075,300,0,'2026-09-29T00:00:00.000Z'),
('25422','Holmenkol Cleaner 1000 ml','Reiniging','volume','ml','fles 1000 ml',1000,'cleaning',1000,15.675/1000.0,300,200,'2026-09-29T00:00:00.000Z'),
('24491','Holmenkol Care Fleece 102 m x 20 cm','Reiniging','length','cm','rol 102 m',10200,'cleaning',10200,28.5/10200.0,300,1000,'2026-09-29T00:00:00.000Z'),
('20606','Holmenkol Wax Iron Storage Plate','Waxgereedschap','equipment','stuk','stuk',1,'wax',1,2.375,300,0,'2026-09-29T00:00:00.000Z'),
('24580','Holmenkol Digital Racing Waxer 15 mm 230V','Waxgereedschap','equipment','stuk','stuk',1,'wax',1,123.5,300,0,'2026-09-29T00:00:00.000Z'),
('25631','Holmenkol Plastic Scraper 5 mm','Waxgereedschap','tool','stuk','stuk',1,'wax',12,4.275,300,2,'2026-09-29T00:00:00.000Z'),
('25635','Holmenkol Stainless Steel Scraper','Reparatiegereedschap','tool','stuk','stuk',1,'repair',1,4.75,300,0,'2026-09-29T00:00:00.000Z'),
('24622','Holmenkol Scraper Sharpener Racing','Waxgereedschap','equipment','stuk','stuk',1,'wax',1,23.75,300,0,'2026-09-29T00:00:00.000Z'),
('24498','Holmenkol Side Wall Planer Pro','Slijpgereedschap','tool','stuk','stuk',1,'filing',1,52.25,300,0,'2026-09-29T00:00:00.000Z'),
('25521','Holmenkol Cross File MINI','Vijl','tool','stuk','stuk',1,'filing',1,9.5,300,0,'2026-09-29T00:00:00.000Z'),
('25564','Holmenkol Filebrush','Slijpgereedschap','tool','stuk','stuk',1,'filing',1,4.75,300,0,'2026-09-29T00:00:00.000Z'),
('24684','Holmenkol Diamond File Coarse','Vijl','tool','stuk','stuk',1,'filing',1,11.875,300,0,'2026-09-29T00:00:00.000Z'),
('24432','Holmenkol Super Pro Plus Worldcup','Slijpgereedschap','equipment','stuk','stuk',1,'filing',1,104.5,300,0,'2026-09-29T00:00:00.000Z'),
('20516','Holmenkol Board / FreerideFix','Werkplaatsgereedschap','equipment','stuk','stuk',1,'setup',1,61.75,300,0,'2026-09-29T00:00:00.000Z');

UPDATE inventory_items SET ean=CASE sku
 WHEN '25018' THEN '4250081650182' WHEN '24101' THEN '4250081611169' WHEN '24121' THEN '4250081611183'
 WHEN '27933' THEN '4250081649339' WHEN '24057' THEN '4250081640572' WHEN '24408' THEN '4250081644082'
 WHEN '24409' THEN '4250081644099' WHEN '25502' THEN '4250081655026' WHEN '25422' THEN '4250081654227'
 WHEN '24491' THEN '4250081615518' WHEN '20606' THEN '4250081606066' WHEN '24580' THEN '4250081645805'
 WHEN '25631' THEN '4250081656313' WHEN '25635' THEN '4250081656351' WHEN '24622' THEN '4250081616096'
 WHEN '24498' THEN '4250081644983' WHEN '25521' THEN '4250081655217' WHEN '25564' THEN '4250081655644'
 WHEN '24684' THEN '4250081646840' WHEN '24432' THEN '4250081614153' WHEN '20516' THEN '4250081605168'
 ELSE ean END;

INSERT INTO purchase_orders(id,supplier_id,order_number,order_date,requested_delivery,status,discount_percent,net_total,source_filename,notes,created_at) VALUES
('holmenkol-26-27-2909-v3','newsports','HOLMENKOL-26-27-2909-V3','2026-09-29','Z.s.m.','ordered',5,1125.3985,'Holmenkol_26-27_Orderform_De_Lattenspecialist_2909_V3.xlsx','5% snow-voororderkorting verwerkt. Artikel 25631 als volle verpakking van 12 stuks.','2026-09-29T00:00:00.000Z');

INSERT INTO purchase_order_lines(id,order_id,sku,quantity_ordered,net_unit_price,line_total,delivery_batch) VALUES
('po-25018','holmenkol-26-27-2909-v3','25018',12,9.5,114,1),
('po-24101','holmenkol-26-27-2909-v3','24101',3,9.5,28.5,1),
('po-24121','holmenkol-26-27-2909-v3','24121',3,9.5,28.5,1),
('po-27933','holmenkol-26-27-2909-v3','27933',1,23.75,23.75,1),
('po-24057','holmenkol-26-27-2909-v3','24057',2,47.5,95,1),
('po-24408','holmenkol-26-27-2909-v3','24408',1,11.875,11.875,1),
('po-24409','holmenkol-26-27-2909-v3','24409',1,11.875,11.875,1),
('po-25502','holmenkol-26-27-2909-v3','25502',1,4.75,4.75,1),
('po-20687set','holmenkol-26-27-2909-v3','20687set',1,211.984425,211.984425,1),
('po-20551','holmenkol-26-27-2909-v3','20551',1,100.689075,100.689075,1),
('po-25422','holmenkol-26-27-2909-v3','25422',1,15.675,15.675,1),
('po-24491','holmenkol-26-27-2909-v3','24491',1,28.5,28.5,1),
('po-20606','holmenkol-26-27-2909-v3','20606',1,2.375,2.375,1),
('po-24580','holmenkol-26-27-2909-v3','24580',1,123.5,123.5,1),
('po-25631','holmenkol-26-27-2909-v3','25631',12,4.275,51.3,1),
('po-25635','holmenkol-26-27-2909-v3','25635',1,4.75,4.75,1),
('po-24622','holmenkol-26-27-2909-v3','24622',1,23.75,23.75,1),
('po-24498','holmenkol-26-27-2909-v3','24498',1,52.25,52.25,1),
('po-25521','holmenkol-26-27-2909-v3','25521',1,9.5,9.5,1),
('po-25564','holmenkol-26-27-2909-v3','25564',1,4.75,4.75,1),
('po-24684','holmenkol-26-27-2909-v3','24684',1,11.875,11.875,1),
('po-24432','holmenkol-26-27-2909-v3','24432',1,104.5,104.5,1),
('po-20516','holmenkol-26-27-2909-v3','20516',1,61.75,61.75,1);
