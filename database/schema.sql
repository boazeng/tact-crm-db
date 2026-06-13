-- TACT-CRM database schema (SQLite). Auto-generated snapshot of the DDL.
-- Source of truth = SQLAlchemy models in backend/app/models/. Regenerate after model changes.

CREATE TABLE api_keys (
	id INTEGER NOT NULL, 
	company_id INTEGER NOT NULL, 
	label VARCHAR(120) NOT NULL, 
	key_prefix VARCHAR(16) NOT NULL, 
	key_hash VARCHAR(64) NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	last_used_at DATETIME, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);

CREATE TABLE companies (
	id INTEGER NOT NULL, 
	name VARCHAR(200) NOT NULL, 
	slug VARCHAR(80) NOT NULL, 
	contact_email VARCHAR(200), 
	phone VARCHAR(40), 
	is_active BOOLEAN NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (slug)
);

CREATE TABLE customer_companies (
	id INTEGER NOT NULL, 
	company_id INTEGER NOT NULL, 
	customer_id INTEGER NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	source VARCHAR(20) NOT NULL, 
	external_ref VARCHAR(120), 
	parent_membership_id INTEGER, 
	is_paying BOOLEAN NOT NULL, 
	paid_by_membership_id INTEGER, 
	is_active BOOLEAN NOT NULL, 
	joined_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_company_customer UNIQUE (company_id, customer_id), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE, 
	FOREIGN KEY(customer_id) REFERENCES customers (id) ON DELETE CASCADE, 
	FOREIGN KEY(parent_membership_id) REFERENCES customer_companies (id) ON DELETE SET NULL, 
	FOREIGN KEY(paid_by_membership_id) REFERENCES customer_companies (id) ON DELETE SET NULL
);

CREATE TABLE customer_field_values (
	id INTEGER NOT NULL, 
	membership_id INTEGER NOT NULL, 
	field_definition_id INTEGER NOT NULL, 
	value VARCHAR(2000), 
	PRIMARY KEY (id), 
	CONSTRAINT uq_membership_field UNIQUE (membership_id, field_definition_id), 
	FOREIGN KEY(membership_id) REFERENCES customer_companies (id) ON DELETE CASCADE, 
	FOREIGN KEY(field_definition_id) REFERENCES field_definitions (id) ON DELETE CASCADE
);

CREATE TABLE customers (
	id INTEGER NOT NULL, 
	full_name VARCHAR(200) NOT NULL, 
	email VARCHAR(200), 
	phone VARCHAR(40), 
	national_id VARCHAR(40), 
	customer_type VARCHAR(20) NOT NULL, 
	notes VARCHAR(2000), 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE field_definitions (
	id INTEGER NOT NULL, 
	company_id INTEGER NOT NULL, 
	"key" VARCHAR(60) NOT NULL, 
	label VARCHAR(120) NOT NULL, 
	field_type VARCHAR(20) NOT NULL, 
	options JSON, 
	is_required BOOLEAN NOT NULL, 
	sort_order INTEGER NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_company_field_key UNIQUE (company_id, "key"), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);

CREATE TABLE users (
	id INTEGER NOT NULL, 
	company_id INTEGER, 
	full_name VARCHAR(200) NOT NULL, 
	email VARCHAR(200) NOT NULL, 
	phone VARCHAR(40), 
	role VARCHAR(30) NOT NULL, 
	password_hash VARCHAR(255), 
	is_active BOOLEAN NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_users_email UNIQUE (email), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);

CREATE INDEX ix_api_keys_company ON api_keys (company_id);

CREATE INDEX ix_api_keys_hash ON api_keys (key_hash);

CREATE INDEX ix_cc_company ON customer_companies (company_id);

CREATE INDEX ix_cc_customer ON customer_companies (customer_id);

CREATE INDEX ix_cfv_membership ON customer_field_values (membership_id);

CREATE INDEX ix_customers_email ON customers (email);

CREATE INDEX ix_customers_national_id ON customers (national_id);

CREATE INDEX ix_fd_company ON field_definitions (company_id);

CREATE INDEX ix_users_company ON users (company_id);
