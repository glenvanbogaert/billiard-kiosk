# Billiard Club Kiosk — Flows & Manager Runbook

This document covers two complementary things:

1. **Flow diagrams** — every path a user (member) and admin (manager) can take through the system, drawn as Mermaid flowcharts (semantic equivalent to BPMN, easier to read inline).
2. **Manager runbook** — concrete step-by-step procedures for every situation a manager will face, written so a non-technical person can follow them without help.

> **Architecture reminder.** The system runs on **two devices** connected over the LAN:
> - **Raspberry Pi 5** — headless, hosts all backend services (Postgres, kiosk web app, admin web app, worker, observability) in Docker Compose. Reachable on the LAN as `billiard-kiosk.local`.
> - **Windows PC** — drives the 20" wall-mounted touchscreen via **Microsoft Edge in Kiosk Mode** (Windows Assigned Access), pointed at the Pi. The USB barcode scanner is connected to the **PC**. The PC also continues to host the existing STid Mobile ID member-management tooling on a separate Windows user account; the kiosk function is isolated.

---

## Part 1 — User & Admin Flow Diagrams

### 1.1 Kiosk Idle → Drink Purchase (scan-first interaction)

The primary interaction is **scanning** the drink's barcode. Tapping the on-screen grid is a fallback. Both end up in the same cart with the same animation.

```mermaid
flowchart TD
    A([Idle screen]) --> B{Scan?}
    B -->|Member card| C[Validate card in DB]
    B -->|Drink barcode| Z1[Show: 'Scan eerst je lidkaart']
    Z1 --> A
    B -->|Unknown code| Z2[Toast: 'Onbekende code']
    Z2 --> A
    C --> D{Card valid<br/>& not blocked?}
    D -->|No| E[Show: 'Kaart geblokkeerd<br/>Contacteer beheerder']
    E --> A
    D -->|Yes| F[Load member<br/>Show name + balance<br/>Navigate to /menu]
    F --> G[Cart-prominent layout:<br/>drink grid left ~52%,<br/>cart right ~48%]
    G --> H{Member action?}
    H -->|Scan drink barcode| I[Match against drink_barcodes]
    H -->|Tap drink in grid| J[Add 1 to cart]
    H -->|Tap quantity stepper<br/>in cart| K[Adjust quantity]
    H -->|Tap red Verwijder| L[Remove cart line]
    H -->|Idle 60s| M[Show 'Are you still there?']
    H -->|Tap Afrekenen| Q[Cart review screen]
    H -->|Tap Saldo opladen| TOPUP[Route to /topup]
    I --> I2{Already in cart?}
    I2 -->|Yes| I3[Increment quantity<br/>Tick animation]
    I2 -->|No| I4[Add new line<br/>Fly-in animation]
    I3 --> I5[Toast: 'Toegevoegd: 2× Coca-Cola']
    I4 --> I5
    I5 --> H
    J --> J2{Already in cart?}
    J2 -->|Yes| I3
    J2 -->|No| I4
    K --> H
    L --> H
    M -->|No response 40s| Z3[Reset cart, return to idle]
    M -->|User taps continue| H
    Q --> R{Payment method?}
    R -->|Member card| S{Sufficient<br/>balance?}
    S -->|No| TOPUP
    S -->|Yes| T[Begin DB transaction]
    T --> U[Insert sale + sale_lines<br/>+ balance_transaction debit<br/>+ stock_transactions]
    U --> V[Commit transaction]
    V --> W[Receipt screen<br/>Show new balance]
    R -->|EPC QR| EPC1[Generate structured comm<br/>+ EPC QR]
    EPC1 --> EPC2[Insert sale as<br/>'pending_payment_unverified']
    EPC2 --> EPC3[Show QR + amount + comm]
    EPC3 --> EPC4{User confirms<br/>scanned & paid?}
    EPC4 -->|Yes| EPC5[Update stock]
    EPC5 --> W
    EPC4 -->|Cancel| Q
    EPC4 -->|Timeout 90s| EPC6[Mark sale 'abandoned']
    EPC6 --> A
    R -->|Cash| CASH1[Confirm modal:<br/>'Leg het bedrag in de kassa']
    CASH1 -->|Confirm| CASH2[Insert sale as 'paid_cash'<br/>Update stock]
    CASH1 -->|Cancel| Q
    CASH2 --> W
    W --> X{Email receipts<br/>opted in?}
    X -->|Yes| Y[Queue receipt email]
    X -->|No| Y2[Auto-return after 8s]
    Y --> Y2
    Y2 --> A
```

### 1.2 Top-up Flow (kiosk-initiated)

