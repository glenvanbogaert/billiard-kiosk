<script lang="ts">
    let { data } = $props();
    const formatPrice = (price: number) => `€${price.toFixed(2)}`;
</script>

<article>
    <header>
        <h2>Dashboard</h2>
    </header>
    
    <div class="grid">
        <article class="stat-card">
            <h3>Verkopen Vandaag</h3>
            <p class="stat-number">{formatPrice(data.totalSalesToday)}</p>
        </article>

        <article class="stat-card {data.openTopups > 0 ? 'warning' : ''}">
            <h3>Openstaande Top-ups</h3>
            <p class="stat-number">{data.openTopups}</p>
        </article>

        <article class="stat-card {data.lowStock.length > 0 ? 'error' : ''}">
            <h3>Lage Voorraad</h3>
            <p class="stat-number">{data.lowStock.length} dranken</p>
        </article>
    </div>

    {#if data.lowStock.length > 0}
        <article>
            <h3>Dranken met lage voorraad</h3>
            <table>
                <thead>
                    <tr>
                        <th>Drank</th>
                        <th>Huidige Voorraad</th>
                    </tr>
                </thead>
                <tbody>
                    {#each data.lowStock as drink}
                        <tr>
                            <td>{drink.name_nl}</td>
                            <td>{drink.stock}</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </article>
    {/if}
</article>

<style>
    .stat-card { text-align: center; }
    .stat-number { font-size: 2.5rem; font-weight: bold; margin: 0; }
    .warning { border-top: 4px solid var(--color-warning); }
    .error { border-top: 4px solid var(--color-error); }
</style>
