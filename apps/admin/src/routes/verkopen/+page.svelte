<script lang="ts">
    let { data } = $props();
    const formatPrice = (price: number | string) => `€${parseFloat(price as string).toFixed(2)}`;
    const formatDate = (date: string | null) => date ? new Date(date).toLocaleString('nl-BE') : '—';
</script>

<article>
    <header>
        <h2>Verkopen</h2>
    </header>

    {#if data.sales.length === 0}
        <p>Nog geen verkopen geregistreerd.</p>
    {:else}
        <div class="overflow-auto">
            <table class="striped">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Datum</th>
                        <th>Lid</th>
                        <th>Totaal</th>
                        <th>Betaalmethode</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {#each data.sales as sale}
                        <tr>
                            <td>{sale.id}</td>
                            <td>{formatDate(sale.completed_at)}</td>
                            <td><strong>{sale.full_name}</strong></td>
                            <td>{formatPrice(sale.total_incl_vat)}</td>
                            <td>{sale.payment_method}</td>
                            <td>
                                <span class="badge {sale.payment_status.startsWith('paid') ? 'success' : 'warning'}">
                                    {sale.payment_status}
                                </span>
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
