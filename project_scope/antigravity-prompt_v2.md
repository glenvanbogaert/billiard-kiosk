# Antigravity Build Prompt — Billiard Club Self-Service Kiosk System

> **How to use this prompt:** paste the entirety of this document into Antigravity as the project specification. The document is structured top-down: the system overview and non-negotiable principles come first, followed by tech stack, full database schema, app specifications, infrastructure, and acceptance criteria. Every section is intended to be implemented; nothing here is optional unless explicitly marked so.

---

## 1. Project overview

Build a **self-service drink ordering and member-balance system** for a small Belgian billiard club (a VZW/KMO). The club runs unstaffed on a trust basis. Members scan a club-issued QR identity card, select drinks from fridges, register them on a touchscreen kiosk, and pay via member balance, EPC bank-transfer QR, or cash.

The system has a **two-device architecture**:

- A **Raspberry Pi 5 (8GB)** with SSD storage hosts all backend services in Docker Compose containers (database, kiosk web app, admin web app, worker, observability stack). The Pi is **headless** — no monitor required during runtime.
- An **existing Windows PC** drives the **20" wall-mounted touchscreen** and a **USB barcode scanner**. The PC runs Microsoft Edge in built-in **Kiosk Mode**, fullscreen, pointed at the Pi's kiosk URL over the local network. The PC also continues to serve its existing function for STid Mobile ID door access management; this is unaffected.

The PC and Pi communicate over the local network (preferably wired ethernet). The Pi is reachable as `billiard-kiosk.local` via mDNS.

The system has **two web apps and one shared backend database**:

- **Kiosk app** — Dutch UI, served from the Pi, displayed by Edge Kiosk Mode on the PC's touchscreen. Used by members.
- **Admin app** — Dutch UI, served from the Pi, accessed by managers via Tailscale.
- **PostgreSQL database** — single source of truth, shared by both apps.

Plus a **worker container** for background jobs (cron, email, ntfy.sh, backups, reconciliation).

Plus a **monitoring stack** (Prometheus, Loki, Promtail, Grafana, Uptime Kuma, exporters) for observability and alerting.

All container orchestration is **Docker Compose** on the Pi.

### 1.1 Non-negotiable principles

1. **Self-recovery first.** Every container must restart on failure. The Pi must auto-recover from kernel hangs via the hardware watchdog. Edge Kiosk Mode auto-relaunches on browser crash. Backups run nightly to off-device cloud storage and are automatically verified. The system must survive 12 months without on-site intervention.
2. **Trust system, not honor system.** Every drink purchase, every balance change, every top-up, every admin action is recorded with a tamper-evident audit trail. The financial state is a ledger, never a mutable counter.
3. **Elderly-accessible UX.** Large fonts, large tap targets, AAA contrast, no hover interactions, no virtual keyboard in the user flow, idle reset, clear feedback on every action. Layout optimized for a wall-mounted 20" touchscreen at typical 60–80 cm viewing distance.
4. **GDPR + Belgian VAT compliant by design.** Personal data export and deletion endpoints. VAT data snapshotted per sale line. Seven-year transaction retention. Privacy notice surfaced at enrollment.
5. **Dutch UI throughout.** Both apps. All emails, all error messages, all admin labels.
6. **Admin internal-only initially**, with zero code changes required to expose publicly via Cloudflare Tunnel later. Auth must be built to public-facing standards from day one (MFA, session security, rate limiting, CSRF).
7. **No paid third-party integrations.** Use EPC QR (free, manual reconciliation via CODA) for payments. No Payconiq, no PSD2 API, no Power BI.
8. **Heavily AI-readable code.** Idiomatic SvelteKit, minimal cleverness, well-named files, exhaustive comments on non-obvious logic.

### 1.2 Network resilience

Because the kiosk app on the PC reaches the backend over the LAN, network reliability is a real concern (it would not have been if both ran on the same machine).

- **Wired ethernet between Pi and PC is strongly preferred.** Both devices are stationary; cable cost is negligible; eliminates WiFi flakiness as a failure mode entirely.
- WiFi remains an acceptable fallback if cabling is impossible. Router placement matters: line-of-sight, 5GHz preferred, dedicated SSID for the club's IoT/kiosk if practical.
- The kiosk app implements a Service Worker that:
  - Caches the static app shell so the UI itself loads even if the network blips.
  - Detects backend connectivity loss and shows a clear "Geen verbinding — probeer opnieuw" banner.
  - Persists the cart in `localStorage` so a connectivity blip mid-purchase does not erase a member's selections.
  - Auto-recovers and dismisses the banner once backend reachability is restored.

---

## 2. Tech stack — exact versions

Pin these. Do not substitute.

- **Pi host OS:** Ubuntu Server 24.04 LTS (ARM64) on Raspberry Pi 5 (8GB RAM), booted from SSD.
- **PC host OS:** Windows 10 Pro 22H2 or Windows 11 Pro (must support Microsoft Edge Kiosk Mode + Assigned Access).
- **Container runtime:** Docker Engine 27.x, Docker Compose v2 on the Pi.
- **Database:** PostgreSQL 16 (official `postgres:16` image, ARM64-compatible).
- **App framework:** SvelteKit (latest stable as of build time, must be Svelte 5 with **runes syntax** — `$state`, `$derived`, `$effect`, `$props`). Do not mix Svelte 4 reactive `$:` syntax with runes. State both versions explicitly in package.json.
- **CSS framework:** Pico CSS v2 with the **indigo** color scheme, customized for AAA contrast and large-touch sizing per section 6.1.
- **Node runtime:** Node.js 22 LTS (`node:22-alpine` images).
- **Reverse proxy:** Caddy 2 (auto-HTTPS via local CA for non-localhost hostnames; plain HTTP on the kiosk hostname for the LAN client).
- **Service discovery on LAN:** `avahi-daemon` (mDNS) on the Pi. Pi's hostname `billiard-kiosk` resolves as `billiard-kiosk.local` from Windows clients (Windows 10+ supports mDNS natively).
- **VPN access:** Tailscale (installed on host, not containerized).
- **Cloudflare Tunnel:** `cloudflare/cloudflared` container, present in compose file but with `profiles: ["public"]` so it does not start by default.
- **Kiosk display environment:** **Microsoft Edge** in built-in Kiosk Mode, configured via Windows Assigned Access on a dedicated Windows user account. Auto-launches at login, auto-relaunches on crash, locked to a single URL.
- **Service Worker:** Workbox-generated SW for the kiosk app (offline shell + connectivity detection).
- **Touchscreen:** 20" USB HID multi-touch, connected to PC via USB + HDMI. Standard Windows HID drivers.
- **Barcode scanner integration:** USB HID 2D scanner in keyboard-emulation mode, connected to PC. JavaScript library: `onscan.js` (latest).
- **EPC QR generation:** `bwip-js` for QR rendering; structured-communication generation implemented in-house with mod-97 checksum.
- **CODA parser:** implement in-house using TypeScript (the CODA subset needed is small; see section 7.5).
- **Excel export:** `exceljs` (latest).
- **Email sending:** `nodemailer` over SMTP. SMTP provider: Brevo or MailerSend (free tiers); credentials via env.
- **ntfy.sh:** plain HTTPS POST to `https://ntfy.sh/<topic>`; topic from env.
- **Cron:** `node-cron` inside the worker container. No host cron jobs other than the watchdog.
- **Observability:** Prometheus (`prom/prometheus:latest`), Loki (`grafana/loki:latest`), Promtail (`grafana/promtail:latest`), Grafana (`grafana/grafana:latest`), node_exporter, cAdvisor, postgres_exporter, Uptime Kuma (`louislam/uptime-kuma:latest`).
- **Backups:** `pg_dump` → encrypted via `age` → uploaded to Backblaze B2 (or Hetzner Storage Box) via `rclone`. Encrypted, off-site, automated.
- **Hardware watchdog:** `bcm2835_wdt` enabled via `/etc/systemd/system.conf` with `RuntimeWatchdogSec=15`.

---

## 3. Repository structure

Single monorepo. Layout:

```
billiard-kiosk/
├── README.md
├── docker-compose.yml
├── .env.example
├── docs/
│   ├── runbook.md
│   ├── flows.md
│   ├── recovery.md
│   └── windows-kiosk-setup.md
├── apps/
│   ├── kiosk/                    # SvelteKit kiosk app (with Service Worker)
│   ├── admin/                    # SvelteKit admin app
│   └── worker/                   # Node worker (cron + jobs)
├── packages/
│   └── shared/                   # Shared TS: db client, types, utils, EPC QR, CODA parser
├── db/
│   ├── migrations/               # Numbered SQL files
│   └── seed/                     # Seed data SQL
├── infra/
│   ├── caddy/Caddyfile
│   ├── cloudflared/config.yml
│   ├── grafana/
│   │   ├── provisioning/
│   │   └── dashboards/           # Pre-built JSON dashboards
│   ├── prometheus/prometheus.yml
│   ├── promtail/promtail-config.yml
│   ├── loki/loki-config.yml
│   ├── uptime-kuma/              # Documented monitor list
│   └── windows-kiosk/            # PowerShell setup scripts + assigned-access XML
├── scripts/
│   ├── bootstrap-admin.sh        # Create first admin
│   ├── backup.sh                 # Nightly backup
│   ├── restore.sh                # Restore from backup
│   ├── enable-watchdog.sh        # Configure hardware watchdog
│   └── enable-mdns.sh            # Install + configure avahi on Pi
└── seed-images/                  # Sample drink photos for seed data
```

Use `pnpm` workspaces for the monorepo. `pnpm-workspace.yaml` includes `apps/*` and `packages/*`.