```mermaid
flowchart TD
    A([Member identified<br/>at kiosk]) --> B[Tap 'Saldo opladen']
    B --> C[Show amounts: €10/€20/€50/€100]
    C --> D[Member picks amount]
    D --> E{Method<br/>availability check}
    E -->|EPC available + email available| F[Show both options<br/>preferred method preselected]
    E -->|Outstanding email-invoice<br/>+ this amount > €50| F2[Show only EPC QR<br/>+ explanation:<br/>'Je hebt nog €X open<br/>Limiet €50']
    E -->|Member blocked<br/>from email-invoice| F2
    F --> G{Member picks method}
    F2 --> G2{Member confirms EPC}
    G -->|EPC QR| H[Generate structured comm]
    G2 -->|Yes| H
    H --> I[Insert top_up<br/>method=epc_qr<br/>status=pending_payment_unverified]
    I --> J[Show QR + comm + amount]
    J --> K{Member confirms paid?}
    K -->|Yes| L[Show 'Top-up gestart<br/>Saldo zichtbaar na verwerking']
    L --> M{Was checkout<br/>in progress?}
    M -->|Yes| N[Return to /menu with cart intact<br/>Note: 'wacht op betaling']
    M -->|No| A2([Return to idle])
    K -->|Timeout/cancel| A2
    G -->|Email invoice| O[Insert top_up<br/>method=email_invoice<br/>status=pending_payment_unverified<br/>expires_at=+14 days]
    O --> P[Queue email with<br/>bank instructions + comm]
    P --> Q[Show 'Mail verzonden<br/>Betaal binnen 14 dagen']
    Q --> M
```

### 1.3 EPC QR Reconciliation (CODA Import)

```mermaid
flowchart TD
    A([Manager downloads<br/>CODA from bank app]) --> B[Login to admin via Tailscale]
    B --> C[Navigate: Reconciliatie → Importeer CODA]
    C --> D[Upload .cod file]
    D --> D2{File SHA256<br/>already imported?}
    D2 -->|Yes| D3[Reject: 'Dit bestand is<br/>al geïmporteerd op DD-MM-YYYY']
    D3 --> Q([End])
    D2 -->|No| E[System parses CODA file]
    E --> F[Loop through transactions]
    F --> G{Structured comm<br/>matches a pending<br/>top_up or sale?}
    G -->|Match top-up<br/>still pending| H[Mark top_up 'paid_epc_verified'<br/>Insert balance_transaction credit<br/>Audit log entry]
    G -->|Match sale<br/>still pending| I[Mark sale 'paid_epc_verified'<br/>Audit log entry]
    G -->|Match but already paid<br/>likely manual mark-paid| J[Flag 'duplicate_already_paid'<br/>Notify admin to review]
    G -->|No match| K[Add to 'unmatched bank txns' queue]
    H --> L[Send confirmation email<br/>to member if opted in]
    I --> L
    J --> F
    L --> F
    K --> F
    F --> M[Import complete]
    M --> N[Show summary screen]
    N --> O{Manager reviews<br/>unmatched?}
    O -->|Yes| P[Manual match interface<br/>OR mark 'manual top-up'<br/>OR ignore as non-club]
    O -->|Skip| Q
    P --> Q
```

### 1.4 Admin: New Member Enrollment

```mermaid
flowchart TD
    A([Admin login + MFA]) --> B[Leden → Nieuw lid]
    B --> C[Form: name, email, DOB,<br/>preferred top-up method,<br/>email opt-in flags,<br/>opening balance]
    C --> D{Age >= 18?}
    D -->|No| E[Block save<br/>'Lid moet minimaal 18 jaar zijn']
    E --> C
    D -->|Yes| F[GDPR consent checkbox<br/>+ confirmation date captured]
    F --> G{Operating from<br/>kiosk PC or remote?}
    G -->|At kiosk PC| H[Click 'Scan kaart']
    G -->|Remote via Tailscale| H2[Click 'Voer kaart-ID in']
    H --> I[Wait for scanner input<br/>30s timeout]
    H2 --> I2[Free-text input field<br/>for card identifier]
    I --> J{Scan received?}
    J -->|No, timeout| K[Cancel and retry?]
    K -->|Yes| H
    K -->|No| L([Discard and exit])
    J -->|Yes| M{Card already<br/>in DB?}
    I2 --> M
    M -->|Yes, active| N[Block: 'Kaart is al toegewezen']
    N --> H
    M -->|Yes, lost/blocked| O[Warn admin<br/>Confirm reuse?]
    O -->|No| H
    O -->|Yes| P[Save member<br/>+ link card<br/>+ opening balance txn<br/>+ audit log]
    M -->|No| P
    P --> R[Optional: send welcome email]
    R --> S([Show member detail page])
```

### 1.5 Admin: Lost Card Replacement

