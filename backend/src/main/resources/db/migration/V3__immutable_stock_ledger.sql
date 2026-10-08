CREATE TABLE inventory_stock_ledger (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id),
    movement_id BIGINT REFERENCES movements(id),
    actor_id BIGINT REFERENCES users(id),
    event_type VARCHAR(30) NOT NULL,
    quantity_delta NUMERIC(14, 3) NOT NULL,
    balance_after NUMERIC(14, 3) NOT NULL,
    reason VARCHAR(300) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uq_stock_ledger_movement ON inventory_stock_ledger(movement_id) WHERE movement_id IS NOT NULL;
CREATE INDEX idx_stock_ledger_product_date ON inventory_stock_ledger(product_id, created_at DESC, id DESC);

INSERT INTO inventory_stock_ledger(product_id, event_type, quantity_delta, balance_after, reason)
SELECT id, 'LEGACY_OPENING', stock, stock, 'Saldo de apertura migrado; historial previo no disponible'
FROM products;

CREATE FUNCTION prevent_stock_ledger_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'inventory_stock_ledger is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_ledger_immutable
BEFORE UPDATE OR DELETE ON inventory_stock_ledger
FOR EACH ROW EXECUTE FUNCTION prevent_stock_ledger_mutation();
