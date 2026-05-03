<script lang="ts">
    import { enhance } from '$app/forms';
    let { data, form } = $props();

    const s = data.settings;

    // Helper: get value with fallback
    function val(key: string, fallback = '') {
        return s[key]?.value ?? fallback;
    }

    function desc(key: string) {
        return s[key]?.description ?? '';
    }

    let savedKey = $state<string | null>(null);
    $effect(() => {
        if (form?.saved) {
            savedKey = form.saved;
            setTimeout(() => savedKey = null, 2500);
        }
    });
</script>

<article>
    <header><h2>Instellingen</h2></header>

    {#if form?.error}
        <p class="msg-error">{form.error}</p>
    {/if}

    <!-- ──────────────────────────────────── BANKGEGEVENS ──── -->
    <section class="settings-section">
        <h3>🏦 Bankgegevens &amp; EPC</h3>
        <p class="section-desc">
            Deze gegevens worden gebruikt voor het genereren van EPC QR-codes bij betalingen en opwaarderingen.
        </p>
        <div class="settings-grid">
            {#each [
                { key: 'club_beneficiary_name', label: 'Naam begunstigde', type: 'text', placeholder: 'Biljartclub Ons Dorp vzw' },
                { key: 'club_iban', label: 'IBAN', type: 'text', placeholder: 'BE12 3456 7890 1234' },
                { key: 'club_bic', label: 'BIC (optioneel)', type: 'text', placeholder: 'GEBABEBB' },
            ] as field}
                <div class="setting-row {savedKey === field.key ? 'flash' : ''}">
                    <form method="POST" action="?/saveSetting" use:enhance>
                        <input type="hidden" name="key" value={field.key} />
                        <label>
                            {field.label}
                            {#if s[field.key]?.description}
                                <small>{s[field.key].description}</small>
                            {/if}
                            <input type={field.type} name="value" value={val(field.key)} placeholder={field.placeholder} />
                        </label>
                        <button type="submit" class="outline btn-save">Opslaan</button>
                    </form>
                </div>
            {/each}
        </div>
    </section>

    <!-- ──────────────────────────────────── LIMIETEN ──── -->
    <section class="settings-section">
        <h3>⚙️ Drempels &amp; Limieten</h3>
        <p class="section-desc">
            Configureer operationele limieten voor opwaarderingen.
        </p>
        <div class="settings-grid">
            {#each [
                { key: 'topup_outstanding_cap_eur', label: 'Max. openstaand saldo per factuur (€)', type: 'number', placeholder: '50' },
            ] as field}
                <div class="setting-row {savedKey === field.key ? 'flash' : ''}">
                    <form method="POST" action="?/saveSetting" use:enhance>
                        <input type="hidden" name="key" value={field.key} />
                        <label>
                            {field.label}
                            {#if s[field.key]?.description}
                                <small>{s[field.key].description}</small>
                            {/if}
                            <input type={field.type} name="value" value={val(field.key)} step="1" min="0" placeholder={field.placeholder} />
                        </label>
                        <button type="submit" class="outline btn-save">Opslaan</button>
                    </form>
                </div>
            {/each}
        </div>
    </section>

    <!-- ──────────────────────────────────── NOTIFICATIES ──── -->
    <section class="settings-section">
        <h3>🔔 Notificaties (Lage Voorraad)</h3>
        <p class="section-desc">
            E-mailadressen of ntfy.sh topics die een melding krijgen als een drank onder de drempel zakt.
        </p>
        <div class="settings-grid">
            {#each [
                { key: 'notification_low_stock_email', label: 'E-mailadres(sen) (kommagescheiden)', type: 'email', placeholder: 'beheerder@club.be' },
                { key: 'notification_low_stock_ntfy', label: 'ntfy.sh topic', type: 'text', placeholder: 'mijn-club-alerts' },
            ] as field}
                <div class="setting-row {savedKey === field.key ? 'flash' : ''}">
                    <form method="POST" action="?/saveSetting" use:enhance>
                        <input type="hidden" name="key" value={field.key} />
                        <label>
                            {field.label}
                            {#if s[field.key]?.description}
                                <small>{s[field.key].description}</small>
                            {/if}
                            <input type={field.type} name="value" value={val(field.key)} placeholder={field.placeholder} />
                        </label>
                        <button type="submit" class="outline btn-save">Opslaan</button>
                    </form>
                </div>
            {/each}
        </div>
    </section>

    <!-- ──────────────────────────────────── READ-ONLY INFO ──── -->
    <section class="settings-section info-section">
        <h3>ℹ️ Kiosk Omgevingsvariabelen</h3>
        <p>
            De volgende instellingen worden beheerd via het <code>.env</code>-bestand in de root van het project
            en vereisen een herstart om door te voeren:
        </p>
        <ul>
            <li><code>PUBLIC_CLUB_NAME</code> — Naam van de club (kiosk header)</li>
            <li><code>KIOSK_TEST_MODE</code> — Test-modus voor de kiosk (true/false)</li>
            <li><code>SESSION_SECRET</code> — Geheime sleutel voor sessies</li>
            <li><code>SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD</code> — E-mailserver configuratie</li>
            <li><code>NTFY_SERVER / NTFY_TOPIC</code> — ntfy.sh push-notificaties</li>
        </ul>
    </section>
</article>

<style>
    .msg-error { color: var(--color-error); }

    .settings-section {
        margin-bottom: 2rem;
        padding: 1.5rem;
        border: 1px solid var(--pico-muted-border-color);
        border-radius: 8px;
    }
    .settings-section h3 { margin-top: 0; }
    .section-desc { font-size: 0.9rem; color: #555; margin-bottom: 1.25rem; }

    .settings-grid { display: flex; flex-direction: column; gap: 0.75rem; }

    .setting-row form {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 1rem;
        align-items: end;
    }
    .setting-row label { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.9rem; margin: 0; }
    .setting-row label small { color: #888; font-size: 0.78rem; }
    .setting-row input { margin: 0; padding: 0.4rem 0.6rem; }

    .btn-save { white-space: nowrap; height: fit-content; padding: 0.45rem 1rem; margin: 0; }

    @keyframes flash-green {
        0%   { background: #d4edda; }
        100% { background: transparent; }
    }
    .flash { animation: flash-green 2s ease-out; border-radius: 6px; }

    .info-section { background: #f9f9f9; }
    .info-section code { background: #e8e8e8; padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.85rem; }
    .info-section ul { padding-left: 1.5rem; }
    .info-section li { margin-bottom: 0.3rem; font-size: 0.9rem; }
</style>