```mermaid
flowchart TD
    A([Member reports<br/>lost card to manager]) --> B[Admin: Leden → Zoek lid]
    B --> C[Open member detail]
    C --> D[Click 'Vervang kaart']
    D --> E[Confirm action<br/>'Oude kaart wordt geblokkeerd']
    E -->|Cancel| F([Exit])
    E -->|Confirm| G[Mark old card<br/>status='lost'<br/>Audit log entry]
    G --> H{Operating from<br/>kiosk PC or remote?}
    H -->|At kiosk PC| I[Click 'Scan nieuwe kaart']
    H -->|Remote via Tailscale| I2[Manual card-ID input]
    I --> J[Wait for scanner 30s]
    J --> K{New scan?}
    K -->|Timeout| L[Show error<br/>old card stays 'lost']
    L --> M([Member must visit<br/>again with new card])
    K -->|Yes| N{Card in DB?}
    I2 --> N
    N -->|Yes, active on another member| O[Block: 'Kaart bestaat al']
    O --> I
    N -->|Yes, lost/blocked| P[Confirm reuse?]
    P -->|Yes| Q[Link new card to member<br/>Balance + history preserved<br/>Audit log entry]
    P -->|No| I
    N -->|No| Q
    Q --> R([Member can use<br/>new card immediately])
```

### 1.6 Admin: Manual Top-up Resolution (member paid offline)

```mermaid
flowchart TD
    A([Member paid via bank<br/>but CODA not yet imported<br/>OR paid in cash to manager]) --> B[Admin: Top-ups → Openstaand]
    B --> C[Find the top-up]
    C --> D{Found?}
    D -->|No| E[Create manual top-up<br/>method=manual_cash_admin<br/>auto-marked paid]
    E --> F[Audit log entry]
    F --> G([Balance updated])
    D -->|Yes| H[Click 'Markeer als betaald']
    H --> I[Required: select reason<br/>cash_handover/bank_verified_offline/other<br/>+ free-text note]
    I --> J[Update top_up.status='paid_manual_admin'<br/>Insert balance_transaction credit<br/>Audit log with reason]
    J --> G
```

### 1.7 Admin: Stock Restocking

```mermaid
flowchart TD
    A([Manager refills fridge]) --> B[Admin: Voorraad → Bijvullen]
    B --> C[List sorted by lowest stock first]
    C --> D[Tap drink to adjust]
    D --> E{Adjustment type?}
    E -->|Add stock| F[Enter quantity added]
    E -->|Correct stock<br/>physical count| G[Enter actual count]
    E -->|Remove damaged/expired| H[Enter quantity + reason]
    F --> I[Insert stock_transaction<br/>+amount, type=restock]
    G --> J[Compute delta<br/>Insert stock_transaction<br/>type=correction]
    H --> K[Insert stock_transaction<br/>-amount, type=write_off]
    I --> L[Update drinks.stock<br/>Audit log entry]
    J --> L
    K --> L
    L --> M{More drinks<br/>to adjust?}
    M -->|Yes| C
    M -->|No| N([Done])
```

### 1.8 Admin: Resolving a Risk-Flagged Member

```mermaid
flowchart TD
    A([Risk flag triggered<br/>via dashboard or alert]) --> B[Open Betalingsoverzicht → Risico]
    B --> C[Click flagged member]
    C --> D[See: outstanding amount,<br/>history of expired/late top-ups,<br/>payment ratio, contact info]
    D --> E{Manager decision}
    E -->|Member is reachable<br/>and willing to pay| F[Contact member<br/>via phone/email/in person]
    F --> G[Member pays]
    G --> H[Manual mark-paid flow<br/>see 1.6]
    H --> I[Optional: unblock member<br/>if previously auto-blocked]
    I --> Z([Resolved])
    E -->|Member unreachable<br/>or refusing| J{Severity?}
    J -->|Minor| K[Send formal reminder<br/>Wait]
    J -->|Major| L[Block member<br/>+ optionally write off debt<br/>+ document decision]
    L --> M[Insert balance adjustment<br/>type=write_off<br/>reason=irrecoverable]
    M --> Z
    E -->|Cards lost/stolen<br/>fraud suspected| N[Block all member's cards<br/>+ flag account<br/>+ document]
    N --> Z
```

### 1.9 Admin: Adding/Editing a Drink

```mermaid
flowchart TD
    A([Admin: Dranken → Nieuw of Bewerk]) --> B[Form fields]
    B --> C[Required: name, price excl VAT,<br/>VAT rate, category, photo,<br/>min stock threshold]
    C --> D[Optional: description<br/>NL note: not shown on kiosk<br/>but kept for admin reference]
    D --> E[Optional: active/inactive flag]
    E --> F[Click 'Voeg barcode toe']
    F --> G[Wait for scanner input<br/>OR manual barcode entry]
    G --> H{Scan received?}
    H -->|Yes| I{Barcode already<br/>linked to another drink?}
    I -->|Yes| J[Show conflict<br/>'Linked to X — overwrite?']
    J -->|Yes| K[Move barcode to this drink]
    J -->|No| F
    I -->|No| L[Add to drink_barcodes]
    H -->|Skip| M[Save without barcode]
    K --> N{More barcodes?}
    L --> N
    M --> O[Save drink<br/>Audit log entry]
    N -->|Yes| F
    N -->|No| O
    O --> P([Drink available on kiosk])
```