The `packages/shared` package exports: typed Postgres client (using `postgres` library, not `pg`), Zod schemas mirroring the DB, EPC QR generator, CODA parser, structured-communication mod-97 helper, ntfy/email wrappers, audit-log helper.

---

## 4. Database schema

PostgreSQL 16. All timestamps `TIMESTAMPTZ`. All money columns `NUMERIC(10,2)` (never floats). All IDs `BIGSERIAL` unless otherwise noted. Migrations are numbered SQL files in `db/migrations/`, applied in order.

### 4.1 Reference / lookup tables

```sql
CREATE TABLE payment_statuses (
    code TEXT PRIMARY KEY,                 -- e.g. 'pending_payment_unverified'
    description_nl TEXT NOT NULL,
    is_terminal BOOLEAN NOT NULL,          -- true if no further transitions
    is_successful BOOLEAN NOT NULL         -- true if money was collected
);

-- Seed values:
-- pending_payment_unverified | "Wacht op betalingsbevestiging"     | false | false
-- paid_member_card           | "Betaald via lidkaart"              | true  | true
-- paid_cash                  | "Betaald in contanten"              | true  | true
-- paid_epc_verified          | "Betaald via overschrijving (CODA)" | true  | true
-- paid_manual_admin          | "Handmatig gemarkeerd als betaald"  | true  | true
-- abandoned                  | "Geannuleerd door gebruiker"        | true  | false
-- expired                    | "Vervallen na 14 dagen"             | true  | false
-- failed                     | "Mislukt"                           | true  | false

CREATE TABLE vat_rates (
    rate NUMERIC(4,2) PRIMARY KEY,         -- e.g. 0.06, 0.21
    description_nl TEXT NOT NULL
);
-- Seed: 0.06, 0.12, 0.21, 0.00 with Dutch descriptions.

CREATE TABLE drink_categories (
    id BIGSERIAL PRIMARY KEY,
    name_nl TEXT UNIQUE NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true
);
-- Seed: 'Frisdranken', 'Warme dranken', 'Bieren', 'Sterke dranken', 'Snacks'.
```

### 4.2 Members & cards

```sql
CREATE TABLE members (
    id BIGSERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT,                            -- nullable; not all members provide one
    date_of_birth DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'  -- 'active' | 'blocked' | 'anonymized'
        CHECK (status IN ('active','blocked','anonymized')),
    is_blocked_for_topup BOOLEAN NOT NULL DEFAULT false,
    preferred_topup_method TEXT NOT NULL DEFAULT 'epc_qr'
        CHECK (preferred_topup_method IN ('epc_qr','email_invoice')),
    email_receipts_enabled BOOLEAN NOT NULL DEFAULT false,
    email_marketing_enabled BOOLEAN NOT NULL DEFAULT false,
    gdpr_consent_at TIMESTAMPTZ NOT NULL,
    gdpr_consent_version TEXT NOT NULL,    -- so we can re-prompt on policy changes
    cached_balance NUMERIC(10,2) NOT NULL DEFAULT 0,  -- denormalized; recomputed on every txn
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    anonymized_at TIMESTAMPTZ,
    CHECK (
        date_of_birth <= (CURRENT_DATE - INTERVAL '18 years')
    )
);

CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_members_email ON members(email) WHERE email IS NOT NULL;

CREATE TABLE member_cards (
    id BIGSERIAL PRIMARY KEY,
    member_id BIGINT NOT NULL REFERENCES members(id),
    card_identifier TEXT NOT NULL,         -- raw STid QR contents
    status TEXT NOT NULL DEFAULT 'active'  -- 'active' | 'lost' | 'blocked'
        CHECK (status IN ('active','lost','blocked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deactivated_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_member_cards_active_identifier
    ON member_cards(card_identifier) WHERE status = 'active';
CREATE INDEX idx_member_cards_member ON member_cards(member_id);
```

### 4.3 Drinks & barcodes

```sql
CREATE TABLE drinks (
    id BIGSERIAL PRIMARY KEY,
    name_nl TEXT NOT NULL,
    description_nl TEXT,
    category_id BIGINT NOT NULL REFERENCES drink_categories(id),
    image_path TEXT NOT NULL,              -- relative to /var/lib/billiard/images
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
    barcode_type TEXT NOT NULL,            -- 'EAN13' | 'EAN8' | 'UPC' | 'CODE128'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_drink_barcodes_barcode ON drink_barcodes(barcode);

CREATE TABLE stock_transactions (
    id BIGSERIAL PRIMARY KEY,
    drink_id BIGINT NOT NULL REFERENCES drinks(id),
    delta INT NOT NULL,                    -- positive for additions, negative for sales/write-offs
    type TEXT NOT NULL                     -- 'sale' | 'restock' | 'correction' | 'write_off'
        CHECK (type IN ('sale','restock','correction','write_off')),
    reason TEXT,
    related_sale_id BIGINT,                -- nullable, FK added below after sales table
    admin_id BIGINT,                       -- nullable, FK added below
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_txn_drink ON stock_transactions(drink_id, created_at DESC);
```

### 4.4 Sales & sale lines

```sql
CREATE TABLE sales (
    id BIGSERIAL PRIMARY KEY,
    member_id BIGINT NOT NULL REFERENCES members(id),
    payment_method TEXT NOT NULL           -- 'member_card' | 'epc_qr' | 'cash'
        CHECK (payment_method IN ('member_card','epc_qr','cash')),
    payment_status TEXT NOT NULL REFERENCES payment_statuses(code),
    structured_communication TEXT,         -- nullable; only for EPC QR sales
    total_excl_vat NUMERIC(10,2) NOT NULL,
    total_vat NUMERIC(10,2) NOT NULL,
    total_incl_vat NUMERIC(10,2) NOT NULL,
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,              -- when payment_status reached terminal+successful
    abandoned_at TIMESTAMPTZ,
    notes TEXT
);

CREATE INDEX idx_sales_member ON sales(member_id, initiated_at DESC);
CREATE INDEX idx_sales_status ON sales(payment_status);
CREATE INDEX idx_sales_completed_at ON sales(completed_at) WHERE completed_at IS NOT NULL;
CREATE UNIQUE INDEX idx_sales_struct_comm ON sales(structured_communication)
    WHERE structured_communication IS NOT NULL;

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

ALTER TABLE stock_transactions
    ADD CONSTRAINT fk_stock_txn_sale
    FOREIGN KEY (related_sale_id) REFERENCES sales(id);
```

### 4.5 Top-ups & balance ledger

```sql
CREATE TABLE top_ups (
    id BIGSERIAL PRIMARY KEY,
    member_id BIGINT NOT NULL REFERENCES members(id),
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    method TEXT NOT NULL                   -- 'epc_qr' | 'email_invoice' | 'manual_cash_admin'
        CHECK (method IN ('epc_qr','email_invoice','manual_cash_admin')),
    status TEXT NOT NULL REFERENCES payment_statuses(code),
    structured_communication TEXT,
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,                -- only for email_invoice; +14 days
    completed_at TIMESTAMPTZ,
    reminder_count INT NOT NULL DEFAULT 0,
    last_reminder_at TIMESTAMPTZ,
    initiated_by_admin_id BIGINT,          -- nullable; for manual top-ups
    resolution_reason TEXT,                -- e.g. 'cash_handover', 'bank_verified_offline'
    resolution_note TEXT,
    notes TEXT
);

CREATE UNIQUE INDEX idx_topups_struct_comm ON top_ups(structured_communication)
    WHERE structured_communication IS NOT NULL;
CREATE INDEX idx_topups_member ON top_ups(member_id, initiated_at DESC);
CREATE INDEX idx_topups_status ON top_ups(status);
CREATE INDEX idx_topups_expires ON top_ups(expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE balance_transactions (
    id BIGSERIAL PRIMARY KEY,
    member_id BIGINT NOT NULL REFERENCES members(id),
    delta NUMERIC(10,2) NOT NULL,          -- positive = credit, negative = debit
    type TEXT NOT NULL                     -- 'topup_paid' | 'sale_debit' | 'adjustment' | 'write_off' | 'opening_balance'
        CHECK (type IN ('topup_paid','sale_debit','adjustment','write_off','opening_balance')),
    related_sale_id BIGINT REFERENCES sales(id),
    related_topup_id BIGINT REFERENCES top_ups(id),
    admin_id BIGINT,                       -- FK added below
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_balance_txn_member ON balance_transactions(member_id, created_at DESC);

-- Recompute cached_balance on every insert via trigger
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
```

### 4.6 Admins, audit log, settings

```sql
CREATE TABLE admins (
    id BIGSERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,           -- argon2id
    mfa_secret TEXT,                       -- TOTP base32; null until enrolled
    mfa_enabled BOOLEAN NOT NULL DEFAULT false,
    receive_weekly_report BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    failed_login_count INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deactivated_at TIMESTAMPTZ
);

ALTER TABLE balance_transactions
    ADD CONSTRAINT fk_balance_admin FOREIGN KEY (admin_id) REFERENCES admins(id);
ALTER TABLE stock_transactions
    ADD CONSTRAINT fk_stock_admin FOREIGN KEY (admin_id) REFERENCES admins(id);
ALTER TABLE top_ups
    ADD CONSTRAINT fk_topup_admin FOREIGN KEY (initiated_by_admin_id) REFERENCES admins(id);

CREATE TABLE admin_sessions (
    id TEXT PRIMARY KEY,                   -- random 256-bit token, hashed before storage
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
    admin_id BIGINT REFERENCES admins(id),  -- null for system actions
    action TEXT NOT NULL,                   -- e.g. 'member.create', 'topup.mark_paid'
    entity_type TEXT NOT NULL,              -- e.g. 'member', 'top_up', 'drink'
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

-- Seed:
-- 'topup_outstanding_cap_eur'           : 50
-- 'topup_email_invoice_expiry_days'     : 14
-- 'topup_reminder_days'                 : [7, 13]
-- 'topup_auto_block_threshold'          : 2  -- expired top-ups in 12 months
-- 'idle_warning_seconds'                : 60
-- 'idle_reset_seconds'                  : 100
-- 'epc_qr_payment_timeout_seconds'      : 90
-- 'low_stock_default_threshold'         : 10
-- 'low_stock_batch_window_minutes'      : 30
-- 'gdpr_consent_version'                : 'v1.0-2026-05'
-- 'club_name'                           : 'Biljartclub Wortegem'
-- 'club_iban'                           : 'BE00 0000 0000 0000'
-- 'club_bic'                            : 'GKCCBEBB'
-- 'club_beneficiary_name'               : 'Biljartclub Wortegem VZW'
-- 'club_address_lines'                  : ['Adres lijn 1', 'Adres lijn 2']
-- 'transaction_retention_years'         : 7
```

