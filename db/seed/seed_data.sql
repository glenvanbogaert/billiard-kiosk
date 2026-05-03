-- Seed data for payment_statuses
INSERT INTO payment_statuses (code, description_nl, is_terminal, is_successful) VALUES
('pending_payment_unverified', 'Wacht op betalingsbevestiging', false, false),
('paid_member_card', 'Betaald via lidkaart', true, true),
('paid_cash', 'Betaald in contanten', true, true),
('paid_epc_verified', 'Betaald via overschrijving (CODA)', true, true),
('paid_manual_admin', 'Handmatig gemarkeerd als betaald', true, true),
('abandoned', 'Geannuleerd door gebruiker', true, false),
('expired', 'Vervallen na 14 dagen', true, false),
('failed', 'Mislukt', true, false);

-- Seed data for vat_rates
INSERT INTO vat_rates (rate, description_nl) VALUES
(0.06, '6% BTW'),
(0.12, '12% BTW'),
(0.21, '21% BTW'),
(0.00, '0% BTW');

-- Seed data for drink_categories
INSERT INTO drink_categories (name_nl, sort_order) VALUES
('Frisdranken', 10),
('Warme dranken', 20),
('Bieren', 30),
('Sterke dranken', 40),
('Snacks', 50);

-- Seed data for settings
INSERT INTO settings (key, value, description_nl) VALUES
('topup_outstanding_cap_eur', '50', 'Maximale openstaande schuld in EUR'),
('topup_email_invoice_expiry_days', '14', 'Dagen tot email topup vervalt'),
('topup_reminder_days', '[7, 13]', 'Dagen waarop een herinnering gestuurd wordt'),
('topup_auto_block_threshold', '2', 'Aantal vervallen topups in 12mnd voordat lid geblokkeerd wordt'),
('idle_warning_seconds', '60', 'Seconden tot idle waarschuwing (kiosk)'),
('idle_reset_seconds', '100', 'Seconden tot idle reset (kiosk)'),
('epc_qr_payment_timeout_seconds', '90', 'Seconden wachten op EPC QR bevestiging'),
('low_stock_default_threshold', '10', 'Standaard drempel voor lage voorraad'),
('low_stock_batch_window_minutes', '30', 'Aantal minuten groeperen van voorraad waarschuwingen'),
('gdpr_consent_version', '"v1.0-2026-05"', 'Actieve GDPR toestemming versie'),
('club_name', '"Biljartclub Wortegem"', 'Naam van de club'),
('club_iban', '"BE00 0000 0000 0000"', 'IBAN van de club'),
('club_bic', '"GKCCBEBB"', 'BIC van de club'),
('club_beneficiary_name', '"Biljartclub Wortegem VZW"', 'Begunstigde naam (voor EPC)'),
('club_address_lines', '["Adres lijn 1", "Adres lijn 2"]', 'Adres'),
('transaction_retention_years', '7', 'Jaren om facturen te bewaren'),
('club_vat_number', '"BE 0000.000.000"', 'BTW nummer van de club'),
('default_vat_rate', '0.21', 'Standaard BTW tarief');

-- Sample members
INSERT INTO members (full_name, email, date_of_birth, gdpr_consent_at, gdpr_consent_version, preferred_topup_method) VALUES
('Jan Peeters', 'jan@example.com', '1980-05-12', now(), 'v1.0-2026-05', 'epc_qr'),
('Maria Janssens', 'maria@example.com', '1975-11-20', now(), 'v1.0-2026-05', 'email_invoice'),
('Piet Dierickx', 'piet@example.com', '1990-02-15', now(), 'v1.0-2026-05', 'epc_qr');

-- Give members test cards
INSERT INTO member_cards (member_id, card_identifier) VALUES
(1, 'CARD-JAN-001'),
(2, 'CARD-MARIA-001'),
(3, 'CARD-PIET-001');

-- Sample drinks
-- (Using category ids 1=Frisdranken, 2=Warme dranken, 3=Bieren, 4=Sterke dranken, 5=Snacks)
INSERT INTO drinks (name_nl, description_nl, category_id, image_path, purchase_price_excl_vat, sale_price_incl_vat, vat_rate, stock) VALUES
('Coca-Cola', 'Flesje 20cl', 1, 'cola.svg', 0.80, 2.00, 0.21, 24),
('Fanta Orange', 'Flesje 20cl', 1, 'fanta.svg', 0.80, 2.00, 0.21, 15),
('Lipton Ice Tea', 'Blikje 33cl', 1, 'icetea.svg', 0.90, 2.20, 0.21, 10),
('Water Plat', 'Chaudfontaine 25cl', 1, 'water.svg', 0.60, 1.80, 0.21, 30),
('Water Bruis', 'Chaudfontaine 25cl', 1, 'water_bruis.svg', 0.60, 1.80, 0.21, 25),
('Koffie', 'Zwarte koffie', 2, 'coffee.svg', 0.50, 1.50, 0.21, 100),
('Thee', 'Diverse smaken', 2, 'tea.svg', 0.40, 1.50, 0.21, 100),
('Stella Artois', 'Vat 25cl', 3, 'stella.svg', 1.00, 2.20, 0.21, 50),
('Duvel', 'Fles 33cl', 3, 'duvel.svg', 1.50, 3.50, 0.21, 20),
('Karmeliet', 'Fles 33cl', 3, 'karmeliet.svg', 1.60, 3.80, 0.21, 15),
('Chips Zout', 'Zakje 45g', 5, 'chips.svg', 0.70, 1.50, 0.06, 20),
('Chips Paprika', 'Zakje 45g', 5, 'chips_paprika.svg', 0.70, 1.50, 0.06, 18);

-- Add fake barcodes for testing
INSERT INTO drink_barcodes (drink_id, barcode, barcode_type) VALUES
(1, '5449000000996', 'EAN13'),
(2, '5449000011527', 'EAN13'),
(3, '8711200615598', 'EAN13'),
(8, '5410228141221', 'EAN13'),
(9, '5411681014005', 'EAN13'),
(11, '8710398600109', 'EAN13');