### 1.10 Admin: Settings Changes

```mermaid
flowchart TD
    A([Admin: Instellingen]) --> B{Section?}
    B -->|Bankgegevens & BTW| BV[Edit IBAN/BIC/<br/>beneficiary/BTW-nummer]
    B -->|Drempels & limieten| TH[Top-up cap, expiry, reminder days,<br/>idle timeout, stock threshold]
    B -->|Notificaties| NT[SMTP, ntfy.sh,<br/>weekly report recipients]
    B -->|Test Modus<br/>shown only when KIOSK_TEST_MODE=true| TM[Show test data toggle<br/>+ Reset test data button]
    B -->|Privacy & retentie| PR[Retention years<br/>GDPR consent version - read only]
    BV --> BV1[Validate IBAN mod-97]
    BV1 --> BV2{IBAN valid?}
    BV2 -->|No| BV3[Block: 'IBAN ongeldig']
    BV3 --> BV
    BV2 -->|Yes| BV4[Validate BTW format BE 0XXX.XXX.XXX]
    BV4 -->|Invalid| BV5[Block save]
    BV5 --> BV
    BV4 -->|Valid| BV6{Click 'Test EPC QR'?}
    BV6 -->|Yes| BV7[Render sample QR<br/>with current values]
    BV7 --> BV8[Manager scans with bank app<br/>verifies pre-fill, dismisses]
    BV8 --> BV9[Click Save]
    BV6 -->|No, just save| BV9
    BV9 --> Z[Save with audit log entry]
    TH --> Z
    NT --> NT1[Click 'Stuur test-mail'<br/>or 'Stuur test-notificatie']
    NT1 --> NT2{Test received?}
    NT2 -->|Yes| Z
    NT2 -->|No| NT3[Fix config and retry]
    NT3 --> NT
    TM --> TM1{Test action?}
    TM1 -->|Reset test data| TM2[Typed-confirmation modal]
    TM2 --> TM3[Wipe is_test=true rows<br/>Reset test stock<br/>Audit log]
    TM3 --> Z
    TM1 -->|Toggle visibility| Z
    PR --> Z
    Z --> END([Setting applied immediately])
```

### 1.11 System: Background Jobs (Cron)

```mermaid
flowchart TD
    subgraph Hourly
        H1([Every hour]) --> H2[Check pending top-ups]
        H2 --> H3{Past expires_at?}
        H3 -->|Yes| H4[Mark expired<br/>Send alert to admins<br/>Audit log]
        H3 -->|No, day 7| H5[Send reminder email]
        H3 -->|No, day 13| H5
        H4 --> H6[Check member: 2 expired<br/>in 12 months?]
        H6 -->|Yes| H7[Auto-block member<br/>Send admin alert]
    end
    subgraph Daily02:00
        D1([Daily 02:00]) --> D2[pg_dump → encrypt → upload to cloud]
        D2 --> D3[Verify upload]
        D3 --> D4[Rotate: keep 30 daily, 12 monthly]
        D4 --> D5[Send success or failure alert]
    end
    subgraph Daily07:00
        DM1([Daily 07:00]) --> DM2[Compute risk-flag digest]
        DM2 --> DM3{Any new flags<br/>since yesterday?}
        DM3 -->|Yes| DM4[Email + ntfy digest to admins]
        DM3 -->|No| DM5([Skip])
    end
    subgraph WeeklyMon08:00
        W1([Monday 08:00]) --> W2[Generate weekly report]
        W2 --> W3[Compile metrics + Excel attachment<br/>Filter is_test=false]
        W3 --> W4[Email to opted-in admins]
    end
    subgraph Continuous
        U1([Uptime Kuma every 30s]) --> U2{All services up?}
        U2 -->|No, 3 fails| U3[Alert via email + ntfy]
        K1([Kiosk heartbeat check<br/>every 2 minutes]) --> K2{Heartbeat<br/>within 2 min?}
        K2 -->|No| K3[Alert: 'Kiosk display unresponsive']
    end
```

### 1.12 High-Level Service Topology