### 4.7 Reconciliation

```sql
CREATE TABLE coda_imports (
    id BIGSERIAL PRIMARY KEY,
    file_name TEXT NOT NULL,
    file_sha256 TEXT NOT NULL UNIQUE,      -- prevents double-importing same file
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

CREATE INDEX idx_coda_txn_struct_comm ON coda_transactions(structured_communication)
    WHERE structured_communication IS NOT NULL;
CREATE INDEX idx_coda_txn_status ON coda_transactions(match_status);
CREATE UNIQUE INDEX idx_coda_txn_unique ON coda_transactions(coda_import_id, bank_reference);
```

### 4.8 Notifications

```sql
CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    channel TEXT NOT NULL,                 -- 'email' | 'ntfy'
    recipient TEXT NOT NULL,               -- email address or ntfy topic
    subject TEXT,
    body TEXT NOT NULL,
    category TEXT NOT NULL,                -- 'low_stock' | 'topup_expired' | 'member_blocked' | 'weekly_report' | 'system_health' | 'reconciliation_gap'
    related_entity_type TEXT,
    related_entity_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending' -- 'pending' | 'sent' | 'failed'
        CHECK (status IN ('pending','sent','failed')),
    attempts INT NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ
);

CREATE INDEX idx_notifications_pending ON notifications(status, created_at) WHERE status = 'pending';
CREATE INDEX idx_notifications_dedup ON notifications(category, related_entity_type, related_entity_id, created_at);
```

---

## 5. Seed data

Provide migration files that seed:

- All `payment_statuses`, `vat_rates`, `drink_categories` rows.
- All `settings` defaults.
- 12 sample drinks across all categories with placeholder photos in `seed-images/` (provide simple SVG placeholders if real images aren't supplied; the admin will replace them).
- 3 sample members (different DOBs, different preferred top-up methods, different opening balances).
- Sample barcodes per drink (use real-world EAN13 patterns; document them as fictional in comments).
- 1 bootstrap admin via `scripts/bootstrap-admin.sh` — interactive script that prompts for email + password + name and creates the row with argon2id-hashed password and `mfa_enabled = false`. The script must refuse to run if any admin already exists (idempotency / safety).

---

## 6. Kiosk app — full specification

### 6.1 Visual design baseline

The kiosk runs on a **wall-mounted 20" touchscreen** at viewing distances of 60–80 cm. Layout and typography are tuned for this context, not for a handheld tablet.

CSS custom properties defined globally:

```css
:root {
    --font-size-base: 1.375rem;      /* 22px */
    --font-size-button: 1.75rem;     /* 28px */
    --font-size-drink-name: 1.625rem;
    --font-size-price: 2rem;
    --font-size-balance: 2.5rem;     /* very prominent */
    --font-size-heading: 2.25rem;
    --font-size-receipt: 3rem;
    --tap-target-min: 64px;
    --tap-spacing: 20px;
    --color-bg: #ffffff;
    --color-text: #111111;
    --color-primary: #3949ab;        /* indigo, AAA against white */
    --color-success: #1b5e20;
    --color-warning: #b26a00;
    --color-error: #b71c1c;
    --layout-cart-sidebar-width: 28%;
}
```

Global rules applied to body:

```css
body {
    font-size: var(--font-size-base);
    -webkit-user-select: none;
    user-select: none;
    overscroll-behavior: none;
    touch-action: manipulation;
    cursor: none;                    /* hide mouse cursor in kiosk */
}
button, [role="button"], a.button {
    min-height: var(--tap-target-min);
    min-width: var(--tap-target-min);
    font-size: var(--font-size-button);
    touch-action: manipulation;
}
button:hover { /* hover styles intentionally omitted */ }
button:active { transform: scale(0.97); transition: transform 80ms; }
```

Pico's indigo theme is loaded, then overridden via the variables above.

A global keystroke handler implements barcode capture (member card scans + product scans). The barcode scanner connects to the **PC** as a USB HID keyboard; Edge captures the keystrokes and the JavaScript handler routes them. Pattern: buffer keystrokes received with no focused input, treat sequences ending in Enter within 100ms intervals as a scan event. Route by content:

- If matches an active `member_cards.card_identifier` → identify member.
- If matches a `drink_barcodes.barcode` → add 1 to cart.
- Otherwise → flash an error toast: "Onbekende code".

**Ergonomics rule:** primary action buttons (cart, checkout, payment, top-up) must render in the lower 60% of the viewport. Top of screen is reserved for header (member name, balance) and category navigation, which are touched less frequently and tolerate harder reach.

The Wake Lock API is requested on app load and re-requested on visibility change. It supplements Windows Power Plan settings to prevent the screen from blanking during active sessions.

### 6.2 Routes

```
/                       → idle screen
/menu                   → drink grid + persistent cart sidebar (post-identification)
/payment                → payment method selection (modal, overlays /menu)
/payment/qr             → EPC QR display + status (modal)
/topup                  → top-up amount selection
/topup/qr               → EPC QR for top-up
/topup/email-confirm    → "email sent" confirmation
/receipt                → confirmation + auto-return
/error                  → fallback for unrecoverable errors
```

All navigation is via SvelteKit's client-side router. No full-page reloads. Payment screens render as modal overlays on `/menu` to keep the cart context visible behind them; the URL still changes for routing/deep-link recovery.

### 6.3 Service Worker

Generate a Service Worker via `@sveltejs/adapter-node` + Workbox. Responsibilities:

- **Pre-cache the app shell**: HTML, JS, CSS, drink-image thumbnails. App loads even with network blip.
- **Network-first strategy** for API calls (`/api/*`). On failure, return a structured error so the UI can show "Geen verbinding" banner without breaking.
- **Connectivity probe**: every 10s while the app is open, fetch `/api/health`. Update a Svelte store; UI shows banner when probe fails twice in a row, dismisses banner when probe succeeds.
- **Cart persistence**: cart is in `localStorage`, not in SW cache. SW has no role here, but the cart survives reloads naturally.
- **No write-queueing.** Writes (sales, top-ups) require the backend to be online; we do not "queue offline sales" because that risks balance overdrafts and double-charges. The UI explicitly disables payment buttons while the connectivity banner is showing.

### 6.4 Idle screen (`/`)

Layout: centered logo and club name, a large prompt **"Scan je lidkaart om te starten"**, current time and date in the corner, club WiFi SSID for guests, version footer. No tappable elements except a small "Help" link bottom-right (shows a modal explaining how to ask for help).

When a card scan occurs, transition to `/menu` with member loaded into a Svelte store.

If the scanned card is found but blocked → modal: **"Deze kaart is geblokkeerd. Neem contact op met een beheerder."** with a 5-second auto-dismiss back to idle.

If the scanned code matches no card → toast **"Onbekende kaart"**, stay on idle.

If the connectivity banner is visible (Pi unreachable), card scans show a different message: "Het systeem is tijdelijk niet bereikbaar. Probeer over enkele seconden opnieuw."

### 6.5 Menu (`/menu`)

**Interaction model — scan-first.** Members primarily add drinks to their cart by scanning the product's barcode with the USB scanner connected to the PC. Tapping the on-screen drink grid is a fallback for items without a barcode, scanner failures, or members who prefer to browse. The layout is therefore **cart-prominent**: the cart is the focal point and feedback surface, the drink grid is secondary.

**Two-pane layout:**

**Browse pane (left, ~52% width):**

Header (sticky):
- Member name (large, e.g. "Hallo Jan")
- Current balance, prominent: **"Saldo: € 23,50"** in `--font-size-balance`
- **"Stop"** button top-right (logout, confirms then returns to idle)

Body:
- Category tabs across top (large pills): "Frisdranken", "Warme dranken", "Bieren", "Sterke dranken", "Snacks", "Alle". Default: "Alle".
- Grid of drinks: **5 columns** at 1920×1080. Each tile is compact (no description, no quantity stepper on the tile):
  - Image (fixed aspect ratio, lazy-loaded)
  - Name (single line, ellipsis on overflow)
  - Price incl VAT, prominent
  - One **"Voeg toe"** button at the bottom — tapping adds 1 to the cart. Re-tap to add more, or use the cart-side quantity stepper for adjustments.
- Out-of-stock drinks: shown but greyed out, "Niet op voorraad" overlay, untappable.
- The grid is intentionally *visible by default* (not hidden behind a button) because it doubles as a passive menu board for members deciding what to grab from the fridge.

**Cart pane (right, ~48% width, the focal point):**

This is where members spend most of their attention because every successful scan or tap renders feedback here.

- Header: "Jouw mandje" with item count.
- Recently scanned area (top of cart): the **most recently added item** is highlighted with a soft background and a 1.5 s fade-in. New scans of the same item bump the quantity with a brief tick animation rather than creating a duplicate row.
- List of cart items, each row:
  - Thumbnail
  - Name + unit price
  - Quantity stepper (− / display / +) for corrections — primary use is "scanned twice by accident, decrement to 1"
  - **Verwijder** button (red, prominent, easy to hit)
  - Line total (right-aligned, `--font-size-price`)
- Subtotal excl VAT
- VAT breakdown per rate (collapsed by default, tap-to-expand)
- **Total incl VAT**, very large (`--font-size-balance`)
- **Projected balance after payment**: "Saldo na betaling: € 19,00"
- **"Afrekenen"** primary button at the bottom of the cart, full cart-pane width, very large, lower 60% of viewport per ergonomics rule.
- **"Saldo opladen"** secondary button below it.

**Scan feedback animation:** when a barcode scan resolves to a known drink, the item "flies" from the bottom-center of the screen into the cart with a 300 ms ease-out animation, accompanied by a soft sound effect (configurable; default off because elderly users may find it startling). After landing, a bottom toast confirms: "Toegevoegd: 1× Coca-Cola" for 1.5 s.

**Tap feedback** (when adding via grid): item slides from the tapped tile into the cart with the same animation. Identical UX whether scanned or tapped — the cart is the source of truth.

**Unknown scan:** if the scan doesn't match a known card or product, a clear error toast appears: "Onbekende code — probeer opnieuw of vraag een beheerder." Cart is unaffected.

**Idle behavior:**
- After 60 s of no scan or tap → modal "Ben je er nog?" with 40 s countdown, "Ja, ik ben er nog" button. Tap dismisses; no tap → reset cart, return to idle.

Cart is persisted to `localStorage` per member to survive accidental refresh. Cleared on successful checkout, idle reset, or logout.

**Drink description.** The kiosk does not display `drinks.description_nl` anywhere in the user flow. The field remains in the database for admin reference, future channels, and potential menu board use.

### 6.6 Payment (`/payment`)

Renders as a modal overlay over `/menu`. Three large stacked buttons. Each shows an icon + label + sub-label:

1. **Lidkaart** — "Saldo: €23,50 → na betaling: €19,00"
   - Disabled if balance insufficient. Disabled state shows "Saldo onvoldoende — laad eerst op" and tap routes to `/topup`.
2. **QR-code (overschrijving)** — "Scan de QR met je bank-app"
3. **Cash** — "Betaal contant in de kassa"

Below, a small **"Annuleer"** link returns to menu. While the connectivity banner is visible, all three buttons are disabled.

#### Member-card path

On tap:
1. Begin DB transaction (server-side).
2. Re-check balance from server (avoid race conditions).
3. Insert `sales` row with `payment_method='member_card'`, `payment_status='paid_member_card'`, `completed_at=now()`.
4. Insert `sale_lines` rows (snapshotted prices, VAT computed at sale time).
5. Insert `balance_transactions` row with negative delta.
6. Insert `stock_transactions` rows (one per drink, type='sale').
7. Update `drinks.stock`.
8. Commit.
9. Navigate to `/receipt` with sale id.

If transaction fails due to insufficient balance (concurrent purchase elsewhere), show error and route to `/topup`.

#### EPC QR path (`/payment/qr`)

1. Generate structured communication (mod-97).
2. Insert `sales` row with status `pending_payment_unverified`, `structured_communication` set.
3. Insert `sale_lines`. Stock will be decremented on user confirmation.
4. Render EPC QR with: `BCD\n002\n1\nSCT\n<BIC>\n<beneficiary>\n<IBAN>\n<EUR amount>\n\n<structured comm>\n<remittance>` per the EPC standard.
5. Show on screen: large QR, amount, beneficiary, structured comm in human-readable form, instructions in Dutch.
6. Two buttons:
   - **"Ik heb betaald"** — user confirms scan complete. Decrement stock, navigate to `/receipt`. Sale stays at `pending_payment_unverified` until CODA reconciliation flips it to `paid_epc_verified`.
   - **"Annuleer"** — mark sale `abandoned`, return to cart.
7. After 90s of no action → auto-mark `abandoned`, return to idle.

#### Cash path

1. Modal confirmation: "Bevestig dat je het bedrag in de kassa hebt gelegd."
2. Two buttons: "Bevestig" / "Annuleer".
3. On bevestig: insert sale with `payment_method='cash'`, `payment_status='paid_cash'`. Decrement stock. Navigate to `/receipt`.

### 6.7 Top-up (`/topup`)

Header: same as menu. Body:

- "Hoeveel wil je opladen?" heading.
- Four large amount tiles laid out in a single row: **€10**, **€20**, **€50**, **€100**.
- After selecting amount → method selection screen:
  - Compute outstanding email-invoice top-ups for member.
  - If `outstanding_sum + selected_amount > setting('topup_outstanding_cap_eur')` → email-invoice option disabled with explanation: "Je hebt nog €X aan openstaande oplaadbeurten. Het limiet is €50."
  - If member `is_blocked_for_topup = true` → email-invoice disabled with explanation.
  - Two buttons: **"QR-code (onmiddellijk)"** and **"Per mail betalen (binnen 14 dagen)"**.
  - Preferred method preselected visually.

EPC QR top-up flow (`/topup/qr`):
- Same QR rendering pattern as sale-EPC.
- "Ik heb betaald" button → mark top-up `pending_payment_unverified` (user just confirms scan, balance updates only on CODA match). Show: "Top-up gestart. Saldo wordt zichtbaar zodra de bank de betaling verwerkt heeft."

Email-invoice flow:
- Insert `top_ups` row, `method='email_invoice'`, `expires_at = now() + 14 days`, `status='pending_payment_unverified'`.
- Queue notification: email to member with bank instructions, structured communication, amount, IBAN, BIC, beneficiary.
- Show: "Mail verzonden. Betaal binnen 14 dagen."

Both flows: if checkout was in progress → return to `/menu` with cart intact. Otherwise return to `/menu` with no pending cart.

### 6.8 Receipt (`/receipt`)

Large green checkmark. **"Bedankt!"** in `--font-size-receipt`. Sale summary: items, amount paid, payment method. New balance if member-card.

Auto-redirect to idle after 8s, or tap "Klaar" to skip.

If member has `email_receipts_enabled = true`: queue receipt email asynchronously (do not block UI).

### 6.9 Error (`/error`)

Fallback for unrecoverable JS errors (Svelte error boundary). Shows friendly Dutch message: "Er ging iets mis. De situatie is hersteld. Tik om verder te gaan." Tap returns to idle. Logs error details to server.

### 6.10 Touchscreen-specific behaviors

The kiosk runs in Microsoft Edge Kiosk Mode on Windows, against a backend on the LAN. Key behaviors:

- All `<button>` and clickable elements: `touch-action: manipulation` (already global) — eliminates 300ms tap delay.
- All UI text: `user-select: none` (already global) — prevents accidental text selection on long press.
- `cursor: none` globally — hides mouse cursor since the device is touch-only. (Edge Kiosk Mode can also hide the cursor at the OS level; both layers of defense.)
- No `:hover` styles for primary actions (only `:active` feedback).
- `<input>` fields: there should be **none** in the kiosk app's user flow. Confirm during code review.
- `overscroll-behavior: none` on body — disable any pull-to-refresh / swipe-back gestures.
- `viewport` meta tag: `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">` to prevent accidental pinch-zoom.
- Wake Lock API requested on app load and on `visibilitychange`.
- `prefers-reduced-motion` respected (some elderly users find motion dizzying).

---

## 7. Admin app — full specification

### 7.1 Auth

- Login page: email + password.
- On success → MFA challenge if enrolled. If not yet enrolled, force enrollment on first login.
- TOTP via `otplib`. QR generated for user to scan into Authenticator. Backup codes (10× single-use) generated and shown once.
- Session cookie: HTTP-only, SameSite=Lax, Secure, 8-hour absolute expiry, sliding 1-hour idle expiry.
- Argon2id password hashing.
- Brute-force protection: after 5 failed attempts on an admin account → lock for 15 minutes (`locked_until`). After 10 → require admin reset.
- All login attempts logged to audit_log.

### 7.2 Layout

- Top nav: club name, current admin name, logout.
- Side nav (collapsible on mobile): **Dashboard**, **Leden**, **Dranken**, **Voorraad**, **Top-ups**, **Verkopen**, **Reconciliatie**, **Betalingsoverzicht**, **Rapporten**, **Beheerders**, **Logboek**, **Instellingen**.
- All forms have CSRF tokens.
- All destructive actions (delete, anonymize, write-off) require explicit confirmation modals with typed confirmation ("Type 'VERWIJDER' om te bevestigen") for irreversible actions.

### 7.3 Dashboard

Live metrics (refreshed every 60s):

- Today's revenue (incl VAT).
- Today's drinks sold (count).
- Pending sales (count + €).
- Outstanding email-invoice top-ups (count + €).
- Members at risk (count, link to `Betalingsoverzicht → Risico`).
- Drinks below stock threshold (count, link to `Voorraad`).
- Reconciliation gap: days since last CODA import.
- Kiosk display health: last heartbeat from the PC's Edge Kiosk session.
- System health: links to Grafana embedded dashboard.

### 7.4 Leden (Members)

List view:
- Search by name / email / card identifier.
- Filter: status, blocked-for-topup, has-outstanding-topups.
- Columns: name, age, balance, outstanding €, status, last activity.

New member form (per flow 1.4):
- name, email (optional), DOB picker (validates ≥18), preferred top-up method, email opt-ins, opening balance.
- GDPR consent checkbox + capture timestamp + version.
- "Scan kaart" button — opens scan modal that listens for next scanner event (30s timeout). The scanner is connected to the PC. If managers operate the admin app from their own laptop/phone over Tailscale and not from the kiosk PC, they can manually type the card identifier instead. Document both modes in `docs/runbook.md`.
- On submit: insert member + member_card + balance_transaction (opening_balance) + audit_log entries, all in one transaction.

Member detail page:
- Personal data section (editable).
- Cards section (list of cards, status, replace button per flow 1.5).
- Balance section (current balance, full ledger view).
- Top-ups section (history with filters).
- Sales section (history with filters).
- GDPR section: **Exporteer data** (returns JSON download), **Anonimiseer** (per flow 2.17).
- Actions: **Blokkeer / Deblokkeer**, **Vervang kaart**, **Schuld afschrijven**.

### 7.5 Reconciliatie (CODA Import)

Upload page:
- File picker (.cod, .CODA).
- Preview parsed transactions before commit.
- After import: summary screen (matched / unmatched / duplicates).

CODA parser implementation notes:
- Parse fixed-width line records by record type (`0`=header, `1`=oldsituation, `2x`=movement, `3x`=info, `8`=newsituation, `9`=footer).
- Extract: booking date, value date, amount (signed), counterparty, structured communication (record type 21 mediation), free-text (record type 31).
- The structured communication appears as a 12-digit number with checksum; normalize to `+++XXX/XXXX/XXXXX+++` form before matching.
- Match logic:
  - Look up `top_ups.structured_communication` and `sales.structured_communication`.
  - If match found and target is in `pending_payment_unverified`:
    - For top_up: status → `paid_epc_verified`, insert `balance_transactions` credit, audit log.
    - For sale: status → `paid_epc_verified`, audit log.
  - If match found but target already `paid_*`: flag as `duplicate_already_paid` (likely manual mark-paid before CODA arrived). Notify admin to review.
  - If no match: status `unmatched`.
- File-level idempotency via `file_sha256` UNIQUE.

Manual match interface:
- List of unmatched CODA transactions.
- Per row: dropdown "Match met openstaand top-up / openstaande verkoop / negeer".
- Manual matches recorded with `match_status='matched_manual'`, `matched_by_admin_id`.

### 7.6 Top-ups

Three tabs (per flow 1.10 / runbook 2.5–2.7):

**Tab 1 — Openstaand** (Pending):
- All top-ups with `status='pending_payment_unverified'` or in reminder state.
- Columns: member, amount, method, age, expires_at, reminders sent.
- Bulk actions: **Stuur herinnering**, **Markeer als betaald** (with reason), **Annuleer**.

**Tab 2 — Risico** (Risk):
- Algorithm:
  - Score = (3 × expired_top_ups_last_12_mo) + (2 × outstanding_eur / 25) + (1 × is_blocked_for_topup) + (avg_days_to_pay / 7).
  - Show member if score ≥ 3.
- Per row: full member context, drill-in to detail.

**Tab 3 — Geschiedenis** (History):
- Embedded Grafana panel: top-up success rate, outstanding € over time, top members by outstanding.

**New manual top-up** form: select member, amount, method (manual_cash_admin only), reason, note.

### 7.7 Dranken (Drinks)

List + edit + new (per flow 1.9). Photo upload via standard `<input type="file">` with image-only filter, server resizes to max 800×800, stores under `/var/lib/billiard/images/<uuid>.<ext>`, persists relative path in DB.

Barcode subform (per flow 1.9): scan barcode via modal, conflict resolution if barcode already linked. Same scanner-vs-manual-typing duality as section 7.4.

### 7.8 Voorraad (Stock)

Sorted by lowest stock first. Per flow 1.7.

Three adjustment modes per drink:
- **Bijvullen** (positive delta).
- **Correctie** (set absolute count, system computes delta).
- **Afschrijven** (negative delta, requires reason).

Each results in a `stock_transactions` row + audit_log entry.

### 7.9 Verkopen (Sales)

List view with date range, status, member, payment method filters. Drill-down per sale showing all sale_lines, payment status, related CODA transaction if matched.

Export: CSV / Excel for selected range.

### 7.10 Betalingsoverzicht (Payment Overview)

Three-tab view per part 1 / section 1.10:
- **Open top-ups** (same data as `Top-ups → Openstaand`).
- **Risico** (same as Risk tab).
- **Analytics** (embedded Grafana panels).

This page is the manager's "is the trust system working?" cockpit.

### 7.11 Rapporten (Reports)

- **Wekelijks rapport**: configuration screen (which admins receive it — toggle per `admins.receive_weekly_report`), preview, "Stuur nu" button.
- **Maandrapport**: generate month's Excel file on demand.
- **Aangepast rapport**: custom date range, exports Excel + PDF (use `puppeteer` for PDF rendering of a printable HTML view).
- **GDPR-export per lid**: linked from member detail.

### 7.12 Beheerders (Admins)

Per flow / runbook 2.15 / 2.16. Invite by email (one-time link valid 24h, single-use). Toggle weekly-report opt-in. Deactivate (do not hard-delete; retains audit trail).

### 7.13 Logboek (Audit log)

Browse/search audit_log: filter by admin, entity type, entity id, action, date range. Read-only. Export CSV.

### 7.14 Instellingen (Settings)

Per flow 1.10. Editable fields backed by `settings` table. Each save creates an audit_log entry. "Stuur test-notificatie" button on the email/ntfy settings to verify.

The settings page has the following grouped sections:

**Bankgegevens & BTW** (used for EPC QR generation and VAT-compliant reporting):
- **Club IBAN** — text input with mod-97 IBAN checksum validation on save. Invalid IBAN blocks save with a clear error: "Het IBAN-nummer is ongeldig. Controleer en probeer opnieuw."
- **Club BIC** — text input, validated against the IBAN's expected BIC for known Belgian banks (warn but don't block on mismatch — some banks have multiple BICs).
- **Beneficiary name** — text input, max 70 characters per EPC spec.
- **Club BTW-nummer** — text input, validated against Belgian VAT number format `BE 0XXX.XXX.XXX` (with 10-digit checksum).
- **Default VAT rate for new drinks** — dropdown sourced from `vat_rates`.
- **"Test EPC QR genereren"** button — renders a sample QR with the current values (€1.00 to a test structured communication) so the manager can sanity-check by scanning it with their bank app *without* actually executing a transfer (the sample uses a clearly marked test communication; the manager can dismiss the bank-app form before confirming).

