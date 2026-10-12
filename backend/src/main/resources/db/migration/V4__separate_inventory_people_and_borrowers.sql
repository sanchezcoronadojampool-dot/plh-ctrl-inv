CREATE TABLE inventory_people (
    id BIGSERIAL PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    job_title VARCHAR(80) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO inventory_people (full_name, job_title, active)
SELECT DISTINCT ON (lower(full_name), lower(COALESCE(NULLIF(job_title, ''), 'Empleado')))
       full_name, COALESCE(NULLIF(job_title, ''), 'Empleado'), enabled
FROM users
WHERE role IN ('ADMIN', 'INVENTORY_MANAGER')
ORDER BY lower(full_name), lower(COALESCE(NULLIF(job_title, ''), 'Empleado')), id;

CREATE INDEX idx_inventory_people_active_name
    ON inventory_people (active, lower(full_name));

ALTER TABLE loans ADD COLUMN borrower_name VARCHAR(120);
ALTER TABLE loans ADD COLUMN borrower_type VARCHAR(20) NOT NULL DEFAULT 'EMPLOYEE';
ALTER TABLE loans ALTER COLUMN borrower_id DROP NOT NULL;

UPDATE loans SET borrower_name = users.full_name
FROM users WHERE loans.borrower_id = users.id;

ALTER TABLE loans ALTER COLUMN borrower_name SET NOT NULL;

ALTER TABLE movements ADD COLUMN recipient_name VARCHAR(120);
UPDATE movements SET recipient_name = users.full_name
FROM users WHERE movements.received_by_id = users.id;

ALTER TABLE inventory_assets ADD COLUMN responsible_name VARCHAR(120);
UPDATE inventory_assets SET responsible_name = users.full_name
FROM users WHERE inventory_assets.responsible_user_id = users.id;