```mermaid
flowchart LR
    subgraph PC[Windows PC — at kiosk station]
        EDGE[Microsoft Edge<br/>Kiosk Mode<br/>Assigned Access]
        SC[USB Barcode Scanner<br/>HID keyboard]
        TS[20 inch USB Touchscreen<br/>HDMI + USB-touch]
        STID[STid Mobile ID tooling<br/>separate Windows account]
    end
    subgraph LAN[Local network — ethernet preferred]
        NET[Switch / Router]
    end
    subgraph Pi[Raspberry Pi 5 — headless, on SSD]
        CADDY[Caddy reverse proxy]
        K_C[Kiosk container]
        A_C[Admin container]
        PG[(PostgreSQL)]
        WORKER[Worker container<br/>cron + email + ntfy]
        AVAHI[avahi-daemon<br/>billiard-kiosk.local]
        CF[Cloudflared<br/>disabled initially]
        subgraph Observability
            PROM[Prometheus]
            LOKI[Loki]
            PT[Promtail]
            GRAF[Grafana]
            UK[Uptime Kuma]
        end
    end
    subgraph External[External services]
        TAIL[Tailscale tunnel]
        BB[Backblaze B2 / Hetzner backups]
        SMTP[SMTP provider]
        NTFY[ntfy.sh]
        BANK[Bank app — manual CODA download]
    end
    SC -->|USB HID| EDGE
    TS -->|HDMI + USB| EDGE
    EDGE -->|HTTP over LAN| NET
    NET --> CADDY
    CADDY --> K_C
    CADDY --> A_C
    K_C --> PG
    A_C --> PG
    WORKER --> PG
    WORKER --> SMTP
    WORKER --> NTFY
    WORKER --> BB
    PT --> LOKI
    PROM --> GRAF
    LOKI --> GRAF
    UK --> SMTP
    UK --> NTFY
    A_C -. embed .-> GRAF
    Pi -.- TAIL
    BANK -. CODA file .-> A_C
    CF -.future.-> A_C
    AVAHI -.advertises.-> NET
```

### 1.13 Test Mode Flow

```mermaid
flowchart TD
    A([Sysadmin enables<br/>KIOSK_TEST_MODE=true<br/>in .env on Pi]) --> B[docker compose up -d<br/>--force-recreate kiosk]
    B --> C[Kiosk container restarts<br/>~30s downtime on PC]
    C --> D[Edge auto-recovers]
    D --> E[Kiosk shows yellow banner:<br/>'TEST MODUS — GEEN ECHTE TRANSACTIES']
    E --> F[Idle screen shows extra button:<br/>'Start als testlid']
    F --> G{User action}
    G -->|Tap 'Start als testlid'| H[Load synthetic member<br/>name='Test Lid' balance=€1000<br/>flag is_test=true]
    G -->|Real card scan| I[Normal real-member flow<br/>but reports filter is_test off]
    H --> J[Normal kiosk flows<br/>scan/tap drinks/checkout]
    J --> K[All records tagged is_test=true]
    K --> L[Stock decrements ARE real<br/>so stock-alert flow can be tested]
    L --> M[Reports/dashboards filter<br/>is_test=true rows by default]
    M --> N{Done testing?}
    N -->|Reset test data| O[Admin: Instellingen → Test Modus<br/>'Reset test data']
    O --> P[Typed confirmation]
    P --> Q[Wipe all is_test=true rows<br/>Reset test drink stock<br/>Audit log entry]
    Q --> R{Disable test mode?}
    R -->|Yes| S[Sysadmin sets<br/>KIOSK_TEST_MODE=false<br/>+ container restart]
    S --> T[Banner disappears<br/>'Start als testlid' button gone]
    T --> END([Production mode])
    R -->|No, keep testing| J
    N -->|Continue testing| J
```

### 1.14 Network Connectivity Loss (PC ↔ Pi)

```mermaid
flowchart TD
    A([Member shopping<br/>on kiosk]) --> B[Network blip<br/>cable, switch, Pi reboot, etc.]
    B --> C[Service Worker /api/health<br/>probe fails 2× in a row<br/>~20s]
    C --> D[Show banner:<br/>'Geen verbinding — probeer opnieuw']
    D --> E[Disable payment buttons]
    E --> F[Cart contents preserved<br/>in localStorage]
    F --> G[Member can still scan/tap<br/>add items to cart UI<br/>but cannot checkout]
    G --> H{Connection restored?}
    H -->|Yes| I[Probe succeeds<br/>banner clears]
    I --> J[Re-enable payment buttons]
    J --> K[Member can resume<br/>checkout normally]
    K --> END([Resumed])
    H -->|Still down after 60s| L[App still shows banner<br/>Member should ask manager]
    L --> M[Manager checks Pi:<br/>see runbook 2.13]
    M --> H
```

---

## Part 2 — Manager Runbook

> **Audience:** non-technical managers of the billiard club. Each procedure is short, numbered, and uses the same Dutch labels as the admin UI.

### 2.1 First-time setup (one-time, by main admin)

1. Receive Tailscale invitation email from system administrator.
2. Install Tailscale app on phone or laptop. Sign in with the email used in the invitation.
3. Once connected, open a browser and go to `https://admin.<tailnet>.ts.net` (exact URL provided by sysadmin).
4. Log in with provided email + initial password.
5. **Change password immediately** at *Mijn account → Wachtwoord*.
6. Set up MFA at *Mijn account → MFA*. Scan QR with Google Authenticator / Microsoft Authenticator / Authy.
7. Verify MFA works by logging out and back in.

---

### 2.2 Adding a new member