**Drempels & limieten**:
- Top-up outstanding cap (€)
- Top-up email-invoice expiry (days)
- Top-up reminder days
- Top-up auto-block threshold (count)
- Idle warning (s)
- Idle reset (s)
- EPC QR payment timeout (s)
- Default low-stock threshold

**Notificaties**:
- SMTP host, port, user, password, from-address — with **"Stuur test-mail"** button.
- ntfy.sh server URL and topic — with **"Stuur test-notificatie"** button.
- Weekly report recipients (toggle per admin user).

**Test Modus** (only shown when `KIOSK_TEST_MODE=true`):
- Toggle: "Toon test data in rapporten" (default off — reports filter `is_test=true` out).
- **"Reset test data"** button (typed-confirmation). Wipes all `is_test=true` rows and resets test drink stock to seed defaults. Disabled if test mode is not active.

**Privacy & retentie**:
- GDPR consent text version (read-only, bumped only via migration).
- Transaction retention period (years).

All changes audit-logged with before/after JSON.

---

## 8. Test mode and automated testing

Both interactive test mode (for human QA / development without a real card) and automated tests (for CI and release smoke testing) are first-class deliverables.

### 8.1 Interactive test mode

Activated by the server-side environment variable `KIOSK_TEST_MODE=true`. The flag is read by the kiosk container at startup; flipping it requires `docker compose up -d --force-recreate kiosk`. There is no client-side switch — the UI cannot enable test mode by itself.

When enabled:

- A persistent yellow banner across the top of every kiosk screen: **"TEST MODUS — GEEN ECHTE TRANSACTIES"**.
- The idle screen gains an additional button: **"Start als testlid"**. Tapping it loads a synthetic member profile (name "Test Lid", balance €1000 reset every login) and navigates to `/menu` exactly as a real card scan would.
- Real card scans still work alongside the test entry, so test mode can be exercised with both real and synthetic members.
- All test-mode entities (members, sales, top-ups, balance transactions) are tagged `is_test=true` in their respective tables. Add an `is_test BOOLEAN NOT NULL DEFAULT false` column to `members`, `sales`, `top_ups`, and `balance_transactions`.
- Stock decrements **are real** (intentional, so stock-alert flows can be exercised end-to-end). Restock via admin's normal flow when needed, or via the test-data reset below.
- The `kiosk_test_mode_enabled` Prometheus gauge is exposed so monitoring can flag if test mode is unexpectedly running in production.

**Reporting and dashboards filter `is_test=true` rows by default.** A toggle in admin Instellingen → Test Modus shows test data when enabled, for QA review.

**"Reset test data" button** (admin Instellingen → Test Modus): wipes all `is_test=true` rows from members, sales, top_ups, balance_transactions, and resets seed-defined test drink stock to original quantities. Audit-logged. Disabled if `KIOSK_TEST_MODE=false` so it cannot accidentally run in production unprotected.

### 8.2 Automated test suite

Three layers, all in `tests/` workspace folder.

**Unit tests** (`tests/unit/`, Vitest, no DB):
- mod-97 IBAN checksum validation (test 5 valid + 5 invalid IBANs).
- Belgian structured-communication mod-97 generation + validation (5 known input/output pairs).
- EPC QR string generation (verify exact byte-for-byte spec compliance).
- VAT calculation (single-rate and mixed-rate carts).
- Balance ledger math (sum-of-deltas correctness with edge cases: zero, negative, large amounts).
- CODA record-line parsing (sample files in `tests/fixtures/coda/`).
- Date/age math (member ≥18 validation; top-up expiry math).

