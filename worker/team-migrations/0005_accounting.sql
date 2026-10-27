-- Crediteuren en debiteuren. Facturen staan los van voorraadontvangst:
-- een open crediteurenfactuur maakt een bestelling nadrukkelijk niet ontvangen.

CREATE TABLE purchase_invoices (
 id TEXT PRIMARY KEY,
 invoice_number TEXT NOT NULL,
 supplier_id TEXT NOT NULL REFERENCES operational_suppliers(id),
 purchase_order_id TEXT REFERENCES purchase_orders(id),
 supplier_order_number TEXT,
 debtor_number TEXT,
 reference TEXT,
 invoice_date TEXT NOT NULL CHECK(length(invoice_date)=10 AND date(invoice_date) IS NOT NULL AND date(invoice_date)=invoice_date),
 due_date TEXT NOT NULL CHECK(length(due_date)=10 AND date(due_date) IS NOT NULL AND date(due_date)=due_date),
 payment_terms TEXT,
 amount_excl REAL NOT NULL CHECK(amount_excl>=0),
 vat_amount REAL NOT NULL CHECK(vat_amount>=0),
 total_amount REAL NOT NULL CHECK(total_amount>=0 AND abs(total_amount-amount_excl-vat_amount)<0.011),
 currency TEXT NOT NULL DEFAULT 'EUR' CHECK(length(currency)=3 AND currency=upper(currency)),
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','paid')),
 paid_at TEXT CHECK(paid_at IS NULL OR datetime(paid_at) IS NOT NULL),
 source_filename TEXT,
 source_file_hash TEXT CHECK(source_file_hash IS NULL OR (length(source_file_hash)=64 AND source_file_hash=upper(source_file_hash) AND source_file_hash NOT GLOB '*[^0-9A-F]*')),
 notes TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 CHECK(due_date>=invoice_date),
 CHECK((status='open' AND paid_at IS NULL) OR (status='paid' AND paid_at IS NOT NULL)),
 UNIQUE(supplier_id,invoice_number)
);
CREATE INDEX purchase_invoices_due ON purchase_invoices(status,due_date);
CREATE INDEX purchase_invoices_supplier ON purchase_invoices(supplier_id,invoice_date);
CREATE UNIQUE INDEX purchase_invoices_file_hash ON purchase_invoices(source_file_hash) WHERE source_file_hash IS NOT NULL;

CREATE TABLE sales_invoices (
 id TEXT PRIMARY KEY,
 invoice_number TEXT NOT NULL UNIQUE,
 customer_name TEXT NOT NULL,
 customer_code TEXT,
 customer_email TEXT,
 reference TEXT,
 invoice_date TEXT NOT NULL CHECK(length(invoice_date)=10 AND date(invoice_date) IS NOT NULL AND date(invoice_date)=invoice_date),
 due_date TEXT NOT NULL CHECK(length(due_date)=10 AND date(due_date) IS NOT NULL AND date(due_date)=due_date),
 payment_terms TEXT,
 amount_excl REAL NOT NULL CHECK(amount_excl>=0),
 vat_amount REAL NOT NULL CHECK(vat_amount>=0),
 total_amount REAL NOT NULL CHECK(total_amount>=0 AND abs(total_amount-amount_excl-vat_amount)<0.011),
 currency TEXT NOT NULL DEFAULT 'EUR' CHECK(length(currency)=3 AND currency=upper(currency)),
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','paid')),
 paid_at TEXT CHECK(paid_at IS NULL OR datetime(paid_at) IS NOT NULL),
 source_filename TEXT,
 source_file_hash TEXT CHECK(source_file_hash IS NULL OR (length(source_file_hash)=64 AND source_file_hash=upper(source_file_hash) AND source_file_hash NOT GLOB '*[^0-9A-F]*')),
 notes TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 CHECK(due_date>=invoice_date),
 CHECK((status='open' AND paid_at IS NULL) OR (status='paid' AND paid_at IS NOT NULL))
);
CREATE INDEX sales_invoices_due ON sales_invoices(status,due_date);
CREATE INDEX sales_invoices_customer ON sales_invoices(customer_name,invoice_date);
CREATE UNIQUE INDEX sales_invoices_file_hash ON sales_invoices(source_file_hash) WHERE source_file_hash IS NOT NULL;

CREATE TABLE accounting_audit (
 id TEXT PRIMARY KEY,
 invoice_type TEXT NOT NULL CHECK(invoice_type IN ('purchase','sales')),
 invoice_id TEXT NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('created','updated','marked_paid')),
 detail TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(detail)),
 actor TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX accounting_audit_invoice ON accounting_audit(invoice_type,invoice_id,created_at);
CREATE UNIQUE INDEX accounting_audit_paid_once ON accounting_audit(invoice_type,invoice_id,action) WHERE action='marked_paid';

INSERT INTO purchase_invoices(
 id,invoice_number,supplier_id,purchase_order_id,supplier_order_number,debtor_number,reference,
 invoice_date,due_date,payment_terms,amount_excl,vat_amount,total_amount,currency,status,paid_at,
 source_filename,source_file_hash,notes,created_at,updated_at
) VALUES (
 'purchase-newsports-26600713','26600713','newsports','holmenkol-26-27-2909-v3','19699','3110008','Pre-order 26-27 Holmenkol 26-2',
 '2026-10-23','2026-11-22','30 dagen netto',1125.48,236.38,1361.86,'EUR','open',NULL,
 'inv26600713 (1).pdf','111E75E70AEB788046F37B39F71B368D84B9F871B3A3605B904EAC5505D2D11E','Factuur geregistreerd; levering en voorraad blijven afzonderlijk te bevestigen.','2026-10-23T00:00:00.000Z','2026-10-23T00:00:00.000Z'
);

INSERT INTO accounting_audit(id,invoice_type,invoice_id,action,detail,actor,created_at) VALUES(
 'audit-purchase-newsports-26600713-created','purchase','purchase-newsports-26600713','created','{"source":"inv26600713 (1).pdf","seeded":true}','migration','2026-10-23T00:00:00.000Z'
);
