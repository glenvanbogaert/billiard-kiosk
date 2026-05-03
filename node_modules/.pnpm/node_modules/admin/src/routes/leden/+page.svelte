<script lang="ts">
    import { enhance } from '$app/forms';
    let { data, form } = $props();
    let showAddForm = $state(false);
    const formatPrice = (price: number | string) => `€${parseFloat(price as string).toFixed(2)}`;
</script>

<article>
    <header style="display: flex; justify-content: space-between; align-items: center;">
        <h2>Leden</h2>
        <button onclick={() => showAddForm = !showAddForm}>
            {showAddForm ? 'Annuleren' : '+ Nieuw Lid'}
        </button>
    </header>

    {#if form?.error}
        <p style="color: var(--color-error);">{form.error}</p>
    {/if}

    {#if form?.success}
        <p style="color: var(--color-success);">Lid succesvol toegevoegd!</p>
    {/if}

    {#if showAddForm}
        <article style="border: 1px solid var(--pico-muted-border-color); padding: 1.5rem; margin-bottom: 1rem;">
            <h3>Nieuw Lid Toevoegen</h3>
            <form method="POST" action="?/addMember" use:enhance>
                <div class="grid">
                    <label>
                        Volledige Naam *
                        <input type="text" name="fullName" required placeholder="Jan Peeters" />
                    </label>
                    <label>
                        Email
                        <input type="email" name="email" placeholder="jan@example.com" />
                    </label>
                </div>
                <div class="grid">
                    <label>
                        Geboortedatum *
                        <input type="date" name="dateOfBirth" required />
                    </label>
                    <label>
                        Kaartnummer (optioneel)
                        <input type="text" name="cardIdentifier" placeholder="CARD-XXX-001" />
                    </label>
                </div>
                <button type="submit">Lid Toevoegen</button>
            </form>
        </article>
    {/if}
    
    <div class="overflow-auto">
        <table class="striped">
            <thead>
                <tr>
                    <th>Naam</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Saldo</th>
                    <th>Opwaardeer Methode</th>
                </tr>
            </thead>
            <tbody>
                {#each data.members as member}
                    <tr>
                        <td><strong>{member.full_name}</strong></td>
                        <td>{member.email || '—'}</td>
                        <td>
                            <span class="badge {member.status === 'active' ? 'success' : 'error'}">
                                {member.status}
                            </span>
                        </td>
                        <td class={parseFloat(member.cached_balance) < 0 ? 'text-error' : 'text-success'}>
                            {formatPrice(member.cached_balance)}
                        </td>
                        <td>{member.preferred_topup_method}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
</article>

<style>
    .badge { padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8em; }
    .success { background-color: var(--color-success); color: white; }
    .error { background-color: var(--color-error); color: white; }
    .text-error { color: var(--color-error); font-weight: bold; }
    .text-success { color: var(--color-success); }
</style>