**Integration tests** (`tests/integration/`, Vitest, throwaway Postgres in Docker via `testcontainers`):
- Insert sale → verify balance debit, stock decrement, audit log entry — all in one transaction.
- Insert top-up → mark paid → verify balance credit + audit log.
- CODA import: matched, unmatched, duplicate-already-paid scenarios.
- Idempotent CODA file (re-import same SHA256 → rejected).
- Anti-abuse: outstanding cap blocks new email-invoice top-up.
- Auto-block: 2 expired top-ups in 12 months → member blocked.
- GDPR export returns full member tree.
- GDPR anonymize clears PII but preserves accounting rows.

**End-to-end tests** (`tests/e2e/`, Playwright headless, against a docker-compose test stack):
- Member identification via simulated barcode scan (typed via Playwright).
- Drink scan → cart update with animation observable.
- Drink tap → cart update.
- Member-card payment success → receipt → balance updated.
- Insufficient-balance flow → routed to top-up.
- EPC QR sale → QR rendered, "Ik heb betaald" path → sale row in `pending_payment_unverified`.
- Cash payment → receipt.
- Top-up email-invoice → email queued in `notifications` table (assertable in DB).
- Stock decrements as drinks ordered; low-stock alert generated when threshold crossed.
- Idle reset behavior at 60 s + 100 s.
- Connectivity banner appears when backend stopped, clears when restarted.

A single command: `pnpm run test` runs all three layers.

### 8.3 Release smoke test

`pnpm run smoke -- --target=http://billiard-kiosk.local` hits a running deployment with a scripted scenario:

1. POST a test member (with `is_test=true`), assert created.
2. POST a sale for that member, assert balance debited and stock decremented.
3. POST a top-up email-invoice, assert notification queued.
4. POST a CODA import with a matching transaction, assert top-up flipped to paid and balance credited.
5. Cleanup: delete `is_test=true` rows.
6. Print pass/fail summary; exit non-zero on any failure.

Run after every deploy. Documented in `docs/testing.md`.

### 8.4 Test data conventions

- Seeded test member identifiers prefixed `TEST-` so they're trivially recognizable in logs.
- Test drinks (if needed for tests not relying on production drinks) prefixed `TEST-` in `name_nl`.
- Test top-ups use structured communications in a reserved range (e.g. `+++999/...`) so production CODA imports never accidentally match.

---

## 9. Kiosk display environment (Windows PC)

The kiosk display runs on an existing Windows PC connected to the 20" touchscreen and the USB barcode scanner. The PC continues to host its existing STid Mobile ID member-creation tooling on a separate Windows user account; the kiosk function is fully isolated.

### 8.1 Components

- **Microsoft Edge** (current Stable channel). Edge has built-in kiosk mode with auto-relaunch on crash and is supported by Windows Assigned Access.
- **Windows Assigned Access** (Settings → Accounts → Family & other users → Set up a kiosk) — locks a dedicated Windows user account to a single fullscreen Edge session pointed at the kiosk URL.
- **Auto-login** to the kiosk Windows account on boot.
- **Power Plan: High performance**, sleep disabled, screensaver disabled, screen never turns off.

### 8.2 Setup procedure (documented in `docs/windows-kiosk-setup.md`)

1. Create local Windows user `kiosk` (no Microsoft account). Standard user, not admin.
2. Settings → Accounts → Family & other users → **Set up a kiosk**. Choose "Microsoft Edge". URL: `http://billiard-kiosk.local`. Mode: "Public browsing" with idle reset disabled (the kiosk app handles idle internally).
3. Configure the kiosk Windows account for **auto-login** (`netplwiz` → uncheck "Users must enter a username and password"; or via `Autologon.exe` from Sysinternals for a more reliable password-protected variant).
4. Power Options → set the active plan's Sleep, Screensaver, and Display-off timers all to **Never**.
5. Disable Windows Update active hours so updates do not reboot the PC during business hours; configure update reboots for the small hours.
6. Disable Windows touch-keyboard auto-popup (Settings → Devices → Typing → "Show the touch keyboard when not in tablet mode and there's no keyboard attached" → Off). The kiosk app has no text inputs in the user flow, but this is belt-and-braces.
7. Test: reboot. The PC should boot directly into Edge displaying the kiosk app on the touchscreen. No Windows desktop visible.

A PowerShell helper script in `infra/windows-kiosk/` automates steps 1, 4, 5, 6 and provides a documented manual procedure for steps 2 and 3 (since Assigned Access setup is best done interactively). Provide a sample `AssignedAccessConfiguration.xml` for advanced/MDM deployment.

### 8.3 Switching to the manager account for STid work

A manager who needs to use the PC for STid operations:
1. Press **Ctrl+Alt+Del → Switch user**, OR **Win+L**, then choose the manager account.
2. Do their STid work.
3. **Sign out** of the manager account when done — the PC auto-logs back into the kiosk account and resumes kiosk mode.

Do not "Switch user" leaving the manager account signed in alongside; this leaves resources allocated unnecessarily. Always sign out fully.

### 8.4 Touchscreen calibration

Standard Windows HID multi-touch should work without configuration. If the touchscreen reports incorrect coordinates after rotation or relocation:
- Control Panel → Tablet PC Settings → Calibrate.
- Modern touchscreens rarely require this; document the procedure for completeness only.

### 8.5 Barcode scanner verification

Plug the USB scanner into the PC. Open Notepad, scan a sample drink barcode. The scanner should type the digits followed by Enter (within ~50 ms total). If this works in Notepad, it will work in Edge — the scanner is HID-compliant and no driver setup is needed.

If the scanner types extra characters (e.g. country-code prefixes), use the scanner's configuration manual (usually a printed sheet of barcodes you scan in sequence) to disable preamble/suffix characters. Document the model used.

### 8.6 Health monitoring of the kiosk display

The kiosk app posts a heartbeat to `POST /api/kiosk/heartbeat` every 30 seconds. Worker container's `kiosk_health_heartbeat_check` job verifies a heartbeat was received within the last 2 minutes; if not, raises an alert (email + ntfy) "Kiosk display unresponsive". This catches: PC offline, network outage between PC and Pi, Edge crash that Windows hasn't auto-restarted, hung tab, frozen page.

Edge Kiosk Mode itself auto-relaunches Edge on crash within ~5 seconds; this rarely surfaces as a heartbeat gap unless the underlying issue is more serious (e.g. PC reboot, network outage).

### 8.7 Failure modes and recovery

| Failure | Recovery |
|---|---|
| Edge crash | Windows auto-relaunches it (Assigned Access feature). |
| PC reboot (Windows Update) | Auto-login + Assigned Access bring kiosk back automatically. |
| Touchscreen unresponsive | Cycle USB cable; if persistent, replace cable. |
| Scanner unresponsive | Cycle USB cable; reboot PC if needed. |
| Network blip Pi ↔ PC | Service Worker shows "Geen verbinding" banner; auto-recovers. |
| Pi reboot | PC shows banner for ~60s while Pi boots; auto-recovers. |
| PC totally frozen | Manager unplugs power, waits 10s, plugs back in. Documented in runbook. |

---

## 9. Worker container — background jobs

Single Node.js process, runs `node-cron`. Jobs:

| Schedule | Job | Description |
|---|---|---|
| `0 * * * *` | `expire_topups` | Mark expired top-ups, auto-block members reaching threshold (per flow 1.11). |
| `15 * * * *` | `send_topup_reminders` | Send reminders at day 7 and 13 for pending email-invoice top-ups. |
| `0 2 * * *` | `nightly_backup` | pg_dump → age-encrypt → rclone to cloud. Verify upload via remote checksum. Notify on failure. |
| `0 3 * * *` | `rotate_backups` | Keep 30 daily + 12 monthly + 5 yearly. Delete older. |
| `0 7 * * *` | `daily_risk_digest` | If any member newly crossed risk threshold, email + ntfy admins. |
| `0 8 * * 1` | `weekly_report` | Generate report, email to opted-in admins. Mon 08:00 Brussels. |
| `*/5 * * * *` | `process_notification_queue` | Send pending `notifications` rows. Retry with exponential backoff up to 5 attempts. |
| `*/2 * * * *` | `low_stock_alerter` | Detect newly-below-threshold drinks, batch within 30-minute window, queue notification. |
| `0 4 * * 0` | `gdpr_retention_sweep` | Anonymize members soft-deleted longer than retention window; never delete sale_lines. |
| `*/2 * * * *` | `kiosk_health_heartbeat_check` | Verify last kiosk heartbeat within 2 minutes; raise alert if not. |

All jobs:
- Wrapped in try/catch with structured logging to stdout (Promtail → Loki).
- Acquire a Postgres advisory lock (`pg_try_advisory_lock`) to prevent overlapping runs.
- Emit Prometheus metrics: `job_runs_total`, `job_duration_seconds`, `job_failures_total`.

---

## 10. Docker Compose & networking

`docker-compose.yml` defines the full stack on the Pi. Core requirements:

- All containers: `restart: unless-stopped`, `healthcheck` defined, resource limits set (memory at minimum).
- Internal network: `billiard_internal` (bridge), only Caddy exposes ports to host.
- Caddy listens on host ports `80` and `443` on **the LAN interface only** (not bound to all interfaces — explicitly bind to the LAN-facing IP, or to `0.0.0.0` with a host firewall rule limiting source to RFC1918 ranges).
- The PC reaches the kiosk app at `http://billiard-kiosk.local` (mDNS) on port 80.
- Internal services not directly exposed.
- PostgreSQL data on named volume `pg_data`, mounted from `/var/lib/billiard/postgres` on the SSD.
- Drink images on named volume `drink_images` mounted at `/var/lib/billiard/images`.
- Backup target on named volume mounted at `/var/lib/billiard/backups`.
- Cloudflared service has `profiles: ["public"]` so it does not auto-start; documented activation procedure.
- Secrets via `.env` file (gitignored); `.env.example` lists every variable.

