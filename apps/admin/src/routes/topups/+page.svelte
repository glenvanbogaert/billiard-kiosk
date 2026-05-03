<script lang="ts">
    import { enhance } from '$app/forms';
    let { data, form } = $props();
    const formatPrice = (price: number | string) => `€${parseFloat(price as string).toFixed(2)}`;
    const formatDate = (date: string) => new Date(date).toLocaleString('nl-BE');
</script>

<article>
    <header style="display: flex; justify-content: space-between; align-items: center;">
        <h2>Top-ups</h2>
    </header>

    {#if form?.error}
        <p style="color: var(--color-error);">{form.error}</p>
    {/if}

    {#if form?.success}
        <p style="color: var(--color-success);">Top-up succesvol gemarkeerd als betaald!</p>
    {/if}
    
    {#if data.topups.length === 0}
        <p>Geen top-ups gevonden.</p>
    {:else}
        <div class="overflow-auto">
            <table class="striped">
                <thead>
                    <tr>
                        <th>Datum</th>
                        <th>Lid</th>
                        <th>Bedrag</th>
                        <th>Methode</th>
                        <th>Status</th>
                        <th>Acties</th>
                    </tr>
                </thead>
                <tbody>
                    {#each data.topups as topup}
                        <tr>
                            <td>{formatDate(topup.initiated_at)}</td>
                            <td><strong>{topup.full_name}</strong></td>
                            <td>{formatPrice(topup.amount)}</td>
                            <td>{topup.method}</td>
                            <td>
                                <span class="badge {topup.status.startsWith('paid') ? 'success' : 'warning'}">
                                    {topup.status}
                                </span>
                            </td>
                            <td>
                                {#if !topup.status.startsWith('paid')}
                                    <form method="POST" action="?/markPaid" use:enhance style="margin: 0;">
                                        <input type="hidden" name="topupId" value={topup.id} />
                                        <button type="submit" class="outline" style="padding: 0.25rem 0.5rem; margin: 0; font-size: 0.8rem;">
                                            Markeer Betaald
                                        </button>
                                    </form>
                                {/if}
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}
</article>

<style>
    .badge { padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8em; }
    .success { background-color: var(--color-success); color: white; }
    .warning { background-color: var(--color-warning); color: white; }
</style>
