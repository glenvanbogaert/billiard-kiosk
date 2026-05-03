<script lang="ts">
    let { data } = $props();
    const formatPrice = (price: number | string) => `€${parseFloat(price as string).toFixed(2)}`;
</script>

<article>
    <header style="display: flex; justify-content: space-between; align-items: center;">
        <h2>Dranken & Voorraad</h2>
    </header>
    
    <div class="overflow-auto">
        <table class="striped">
            <thead>
                <tr>
                    <th>Naam</th>
                    <th>Categorie</th>
                    <th>Verkoopprijs</th>
                    <th>Voorraad</th>
                </tr>
            </thead>
            <tbody>
                {#each data.drinks as drink}
                    <tr>
                        <td><strong>{drink.name_nl}</strong></td>
                        <td>{drink.category_name}</td>
                        <td>{formatPrice(drink.sale_price_incl_vat)}</td>
                        <td class={drink.stock <= 5 ? 'text-error' : ''}>
                            {drink.stock}
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
</article>

<style>
    .text-error { color: var(--color-error); font-weight: bold; }
</style>