Container list:

1. `postgres` (postgres:16) — DB.
2. `kiosk` (node:22-alpine, builds `apps/kiosk`) — kiosk SvelteKit (production build, served via `node`).
3. `admin` (node:22-alpine, builds `apps/admin`) — admin SvelteKit.
4. `worker` (node:22-alpine, builds `apps/worker`) — cron jobs.
5. `caddy` (caddy:2) — reverse proxy + internal TLS.
6. `prometheus` (prom/prometheus:latest).
7. `loki` (grafana/loki:latest).
8. `promtail` (grafana/promtail:latest, mounts docker socket for log discovery).
9. `grafana` (grafana/grafana:latest, provisioned datasources + dashboards).
10. `node-exporter` (prom/node-exporter:latest).
11. `cadvisor` (gcr.io/cadvisor/cadvisor:latest).
12. `postgres-exporter` (prometheuscommunity/postgres-exporter:latest).
13. `uptime-kuma` (louislam/uptime-kuma:latest).
14. `cloudflared` (cloudflare/cloudflared:latest, profile `public`).

Caddy config:
- `billiard-kiosk.local` (and the Pi's LAN IP) → `kiosk:3000` over plain HTTP. The kiosk endpoint is intentionally HTTP-only on the LAN — non-sensitive payloads, closed network, simplifies setup (no client cert install on Windows).
- `admin.<tailnet>.ts.net` and `admin.local` → `admin:3000` with Caddy's internal TLS.
- `grafana.local` → `grafana:3000` with internal TLS.
- `monitor.local` → `uptime-kuma:3001` with internal TLS.

The Pi's host has `avahi-daemon` installed and configured (via `scripts/enable-mdns.sh`) so the PC resolves `billiard-kiosk.local` automatically.

Firewall (ufw on Pi):
- Allow 80/443 from RFC1918 LAN ranges only.
- Allow Tailscale traffic on `tailscale0`.
- Drop everything else.

---

## 11. Backup, restore, recovery

### 11.1 Backup script (`scripts/backup.sh`)

```
1. pg_dump --format=custom --compress=9 → /tmp/billiard-YYYY-MM-DD.dump
2. tar drink_images → /tmp/billiard-images-YYYY-MM-DD.tar.gz
3. age -r <recipient_pubkey> -o /tmp/<file>.age <each file>
4. rclone copy /tmp/*.age <remote>:billiard-backups/
5. rclone hashsum SHA256 to verify upload integrity
6. rm /tmp/*.age /tmp/*.dump /tmp/*.tar.gz
7. Insert success record into a backups log table; or write to journald + Promtail captures it
8. On any failure → exit non-zero; worker captures and queues notification
```

Encryption: `age` with a public key; the private key is stored offline (manager's safe + 1Password vault). The Pi only knows the public key.

### 11.2 Restore script (`scripts/restore.sh`)

Interactive:
1. Prompt for backup file name.
2. `rclone copy` from cloud.
3. `age -d` decrypt (prompts for private key).
4. `pg_restore` with `--clean --if-exists`.
5. Untar images to volume.
6. Verify integrity: count members, drinks, sales; print summary.

Document the exact command sequence in `docs/recovery.md` with screenshots.

### 11.3 Watchdog enablement (`scripts/enable-watchdog.sh`)

Sets `RuntimeWatchdogSec=15` in `/etc/systemd/system.conf` and restarts systemd. One-time setup, idempotent.

### 11.4 mDNS enablement (`scripts/enable-mdns.sh`)

Installs `avahi-daemon`, sets the Pi's hostname to `billiard-kiosk`, opens UDP/5353 in ufw, restarts services. Verifies the host is resolvable as `billiard-kiosk.local` from another device on the LAN. Idempotent.

### 11.5 Recovery runbook

`docs/recovery.md` covers:
- Total Pi loss → restore on new hardware.
- Database corruption → restore from latest nightly + replay audit log.
- Bad migration → rollback procedure (we use forward-only migrations; rollback = restore + reapply minus the bad migration).
- Image volume loss → restore from tar.
- Kiosk PC malfunction → see `docs/windows-kiosk-setup.md`.
- Test schedule: full restore drill must be performed every 6 months on a separate test Pi or VM.

---

## 12. Observability

### 12.1 Prometheus

Scrape targets:
- `node-exporter:9100` — Pi system metrics (CPU, RAM, disk, temperature, network).
- `cadvisor:8080` — per-container metrics.
- `postgres-exporter:9187` — DB metrics.
- `kiosk:3000/metrics` — app metrics (requests, errors, scan events, cart resets, payment failures, heartbeat received timestamps).
- `admin:3000/metrics` — app metrics.
- `worker:3000/metrics` — job runs, durations, failures.
- `caddy:2019/metrics` — proxy metrics.

Scrape interval 15s. Retention 30 days local; long-term in Loki via log aggregation if needed.

### 12.2 Loki + Promtail

Promtail scrapes all Docker container logs via Docker socket, ships to Loki with labels `container`, `compose_service`, `level`. Loki retention 30 days.

### 12.3 Grafana

Provisioned datasources: Prometheus, Loki, PostgreSQL.

Provisioned dashboards (JSON in `infra/grafana/dashboards/`):

1. **Verkopen vandaag** — revenue, count, top drinks, hourly heatmap.
2. **Voorraad** — stock levels, low-stock highlights.
3. **Top-ups & saldo** — outstanding, success rate, top spenders.
4. **Risico-leden** — risk-flag rankings.
5. **Reconciliatie** — gap analysis, matched vs unmatched.
6. **Systeem gezondheid** — Pi temp, RAM, disk, container health, job success rates, kiosk heartbeat freshness.
7. **Logs** — Loki log explorer pre-filtered to ERROR.

Anonymous viewing disabled. Grafana auth via username/password; provision an `admin` user from env on first start. Embedding into admin app via signed iframe URL or shared cookie domain.

### 12.4 Uptime Kuma

Pre-configured monitors (document in `infra/uptime-kuma/monitors.md`; Uptime Kuma supports config via API after first-time setup):

- Kiosk app HTTP health on `http://localhost` from inside the Pi (every 30s, fail after 3 consecutive).
- Admin app HTTP health.
- Postgres TCP probe.
- Worker heartbeat endpoint (must be hit every 10 minutes by `kiosk_health_heartbeat_check` job).
- Kiosk frontend heartbeat freshness (Prometheus metric query: `time() - kiosk_last_heartbeat_seconds < 120`).
- External: ntfy.sh reachability.
- External: SMTP connectivity.

Notification settings: email (SMTP) + ntfy.sh (POST). Configured via Uptime Kuma's UI on first login; document this step.

---

## 13. Security checklist (build to public-exposure standards from day one)

- All admin auth: argon2id, MFA enforced, brute-force lockout.
- CSRF tokens on all admin POST/PATCH/DELETE.
- Rate limiting at Caddy layer for admin login (10 req/min per IP).
- Input validation via Zod schemas for every API endpoint.
- Output escaping: SvelteKit defaults; no `{@html}` except for sanitized markdown.
- Secrets in `.env`, never committed; `.env.example` lists keys only.
- Postgres credentials rotated from default; least-privilege roles (separate role for admin app, kiosk app, worker, with only required grants).
- Backups encrypted at rest (age) and in transit (rclone TLS).
- Audit log immutable (no UPDATE or DELETE permission for app roles on `audit_log`).
- Balance ledger immutable (no UPDATE or DELETE permission on `balance_transactions`).
- Image upload: server-side MIME sniffing, max 5MB, re-encoded via `sharp` (drops EXIF, prevents polyglot attacks).
- HTTPS via Caddy's local CA for all hostnames except the kiosk LAN endpoint (which is HTTP only, by design — non-sensitive payloads, no easy way to install a custom CA on Windows kiosk without complicating the setup).
- The kiosk LAN endpoint is firewall-restricted to RFC1918 source ranges via ufw.
- Headers: HSTS, X-Frame-Options DENY (except Grafana iframe via CSP frame-ancestors), CSP restrictive, X-Content-Type-Options nosniff.
- Windows kiosk user account is a Standard user (no admin rights), separate from the manager account used for STid.

---

## 14. .env.example

Provide a complete `.env.example` with every variable used, grouped and commented:

```env
# ─── Database ────────────────────────────────────────────────────────
POSTGRES_DB=billiard
POSTGRES_USER=billiard_root
POSTGRES_PASSWORD=change_me_strong_random
DATABASE_URL_KIOSK=postgresql://billiard_kiosk:change_me@postgres:5432/billiard
DATABASE_URL_ADMIN=postgresql://billiard_admin:change_me@postgres:5432/billiard
DATABASE_URL_WORKER=postgresql://billiard_worker:change_me@postgres:5432/billiard

# ─── App ─────────────────────────────────────────────────────────────
PUBLIC_CLUB_NAME=Biljartclub Wortegem
KIOSK_PORT=3000
ADMIN_PORT=3000
SESSION_SECRET=<64 random hex chars>
PUBLIC_KIOSK_HOSTNAME=billiard-kiosk.local
KIOSK_TEST_MODE=false       # set to true to enable interactive test mode

# ─── Email (SMTP) ────────────────────────────────────────────────────
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM="Biljartclub Wortegem <noreply@example.be>"

# ─── ntfy.sh ─────────────────────────────────────────────────────────
NTFY_SERVER=https://ntfy.sh
NTFY_TOPIC=biljartclub-wortegem-<random-suffix>

# ─── Backups ─────────────────────────────────────────────────────────
RCLONE_REMOTE=b2:billiard-backups
AGE_RECIPIENT_PUBKEY=age1...

# ─── Tailscale ───────────────────────────────────────────────────────
# Tailscale runs on host, no env needed inside containers.

# ─── Cloudflare Tunnel (future) ──────────────────────────────────────
CLOUDFLARED_TUNNEL_TOKEN=  # leave empty until enabling public exposure

# ─── Grafana ─────────────────────────────────────────────────────────
GF_SECURITY_ADMIN_USER=admin
GF_SECURITY_ADMIN_PASSWORD=change_me

# ─── Bank / EPC / VAT ────────────────────────────────────────────────
# These are NOT in env — they live in the `settings` table and are
# editable via the admin Instellingen page so they can be changed
# without restarting the stack.
```

---

## 15. README

`README.md` should contain, in this order:

1. Project description (brief).
2. System architecture diagram (Mermaid) showing Pi backend ↔ network ↔ Windows PC kiosk.
3. Hardware requirements (Pi 5 8GB, SSD, Windows 10/11 Pro PC, 20" USB-HID touchscreen, USB barcode scanner, ethernet cable).
4. First-time setup checklist on the **Pi**:
   - Install Ubuntu Server on SSD; first boot
   - Run `scripts/enable-watchdog.sh`
   - Run `scripts/enable-mdns.sh`
   - Install Tailscale on host, join tailnet
   - Clone repo, copy `.env.example` → `.env`, fill values
   - `docker compose up -d`
   - Run `scripts/bootstrap-admin.sh` to create first admin
   - Configure Uptime Kuma (first-time setup)
5. First-time setup checklist on the **Windows PC** (also in `docs/windows-kiosk-setup.md`):
   - Connect 20" touchscreen and USB barcode scanner
   - Verify scanner with Notepad test
   - Create local Windows user `kiosk`
   - Configure Microsoft Edge Kiosk Mode via Assigned Access pointed at `http://billiard-kiosk.local`
   - Configure auto-login for the kiosk account
   - Configure Power Plan: never sleep, screensaver off, display never off
   - Disable touch keyboard auto-popup
   - Reboot, verify kiosk app launches automatically and fullscreen
6. Network setup notes (ethernet preferred; how to verify mDNS resolution from PC: `ping billiard-kiosk.local`).
7. Tailscale onboarding for managers.
8. Backup/restore.
9. Troubleshooting top 10 (kiosk frozen, no connection, scanner not detected, mDNS resolution fails, Pi reboot recovery, Edge auto-relaunch verification, etc.).
10. Development setup (running individual apps locally).
11. License (your choice).

---

## 16. Acceptance criteria — the build is done when…

A reviewer should be able to confirm each item:

**Functional**
- [ ] Admin can register a new member, scan their card, and the member can immediately use the kiosk.
- [ ] Member scans card on kiosk (PC scanner), sees balance, adds drinks via tap and via barcode scan, pays via member-card with balance debit; balance and stock update atomically.
- [ ] EPC QR sale generates a valid scannable QR; on confirm, sale is `pending_payment_unverified` until CODA import flips it.
- [ ] Cash sale path works without member balance impact.
- [ ] Top-up via EPC QR generates QR; via email-invoice generates email with bank instructions.
- [ ] €50 outstanding cap is enforced; member is blocked from a 3rd email-invoice exceeding it.
- [ ] Top-up auto-expires at 14 days; reminders sent at day 7 and 13.
- [ ] Member auto-blocked after 2 expired top-ups in 12 months.
- [ ] CODA import matches structured communications, marks paid, credits balance, audit-logs.
- [ ] Manual mark-paid + later CODA → flagged as `duplicate_already_paid`.
- [ ] Lost-card replacement preserves balance and history.
- [ ] Admin GDPR export returns full member data; anonymize cleans personal data and retains accounting records.
- [ ] Drink price change does not affect historical sale_lines (snapshotted prices verified).
- [ ] VAT breakdown correct on every sale and on weekly/monthly reports.
- [ ] Stock alerts fire when drink crosses below threshold; batched within 30-min window.
- [ ] Weekly report generates Monday 08:00 Brussels and emails opted-in admins.
- [ ] Risk dashboard correctly identifies flagged members per scoring rules.
- [ ] Audit log captures every admin write action with before/after JSON.

**Non-functional**
- [ ] Idle reset works on kiosk (60s warning, 100s reset).
- [ ] Touch-only flow: confirmed no `<input type=text>` reachable in member-facing screens.
- [ ] AAA contrast on all kiosk screens (verified with axe-core).
- [ ] Tap targets ≥64px square verified across all kiosk screens.
- [ ] All kiosk text ≥22px equivalent.
- [ ] Cart sidebar persists alongside menu; cart contents persist on accidental refresh (localStorage).
- [ ] Kiosk responsive at the 20" touchscreen's native resolution (typically 1920×1080) and degrades gracefully at 1366×768.
- [ ] Service Worker caches app shell; UI loads with backend offline.
- [ ] "Geen verbinding" banner appears within ~20s of backend unreachability and clears within ~20s of recovery.
- [ ] Payment buttons disabled while connectivity banner is showing.
- [ ] No mouse cursor visible on the kiosk display.

**Operational**
- [ ] `docker compose up -d` brings up the full backend stack on a fresh Pi 5 in <5 minutes.
- [ ] `enable-mdns.sh` makes the Pi resolvable as `billiard-kiosk.local` from a Windows PC on the LAN.
- [ ] After Windows kiosk setup procedure, PC boots directly into Edge Kiosk Mode displaying the kiosk app — no Windows desktop visible to members.
- [ ] Edge crash → Windows Assigned Access auto-relaunches Edge within 5 seconds.
- [ ] Kiosk heartbeat tracked; absence raises alert within 2 minutes.
- [ ] Grafana dashboards load with real data after first usage.
- [ ] Uptime Kuma fires a test alert via email + ntfy.sh.
- [ ] Nightly backup runs, encrypts, uploads, and the most recent backup can be successfully restored to a fresh database.
- [ ] Hardware watchdog enabled and tested (force kernel sysrq → Pi reboots within 30s).
- [ ] All containers have `restart: unless-stopped` and healthchecks.
- [ ] No container exceeds its memory limit under sustained kiosk load (10 sales/minute simulated).
- [ ] Pi reboot during kiosk usage results in "Geen verbinding" banner; kiosk auto-recovers within ~90s of Pi being back up.
- [ ] Cloudflared container present but disabled; documented activation procedure works on a test domain.

**Security**
- [ ] All admin endpoints require auth + CSRF.
- [ ] MFA cannot be bypassed.
- [ ] Brute-force lockout triggers after 5 failed logins.
- [ ] Audit log writes cannot be deleted by app roles (verified via attempted SQL).
- [ ] Balance transactions cannot be updated or deleted by app roles.
- [ ] Image upload rejects non-image files and re-encodes to strip EXIF.
- [ ] All secrets read from env; no secrets committed.
- [ ] ufw on Pi blocks all non-RFC1918 traffic to ports 80/443; Tailscale traffic permitted.
- [ ] Windows kiosk user is a Standard (non-admin) account, isolated from the manager account.

**Compliance**
- [ ] GDPR consent is captured at member creation with version + timestamp.
- [ ] Data export endpoint returns complete member JSON.
- [ ] Anonymize endpoint clears PII and preserves accounting records.
- [ ] VAT data correctly snapshotted on every sale_line.
- [ ] Belgian structured communication mod-97 checksum is correct (test with 5 known values).

---

## 17. Out of scope (explicitly)

These are intentionally **not** part of this build, even though they may sound relevant:

- Payconiq / PSD2 API integration.
- Power BI or other external BI tools.
- Public exposure of admin (configured but disabled).
- Member self-registration or self-service password reset.
- Mobile app for members.
- Receipt printer integration.
- Multi-club / multi-tenant support.
- Internationalization beyond Dutch.
- Loyalty programs / discounts / promotions.
- Alcohol-restricted-by-age drink filtering (membership 18+ baseline applies to all drinks).
- STid Mobile ID API integration on the Pi (door access stays on the Windows PC's existing tooling, untouched).
- HTTPS for the kiosk LAN endpoint (intentionally HTTP-only on the closed LAN).

---

## 18. Working method

Build in this order, and surface blocking questions early rather than guessing:

1. Repo skeleton + Docker Compose with Postgres + Caddy.
2. Database migrations + seed data (including `is_test` columns on members, sales, top_ups, balance_transactions).
3. `packages/shared` with DB client, types, EPC QR, structured-comm helper, IBAN/VAT validators, ntfy/email wrappers.
4. Bootstrap admin script.
5. Admin app: auth + members + drinks + stock (cores).
6. Admin Instellingen with Bankgegevens & BTW section (since EPC QR generation depends on these settings being set).
7. Kiosk app: idle → menu (cart-prominent layout, scan-first interaction model) → payment (member-card path first).
8. Service Worker + connectivity banner.
9. Test mode flag + "Start als testlid" idle-screen entry + `is_test` tagging end-to-end.
10. Top-up flows (kiosk + admin).
11. EPC QR generation + sale path. Include the "Test EPC QR genereren" admin action.
12. CODA parser + reconciliation UI.
13. Worker container + cron jobs.
14. Notifications (email + ntfy).
15. Reports + Excel export (filter `is_test=true` by default).
16. Audit log + GDPR endpoints.
17. Observability stack.
18. Backup + restore + watchdog + mDNS scripts.
19. Windows kiosk setup documentation + helper PowerShell + sample AssignedAccessConfiguration.xml.
20. Test suites: unit, integration (testcontainers), E2E (Playwright). Smoke test script.
21. README + runbook docs + `docs/testing.md`.
22. Acceptance test pass.

If any specification is ambiguous, prefer the **safer / more conservative** interpretation and add a comment `// SPEC-AMBIGUITY:` so it can be reviewed.

End of prompt.
