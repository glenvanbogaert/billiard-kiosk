CREATE TABLE payment_statuses (
    code TEXT PRIMARY KEY,
    description_nl TEXT NOT NULL,
    is_terminal BOOLEAN NOT NULL,
    is_successful BOOLEAN NOT NULL
);

CREATE TABLE vat_rates (
    rate NUMERIC(4,2) PRIMARY KEY,
    description_nl TEXT NOT NULL
);

CREATE TABLE drink_categories (
    id BIGSERIAL PRIMARY KEY,
    name_nl TEXT UNIQUE NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE members (
    id BIGSERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT,
    date_of_birth DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked','anonymized')),
    is_blocked_for_topup BOOLEAN NOT NULL DEFAULT false,
    preferred_topup_method TEXT NOT NULL DEFAULT 'epc_qr' CHECK (preferred_topup_method IN ('epc_qr','email_invoice')),
    email_receipts_enabled BOOLEAN NOT NULL DEFAULT false,
    email_marketing_enabled BOOLEAN NOT NULL DEFAULT false,
    gdpr_consent_at TIMESTAMPTZ NOT NULL,
    gdpr_consent_version TEXT NOT NULL,
    cached_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    anonymized_at TIMESTAMPTZ,
    is_test BOOLEAN NOT NULL DEFAULT false,
    CHECK (
        date_of_birth <= (CURRENT_DATE - INTERVAL '18 years')
    )
);

CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_members_email ON members(email) WHERE email IS NOT NULL;

CREATE TABLE member_cards (
    id BIGSERIAL PRIMARY KEY,
    member_id BIGINT NOT NULL REFERENCES members(id),
    card_identifier TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','lost','blocked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deactivated_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_member_cards_active_identifier ON member_cards(card_identifier) WHERE status = 'active';
CREATE INDEX idx_member_cards_member ON member_cards(member_id);

CREATE TABLE drinks (
    id BIGSERIAL PRIMARY KEY,
    name_nl TEXT NOT NULL,
    description_nl TEXT,
    category_id BIGINT NOT NULL REFERENCES drink_categories(id),
    image_path TEXT NOT NULL,
    purchase_price_excl_vat NUMERIC(10,2) NOT NULL CHECK (purchase_price_excl_vat >= 0),
    sale_price_incl_vat NUMERIC(10,2) NOT NULL CHECK (sale_price_incl_vat >= 0),
    vat_rate NUMERIC(4,2) NOT NULL REFERENCES vat_rates(rate),
    stock INT NOT NULL DEFAULT 0,
    low_stock_threshold INT NOT NULL DEFAULT 10,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_drinks_category ON drinks(category_id) WHERE is_active;

CREATE TABLE drink_barcodes (
    id BIGSERIAL PRIMARY KEY,
    drink_id BIGINT NOT NULL REFERENCES drinks(id) ON DELETE CASCADE,
    barcode TEXT NOT NULL UNIQUE,
    barcode_type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_drink_barcodes_barcode ON drink_barcodes(barcode);

CREATE TABLE sales (
    id BIGSERIAL PRIMARY KEY,
    member_id BIGINT NOT NULL REFERENCES members(id),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('member_card','epc_qr','cash')),
    payment_status TEXT NOT NULL REFERENCES payment_statuses(code),
    structured_communication TEXT,
    total_excl_vat NUMERIC(10,2) NOT NULL,
    total_vat NUMERIC(10,2) NOT NULL,
    total_incl_vat NUMERIC(10,2) NOT NULL,
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    abandoned_at TIMESTAMPTZ,
    notes TEXT,
    is_test BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_sales_member ON sales(member_id, initiated_at DESC);
CREATE INDEX idx_sales_status ON sales(payment_status);
CREATE INDEX idx_sales_completed_at ON sales(completed_at) WHERE completed_at IS NOT NULL;
CREATE UNIQUE INDEX idx_sales_struct_comm ON sales(structured_communication) WHERE structured_communication IS NOT NULL;

CREATE TABLE stock_transactions (
    id BIGSERIAL PRIMARY KEY,
    drink_id BIGINT NOT NULL REFERENCES drinks(id),
    delta INT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('sale','restock','correction','write_off')),
    reason TEXT,
    related_sale_id BIGINT,
    admin_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_txn_drink ON stock_transactions(drink_id, created_at DESC);

CREATE TABLE sale_lines (
    id BIGSERIAL PRIMARY KEY,
    sale_id BIGINT NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
    drink_id BIGINT NOT NULL REFERENCES drinks(id),
    drink_name_snapshot TEXT NOT NULL,
    unit_price_excl_vat_snapshot NUMERIC(10,2) NOT NULL,
    vat_rate_snapshot NUMERIC(4,2) NOT NULL,
    unit_price_incl_vat_snapshot NUMERIC(10,2) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    line_total_excl_vat NUMERIC(10,2) NOT NULL,
    line_total_vat NUMERIC(10,2) NOT NULL,
    line_total_incl_vat NUMERIC(10,2) NOT NULL
);

CREATE INDEX idx_sale_lines_sale ON sale_lines(sale_id);
CREATE INDEX idx_sale_lines_drink ON sale_lines(drink_id);

ALTER TABLE stock_transactions ADD CONSTRAINT fk_stock_txn_sale FOREIGN KEY (related_sale_id) REFERENCES sales(id);

CREATE TABLE top_ups (
    id BIGSERIAL PRIMARY KEY,
    member_id BIGINT NOT NULL REFERENCES members(id),
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    method TEXT NOT NULL CHECK (method IN ('epc_qr','email_invoice','manual_cash_admin')),
    status TEXT NOT NULL REFERENCES payment_statuses(code),
    structured_communication TEXT,
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    reminder_count INT NOT NULL DEFAULT 0,
    last_reminder_at TIMESTAMPTZ,
    initiated_by_admin_id BIGINT,
    resolution_reason TEXT,
    resolution_note TEXT,
    notes TEXT,
    is_test BOOLEAN NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX idx_topups_struct_comm ON top_ups(structured_communication) WHERE structured_communication IS NOT NULL;
CREATE INDEX idx_topups_member ON top_ups(member_id, initiated_at DESC);
CREATE INDEX idx_topups_status ON top_ups(status);
CREATE INDEX idx_topups_expires ON top_ups(expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE balance_transactions (
    id BIGSERIAL PRIMARY KEY,
    member_id BIGINT NOT NULL REFERENCES members(id),
    delta NUMERIC(10,2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('topup_paid','sale_debit','adjustment','write_off','opening_balance')),
    related_sale_id BIGINT REFERENCES sales(id),
    related_topup_id BIGINT REFERENCES top_ups(id),
    admin_id BIGINT,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_test BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_balance_txn_member ON balance_transactions(member_id, created_at DESC);

CREATE OR REPLACE FUNCTION recompute_member_balance() RETURNS TRIGGER AS $$
BEGIN
    UPDATE members
    SET cached_balance = (
        SELECT COALESCE(SUM(delta), 0) FROM balance_transactions WHERE member_id = NEW.member_id
    ),
    updated_at = now()
    WHERE id = NEW.member_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_balance_txn_recompute
    AFTER INSERT ON balance_transactions
    FOR EACH ROW EXECUTE FUNCTION recompute_member_balance();

CREATE TABLE admins (
    id BIGSERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    mfa_secret TEXT,
    mfa_enabled BOOLEAN NOT NULL DEFAULT false,
    receive_weekly_report BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    failed_login_count INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deactivated_at TIMESTAMPTZ
);

ALTER TABLE balance_transactions ADD CONSTRAINT fk_balance_admin FOREIGN KEY (admin_id) REFERENCES admins(id);
ALTER TABLE stock_transactions ADD CONSTRAINT fk_stock_admin FOREIGN KEY (admin_id) REFERENCES admins(id);
ALTER TABLE top_ups ADD CONSTRAINT fk_topup_admin FOREIGN KEY (initiated_by_admin_id) REFERENCES admins(id);

CREATE TABLE admin_sessions (
    id TEXT PRIMARY KEY,
    admin_id BIGINT NOT NULL REFERENCES admins(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    ip TEXT,
    user_agent TEXT,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_admin_sessions_admin ON admin_sessions(admin_id);

CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    admin_id BIGINT REFERENCES admins(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    before_json JSONB,
    after_json JSONB,
    metadata_json JSONB,
    ip TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_admin ON audit_log(admin_id, created_at DESC);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description_nl TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by_admin_id BIGINT REFERENCES admins(id)
);

CREATE TABLE coda_imports (
    id BIGSERIAL PRIMARY KEY,
    file_name TEXT NOT NULL,
    file_sha256 TEXT NOT NULL UNIQUE,
    imported_by_admin_id BIGINT NOT NULL REFERENCES admins(id),
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    statement_period_start DATE,
    statement_period_end DATE,
    transaction_count INT NOT NULL,
    matched_count INT NOT NULL DEFAULT 0,
    unmatched_count INT NOT NULL DEFAULT 0
);

CREATE TABLE coda_transactions (
    id BIGSERIAL PRIMARY KEY,
    coda_import_id BIGINT NOT NULL REFERENCES coda_imports(id),
    bank_reference TEXT NOT NULL,
    booking_date DATE NOT NULL,
    value_date DATE,
    amount NUMERIC(10,2) NOT NULL,
    counterparty_name TEXT,
    counterparty_iban TEXT,
    structured_communication TEXT,
    free_text_communication TEXT,
    matched_sale_id BIGINT REFERENCES sales(id),
    matched_topup_id BIGINT REFERENCES top_ups(id),
    match_status TEXT NOT NULL DEFAULT 'unmatched'
        CHECK (match_status IN ('unmatched','matched_auto','matched_manual','ignored','duplicate_already_paid')),
    matched_by_admin_id BIGINT REFERENCES admins(id),
    matched_at TIMESTAMPTZ,
    raw_record_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_coda_txn_struct_comm ON coda_transactions(structured_communication) WHERE structured_communication IS NOT NULL;
CREATE INDEX idx_coda_txn_status ON coda_transactions(match_status);
CREATE UNIQUE INDEX idx_coda_txn_unique ON coda_transactions(coda_import_id, bank_reference);

CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    channel TEXT NOT NULL,
    recipient TEXT NOT NULL,
    subject TEXT,
    body TEXT NOT NULL,
    category TEXT NOT NULL,
    related_entity_type TEXT,
    related_entity_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
    attempts INT NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ
);

CREATE INDEX idx_notifications_pending ON notifications(status, created_at) WHERE status = 'pending';
CREATE INDEX idx_notifications_dedup ON notifications(category, related_entity_type, related_entity_id, created_at);
