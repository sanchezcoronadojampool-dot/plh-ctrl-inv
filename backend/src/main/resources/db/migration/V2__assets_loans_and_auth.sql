ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title VARCHAR(80);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE users SET job_title = CASE
    WHEN lower(role) LIKE '%admin%' THEN 'Administración'
    WHEN lower(role) LIKE '%encargado%' THEN 'Encargado de almacén'
    WHEN lower(role) LIKE '%residente%' THEN 'Residente'
    ELSE 'Personal'
END
WHERE job_title IS NULL;

UPDATE users SET email = 'legacy-user-' || id || '@invalid.local'
WHERE email IS NULL OR btrim(email) = '';

WITH duplicate_emails AS (
    SELECT id, row_number() OVER (PARTITION BY lower(email) ORDER BY id) AS duplicate_number
    FROM users
)
UPDATE users u SET email = 'legacy-user-' || u.id || '@invalid.local'
FROM duplicate_emails d
WHERE u.id = d.id AND d.duplicate_number > 1;

UPDATE users SET role = CASE
    WHEN upper(role) IN ('ADMIN', 'INVENTORY_MANAGER', 'VIEWER') THEN upper(role)
    WHEN lower(role) LIKE '%admin%' THEN 'ADMIN'
    WHEN lower(role) LIKE '%encargado%' THEN 'INVENTORY_MANAGER'
    ELSE 'VIEWER'
END;
ALTER TABLE users ALTER COLUMN job_title SET NOT NULL;
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'VIEWER';
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower ON users (lower(email));

ALTER TABLE products ALTER COLUMN stock TYPE NUMERIC(14, 3) USING stock::NUMERIC(14, 3);
ALTER TABLE products ALTER COLUMN minimum_stock TYPE NUMERIC(14, 3) USING minimum_stock::NUMERIC(14, 3);
ALTER TABLE products ADD COLUMN IF NOT EXISTS tracking_type VARCHAR(30) DEFAULT 'CONSUMABLE';
UPDATE products SET tracking_type = 'CONSUMABLE' WHERE tracking_type IS NULL;

CREATE TABLE IF NOT EXISTS storage_areas (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(300),
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS inventory_assets (
    id BIGSERIAL PRIMARY KEY,
    qr_token VARCHAR(36) NOT NULL UNIQUE,
    product_id BIGINT NOT NULL REFERENCES products(id),
    asset_code VARCHAR(100) NOT NULL UNIQUE,
    serial_number VARCHAR(120),
    area_id BIGINT REFERENCES storage_areas(id),
    responsible_user_id BIGINT REFERENCES users(id),
    condition VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL
);

CREATE TABLE IF NOT EXISTS loans (
    id BIGSERIAL PRIMARY KEY,
    loan_number VARCHAR(32) NOT NULL UNIQUE,
    borrower_id BIGINT NOT NULL REFERENCES users(id),
    issued_by_id BIGINT NOT NULL REFERENCES users(id),
    area_id BIGINT NOT NULL REFERENCES storage_areas(id),
    purpose VARCHAR(300) NOT NULL,
    issued_at DATE NOT NULL,
    due_at DATE,
    closed_at DATE,
    status VARCHAR(30) NOT NULL
);

CREATE TABLE IF NOT EXISTS loan_lines (
    id BIGSERIAL PRIMARY KEY,
    loan_id BIGINT NOT NULL REFERENCES loans(id),
    product_id BIGINT NOT NULL REFERENCES products(id),
    quantity NUMERIC(14, 3) NOT NULL,
    returned_quantity NUMERIC(14, 3) NOT NULL DEFAULT 0,
    condition_out VARCHAR(30) NOT NULL
);

CREATE TABLE IF NOT EXISTS loan_assets (
    id BIGSERIAL PRIMARY KEY,
    loan_line_id BIGINT NOT NULL REFERENCES loan_lines(id),
    asset_id BIGINT NOT NULL REFERENCES inventory_assets(id),
    condition_out VARCHAR(30) NOT NULL,
    condition_in VARCHAR(30),
    returned_at DATE,
    CONSTRAINT uq_loan_asset_line UNIQUE (loan_line_id, asset_id)
);

ALTER TABLE movements ALTER COLUMN quantity TYPE NUMERIC(14, 3) USING quantity::NUMERIC(14, 3);
ALTER TABLE movements ADD COLUMN IF NOT EXISTS received_by_id BIGINT REFERENCES users(id);
ALTER TABLE movements ADD COLUMN IF NOT EXISTS area_id BIGINT REFERENCES storage_areas(id);
ALTER TABLE movements ADD COLUMN IF NOT EXISTS asset_id BIGINT REFERENCES inventory_assets(id);
ALTER TABLE movements ADD COLUMN IF NOT EXISTS loan_id BIGINT REFERENCES loans(id);
ALTER TABLE movements ADD COLUMN IF NOT EXISTS purpose VARCHAR(30);
ALTER TABLE movements ADD COLUMN IF NOT EXISTS vehicle_equipment VARCHAR(120);
ALTER TABLE movements ADD COLUMN IF NOT EXISTS condition_before VARCHAR(30);
ALTER TABLE movements ADD COLUMN IF NOT EXISTS condition_after VARCHAR(30);

CREATE INDEX IF NOT EXISTS idx_assets_product_status ON inventory_assets(product_id, status);
CREATE INDEX IF NOT EXISTS idx_assets_area ON inventory_assets(area_id);
CREATE INDEX IF NOT EXISTS idx_loans_borrower_status ON loans(borrower_id, status);
CREATE INDEX IF NOT EXISTS idx_loan_lines_loan ON loan_lines(loan_id);
CREATE INDEX IF NOT EXISTS idx_movements_asset_date ON movements(asset_id, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_movements_product_date ON movements(product_id, movement_date DESC);
