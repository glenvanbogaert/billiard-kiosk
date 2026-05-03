<script lang="ts">
    import { enhance } from '$app/forms';
    let { data, form } = $props();

    let showAddForm = $state(false);
    let editingId  = $state<string | null>(null);

    const fmtPrice = (v: number | string) => `€${parseFloat(v as string).toFixed(2)}`;
    const fmtDate  = (d: string | Date) => new Date(d).toLocaleDateString('nl-BE');
    // Format date for <input type="date"> value (YYYY-MM-DD)
    const isoDate  = (d: string | Date) => new Date(d).toISOString().split('T')[0];

    $effect(() => {
        if (form?.success) showAddForm = false;
        if (form?.updated) editingId = null;
    });
</script>

<article>
    <header style="display:flex;justify-content:space-between;align-items:center;">
        <h2>Leden</h2>
        <button onclick={() => showAddForm = !showAddForm}>
            {showAddForm ? 'Annuleren' : '+ Nieuw Lid'}
        </button>
    </header>

    {#if form?.error}
        <p class="msg-error">{form.error}</p>
    {/if}
    {#if form?.success}
        <p class="msg-ok">Lid succesvol toegevoegd!</p>
    {/if}
    {#if form?.updated}
        <p class="msg-ok">Lid bijgewerkt!</p>
    {/if}

    <!-- ── ADD FORM ── -->
    {#if showAddForm}
        <article class="sub-card">
            <h3>Nieuw Lid Toevoegen</h3>
            <form method="POST" action="?/addMember" use:enhance>
                <div class="grid">
                    <label>Volledige Naam *<input type="text" name="fullName" required placeholder="Jan Peeters" /></label>
                    <label>Email<input type="email" name="email" placeholder="jan@example.com" /></label>
                </div>
                <div class="grid">
                    <label>Geboortedatum *<input type="date" name="dateOfBirth" required /></label>
                    <label>Kaartnummer (optioneel)<input type="text" name="cardIdentifier" placeholder="CARD-XXX-001" /></label>
                </div>
                <button type="submit">Lid Toevoegen</button>
            </form>
        </article>
    {/if}

    <!-- ── MEMBERS TABLE ── -->
    <div class="overflow-auto">
        <table class="striped">
            <thead>
                <tr>
                    <th>Naam</th>
                    <th>Email</th>
                    <th>Geboortedatum</th>
                    <th>Status</th>
                    <th>Saldo</th>
                    <th>Opwaardeer Methode</th>
                    <th style="width:110px;"></th>
                </tr>
            </thead>
            <tbody>
                {#each data.members as member (member.id)}
                    {#if editingId === member.id}
                        <!-- ── EDIT ROW ── -->
                        <tr class="edit-row">
                            <td colspan="7" style="padding:1rem;">
                                <form method="POST" action="?/updateMember" use:enhance>
                                    <input type="hidden" name="memberId" value={member.id} />
                                    <div class="grid">
                                        <label>Volledige Naam *<input type="text" name="fullName" value={member.full_name} required /></label>
                                        <label>Email<input type="email" name="email" value={member.email ?? ''} /></label>
                                    </div>
                                    <div class="grid">
                                        <label>Geboortedatum *<input type="date" name="dateOfBirth" value={isoDate(member.date_of_birth)} required /></label>
                                        <label>Status
                                            <select name="status">
                                                <option value="active"  selected={member.status === 'active'}>Actief</option>
                                                <option value="blocked" selected={member.status === 'blocked'}>Geblokkeerd</option>
                                            </select>
                                        </label>
                                        <label>Opwaardeer Methode
                                            <select name="preferredTopupMethod">
                                                <option value="epc_qr"       selected={member.preferred_topup_method === 'epc_qr'}>QR-code</option>
                                                <option value="email_invoice" selected={member.preferred_topup_method === 'email_invoice'}>Per mail</option>
                                            </select>
                                        </label>
                                    </div>
                                    <div class="edit-actions">
                                        <button type="button" class="secondary outline" onclick={() => editingId = null}>Annuleren</button>
                                        <button type="submit">Opslaan</button>
                                    </div>
                                </form>
                            </td>
                        </tr>
                    {:else}
                        <!-- ── VIEW ROW ── -->
                        <tr>
                            <td><strong>{member.full_name}</strong></td>
                            <td>{member.email || '—'}</td>
                            <td>{fmtDate(member.date_of_birth)}</td>
                            <td>
                                <span class="badge {member.status === 'active' ? 'badge-ok' : 'badge-err'}">
                                    {member.status}
                                </span>
                            </td>
                            <td class={parseFloat(member.cached_balance) < 0 ? 'text-warn' : 'text-ok'}>
                                {fmtPrice(member.cached_balance)}
                            </td>
                            <td>{member.preferred_topup_method === 'epc_qr' ? 'QR-code' : 'Per mail'}</td>
                            <td>
                                <button class="outline btn-sm" onclick={() => editingId = member.id}>Aanpassen</button>
                            </td>
                        </tr>
                    {/if}
                {/each}
            </tbody>
        </table>
    </div>
</article>

<style>
    .sub-card { border: 1px solid var(--pico-muted-border-color); padding: 1.5rem; margin-bottom: 1rem; }
    .msg-ok    { color: var(--color-success); }
    .msg-error { color: var(--color-error); }
    .text-warn { color: var(--color-error); font-weight: bold; }
    .text-ok   { color: var(--color-success); }

    .badge { padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8em; color: white; }
    .badge-ok  { background: var(--color-success); }
    .badge-err { background: var(--color-error); }

    .btn-sm { padding: 0.2rem 0.6rem; font-size: 0.82rem; margin: 0; }

    .edit-row td { background: #f0f4ff; border-left: 4px solid var(--color-primary); }
    .edit-row label { font-size: 0.85rem; }
    .edit-row input, .edit-row select { padding: 0.35rem 0.5rem; font-size: 0.9rem; margin-bottom: 0.4rem; }

    .edit-actions { display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1rem; }
    .edit-actions button { min-width: 100px; }
</style>
