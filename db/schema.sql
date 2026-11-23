CREATE TABLE IF NOT EXISTS users (
 id BIGSERIAL PRIMARY KEY, name VARCHAR(120) NOT NULL, email VARCHAR(180) NOT NULL UNIQUE,
 password_hash TEXT NOT NULL, role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK(role IN ('customer','admin')),
 active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS enquiries (
 id BIGSERIAL PRIMARY KEY, name VARCHAR(120) NOT NULL, email VARCHAR(180) NOT NULL,
 topic VARCHAR(120) NOT NULL, message TEXT NOT NULL, source VARCHAR(80) NOT NULL DEFAULT 'website',
 status VARCHAR(30) NOT NULL DEFAULT 'new', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS enquiry_replies (
 id BIGSERIAL PRIMARY KEY, enquiry_id BIGINT NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
 admin_id BIGINT NOT NULL REFERENCES users(id), body TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tickets (
 id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id), subject VARCHAR(180) NOT NULL,
 category VARCHAR(80) NOT NULL DEFAULT 'General', status VARCHAR(30) NOT NULL DEFAULT 'open',
 priority VARCHAR(20) NOT NULL DEFAULT 'normal', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ticket_messages (
 id BIGSERIAL PRIMARY KEY, ticket_id BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
 sender_id BIGINT NOT NULL REFERENCES users(id), body TEXT NOT NULL, is_internal BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS shipments (
 id BIGSERIAL PRIMARY KEY, customer_id BIGINT REFERENCES users(id), tracking_number VARCHAR(100) NOT NULL UNIQUE,
 carrier VARCHAR(80) NOT NULL, status VARCHAR(60) NOT NULL DEFAULT 'registered', origin VARCHAR(120),
 destination VARCHAR(120), estimated_delivery DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS documents (
 id BIGSERIAL PRIMARY KEY, type VARCHAR(20) NOT NULL CHECK(type IN ('invoice','receipt')), number VARCHAR(80) NOT NULL UNIQUE,
 customer_id BIGINT REFERENCES users(id), customer_name VARCHAR(150) NOT NULL, customer_email VARCHAR(180),
 currency VARCHAR(5) NOT NULL DEFAULT 'USD', items JSONB NOT NULL, total NUMERIC(14,2) NOT NULL,
 notes TEXT, created_by BIGINT NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_logs (
 id BIGSERIAL PRIMARY KEY, actor_id BIGINT REFERENCES users(id), action VARCHAR(100) NOT NULL,
 entity_type VARCHAR(80), entity_id BIGINT, ip_address INET, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS enquiries_status_created_idx ON enquiries(status,created_at DESC);
CREATE INDEX IF NOT EXISTS tickets_user_updated_idx ON tickets(user_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS messages_ticket_created_idx ON ticket_messages(ticket_id,created_at);
CREATE INDEX IF NOT EXISTS shipments_customer_idx ON shipments(customer_id,created_at DESC);
CREATE INDEX IF NOT EXISTS audit_actor_created_idx ON audit_logs(actor_id,created_at DESC);