1. *Leden → Nieuw lid*.
2. Fill in: name, email, date of birth (must be ≥18), opening balance (usually €0).
3. Choose preferred top-up method (EPC QR is recommended).
4. Toggle email-receipts opt-in (member's preference).
5. Tick the GDPR consent checkbox **only after** the member has signed the paper form / verbally confirmed.
6. Click *Scan kaart* and scan the new STid QR within 30 seconds.
   - If you're working remotely (not at the kiosk PC), use *Voer kaart-ID in* and type the code.
7. Click *Opslaan*.
8. (Optional) Click *Stuur welkomstmail* to send the member their privacy notice + first-login link if applicable.

---

### 2.3 Member lost their card

1. *Leden → Zoek lid* → find by name or email.
2. Open member detail.
3. Click *Vervang kaart*.
4. Confirm "Oude kaart wordt geblokkeerd" — this is irreversible.
5. Click *Scan nieuwe kaart* and scan within 30 seconds.
6. Done. Balance and history are preserved on the new card.
7. Tell the member: "Je oude kaart werkt niet meer, gebruik de nieuwe."

> If the lost card is later found, do **not** unblock it. Always issue a new card.

---

### 2.4 Member paid via bank but balance not updated

This usually means the CODA file hasn't been imported yet. Do this:

1. *Reconciliatie → Importeer CODA*.
2. Download the latest CODA from the club's bank app (KBC / Belfius / Argenta — usually under "Documenten" or "Rekeninguittreksels").
3. Upload the `.cod` file.
4. Wait for parsing (a few seconds).
5. Review summary: matched / unmatched.
6. If member's payment is now matched → done.
7. If still unmatched, see **2.5**.

---

### 2.5 Member says they paid, but no matching bank entry

Possible causes: wrong structured communication, wrong amount, transfer still in flight (1-2 business days for some banks), or the member is mistaken.

1. Ask the member to send you a screenshot of the transfer.
2. *Top-ups → Openstaand* → find the top-up.
3. If the screenshot proves payment but bank hasn't shown it yet, click *Markeer als betaald*.
4. Reason: select *bank_verified_offline*. Add note with the date the member showed proof.
5. Save. Balance updates immediately.
6. When the next CODA is imported, the system will detect the duplicate (same structured communication paid twice) and flag it for your review — usually nothing to do, but it's auditable.

---

### 2.6 Member paid in cash for a top-up

1. Take the cash, put it in the secure box.
2. *Top-ups → Nieuw handmatig top-up*.
3. Select member → enter amount → method *manual_cash_admin*.
4. Add note (optional, e.g. "Ontvangen op zaterdag avond").
5. Save. Balance updates immediately.

---

### 2.7 Resolving a risk-flagged member

The dashboard *Betalingsoverzicht → Risico* shows members who have payment problems.

1. Click on the flagged member.
2. Review their history: total outstanding €, expired top-ups, payment ratio.
3. Decide:
   - **Understanding case** (forgot, traveling, etc.): contact them. Once paid, follow **2.5** or **2.6**, then *Deblokkeer lid* if blocked.
   - **Unreachable / refusing**: send a formal reminder email via *Stuur herinnering*. Wait 14 days.
   - **Confirmed bad debt**: *Lid → Acties → Schuld afschrijven*. Enter amount and reason. The member is auto-blocked. Document decision.
4. All actions are logged in the audit trail.

---

### 2.8 Restocking the fridges

1. Refill the fridges.
2. *Voorraad → Bijvullen*.
3. Drinks are sorted by lowest stock first.
4. For each drink you added, tap → enter quantity added → save.
5. Optional: do a physical count once a month using *Correctie* mode — system computes the delta automatically.

---

### 2.9 A drink price changes

1. *Dranken → bewerk*.
2. Change *Verkoopprijs incl. BTW* (or excl. + VAT rate, system computes the other).
3. Save. Audit log entry created.
4. Existing sales history is unaffected (prices are snapshotted per sale).

---

### 2.10 Adding a new drink

1. *Dranken → Nieuw*.
2. Fill in: name, description (optional, **not shown on the kiosk**, kept for admin reference), category, buying price, selling price, VAT rate, photo, initial stock, low-stock threshold.
3. Click *Voeg barcode toe* and scan all variants of the product. The barcode scanner is connected to the **kiosk PC**, so this step is easiest done at the kiosk station. If you're remote, you can manually type the barcode digits.
4. Save. Drink appears on the kiosk immediately if marked active.

---

### 2.11 Stock alert received (email or ntfy)

1. The alert lists the drinks below threshold.
2. Plan a refill. No urgent system action needed.
3. After refilling, follow **2.8**.

---

### 2.12 The kiosk display shows an error / is frozen

In order:

1. **Wait 30 seconds.** Microsoft Edge auto-relaunches on crash via Windows Assigned Access. Most issues recover on their own.
2. **Tap the screen** to wake it up if the display has gone dark.
3. **If still frozen after 1 minute**, do a clean PC restart:
   - If touchscreen still responds: bottom-corner of screen, swipe to access Windows actions, choose Restart. (If Edge Kiosk Mode hides this, see step 4.)
   - Otherwise: press the PC's physical power button briefly (do **not** hold it). Windows will perform a graceful restart. The PC will auto-login and Edge will relaunch into kiosk mode.
4. **If the PC is fully unresponsive**, hold the PC's physical power button for 10 seconds to force off. Wait 5 seconds. Press once to power on. Auto-login and Edge will restart.
5. **If still broken after PC restart**, the Pi may be the issue. Continue with **2.13** to check network/Pi.
6. **If everything looks broken**, contact sysadmin via the support channel. Mention: time it started, what was happening, any error message text.

> The kiosk being down does not affect the database or admin app. Admin remains accessible via Tailscale from anywhere.

---

### 2.13 The kiosk shows "Geen verbinding"

This means the PC's Edge can't reach the Pi.

1. Check the Pi is powered on (LED visible on the Pi, fan running if applicable).
2. Check the cable between the Pi and the network switch / router. Reseat it on both ends.
3. Check the Pi's ethernet LED is lit.
4. If using WiFi instead of ethernet (not recommended), verify the WiFi router is on and reachable.
5. Wait 60 seconds. The Service Worker auto-recovers when connectivity returns.
6. If still no connection, restart the Pi by unplugging power for 10 seconds and plugging back in. Wait 90 seconds for it to boot.
7. If still broken after Pi restart, contact sysadmin.

> The kiosk app shows "Geen verbinding" within ~20 seconds of losing the Pi. Cart contents are preserved — the member doesn't lose what they added once connection comes back.

---

### 2.14 Weekly report didn't arrive Monday morning

1. Check email spam folder.
2. *Rapporten → Wekelijks rapport → Stuur nu* — sends today's report immediately.
3. *Instellingen → Notificaties → Rapport ontvangers* — verify your email is ticked.
4. If button doesn't work, contact sysadmin.

---

### 2.15 Adding a new manager / admin user

1. *Beheerders → Nieuwe beheerder*.
2. Enter their email and name. System sends them an invite with a one-time link.
3. They follow **2.1** themselves.
4. Decide whether they should receive the weekly report (toggle).

---

### 2.16 Removing a manager

1. *Beheerders → bewerk*.
2. Click *Deactiveer*.
3. Confirm. They lose access immediately. Audit log shows their previous actions.

> Don't fully delete admins — deactivation preserves the audit trail.

---

### 2.17 GDPR data request from a member

**Member asks for their data:**

1. *Leden → bewerk → GDPR → Exporteer data*.
2. System generates a JSON file with all their data.
3. Download and email to the member (use a secure method, not plain email if possible).

**Member asks to be deleted:**

1. *Leden → bewerk → GDPR → Anonimiseer*.
2. Member's name → "Geanonimiseerd lid #1234". Email cleared. DOB cleared. Card unlinked.
3. Sales remain in the database for 7-year accounting retention but are no longer linked to a person.
4. Audit log entry created.

---

### 2.18 End-of-month reconciliation checklist

Once a month, ideally first week:

1. Download last month's CODA from the bank.
2. *Reconciliatie → Importeer CODA*.
3. Review unmatched bank transactions. Manually resolve any genuine club payments that didn't auto-match.
4. *Rapporten → Maandrapport* → download Excel for accountant.
5. Send Excel + bank statement to accountant.

---

### 2.19 Backup recovery (rare, sysadmin-led)

This is a sysadmin task, but as a manager you should know:

- Backups run nightly to encrypted cloud storage.
- 30 daily + 12 monthly retention.
- If the Pi is destroyed, sysadmin can restore the entire system to a new Pi in ~30 minutes. The Windows PC keeps working as before — only the URL changes if needed.
- Restore procedure is documented in the technical README and **must be tested at least once a year**.

If something looks lost (e.g. a member says their balance dropped without reason), don't restore — just check the audit log first via *Logboek*.

---

### 2.20 Switching between kiosk and STid manager account on the PC

The PC hosts two functions on two separate Windows accounts:

- A **`kiosk` account** — auto-login, locked to Edge Kiosk Mode showing the drink kiosk.
- A **`manager` account** — used for STid Mobile ID member management (door access).

**To do STid work:**

1. At the kiosk screen, press **Ctrl+Alt+Del** on the PC's keyboard (or **Win+L** to lock).
2. Choose **Switch user** or **Sign in as another user**.
3. Choose the manager account, enter password.
4. Do your STid work normally.
5. **Sign out fully** when done (Start menu → user icon → Sign out — *do not* just lock or switch user).
6. The PC auto-logs back into the kiosk account within seconds.
7. Edge Kiosk Mode resumes automatically. The kiosk screen returns.

> Always sign out fully. Leaving multiple sessions logged in wastes PC memory and can cause problems for the kiosk.

---

### 2.21 Updating the club's bank account or VAT details

When the club's IBAN, BIC, beneficiary name, or BTW-nummer change (e.g. switching banks):

1. *Instellingen → Bankgegevens & BTW*.
2. Update the relevant fields.
   - **IBAN** is validated automatically — you'll get an error if you mistype.
   - **BTW-nummer** is checked against Belgian format `BE 0XXX.XXX.XXX`.
3. Click *Test EPC QR genereren*. A sample QR appears.
4. Scan the sample QR with your bank app. Verify it pre-fills with the new IBAN, beneficiary, etc. **Do not confirm the transfer in the bank app — just check it pre-filled correctly and dismiss.**
5. Click *Opslaan*.
6. Audit log entry created.

> **Important:** any EPC QR sales already pending (status `pending_payment_unverified`) still reference the **old** bank details when their members eventually pay. This is correct — the QR was generated for those specific transactions before the change. New sales after this point use the new details.
>
> If the bank account fully closes, contact sysadmin to coordinate — old structured communications may not reconcile via CODA from the new account.

---

### 2.22 Using test mode (demonstrations, training, QA)

Test mode is for:
- Demonstrating the system to new managers without using a real card.
- Training scenarios.
- Sanity-checking after an update.

**Enabling test mode** requires the sysadmin (it's a server-side flag, not a user setting). They'll set `KIOSK_TEST_MODE=true` in the Pi's configuration and restart the kiosk container. Takes about 30 seconds.

**While test mode is active:**
- A persistent yellow banner across the top of every kiosk screen reads **"TEST MODUS — GEEN ECHTE TRANSACTIES"**.
- The idle screen shows an extra button: **"Start als testlid"**.
- Tap *Start als testlid* to begin a test session. You become "Test Lid" with a €1000 balance and can scan, tap, checkout, top up — anything a real member can do.
- Real cards still work alongside, so you can also test the real-member path.

**During test mode, all test transactions are tagged in the database.** Reports and risk dashboards filter them out by default. To see test data in reports, enable *Instellingen → Test Modus → Toon test data*.

**Stock decrements are real** — this is on purpose so you can test the stock alert flow. To reset:
- *Instellingen → Test Modus → Reset test data*.
- Typed confirmation required.
- Wipes all test members, sales, top-ups, balance entries; resets test drink stock.

**Disabling test mode:**
- Tell sysadmin. They flip the flag back and restart. The yellow banner disappears.

> **Never leave test mode on in production.** The yellow banner is your safety check — if you see it during normal hours, something is wrong. Contact sysadmin.

---

### 2.23 Quick cheat sheet — "what do I do if…"

| Situation | Action |
|---|---|
| New member walks in | 2.2 |
| Member lost card | 2.3 |
| Member's bank payment not showing | 2.4 → 2.5 |
| Member paid cash for top-up | 2.6 |
| Risk-flag dashboard shows red | 2.7 |
| Fridges empty | 2.8 |
| Need to change a drink price | 2.9 |
| Adding a new drink to the menu | 2.10 |
| Got a low-stock alert | 2.11 |
| Touchscreen frozen | 2.12 |
| Kiosk says "Geen verbinding" | 2.13 |
| Weekly report missing | 2.14 |
| Onboarding a co-manager | 2.15 |
| Removing a co-manager | 2.16 |
| Member GDPR request | 2.17 |
| Monthly close | 2.18 |
| System destroyed / catastrophic loss | 2.19 — call sysadmin |
| Need to use the PC for STid work | 2.20 |
| Bank account / VAT details changed | 2.21 |
| Demo or training the system | 2.22 |

---

## Part 3 — Notes for the Antigravity prompt

When we draft the Antigravity prompt, the following items from this document need to translate into actual built features (not just docs):

- Every screen, button label, and Dutch microcopy referenced in the runbook must exist in the admin app or kiosk app.
- Each cron job in 1.11 must be implemented in the worker container.
- The risk-flag algorithm in 1.8 must be coded with the exact thresholds discussed.
- The audit log must capture every action listed across runbook sections 2.2–2.22.
- The reconciliation flow (1.3) must include the manual-match interface and duplicate-already-paid detection.
- The settings page (1.10) must surface every configurable threshold AND the Bankgegevens & BTW section with IBAN/BTW validation and the *Test EPC QR genereren* preview button.
- The GDPR export and anonymize flows (2.17) must be implemented as actual endpoints.
- The test mode flow (1.13, 2.22) must be implemented including the persistent banner, *Start als testlid* button, `is_test=true` tagging on members/sales/top-ups/balance_transactions, default report filtering, and *Reset test data* admin action.
- The connectivity-loss handling (1.14) must be implemented via Service Worker plus disabled payment buttons while the banner is active.
- The drink description field stays in the database but never renders on the kiosk drink tile.
- Both kiosk and admin scan flows must support manual-input fallback for managers operating remotely (without scanner access).

The flow diagrams and runbook themselves are reference documentation — they go alongside the built system, not into it.
