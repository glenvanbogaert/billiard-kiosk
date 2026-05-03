<script lang="ts">
    import { enhance } from '$app/forms';
    let { data, form } = $props();
    let showAddForm = $state(false);
    const formatPrice = (price: number | string) => `€${parseFloat(price as string).toFixed(2)}`;
</script>

<article>
    <header style="display: flex; justify-content: space-between; align-items: center;">
        <h2>Dranken</h2>
        <button onclick={() => showAddForm = !showAddForm}>
            {showAddForm ? 'Annuleren' : '+ Nieuwe Drank'}
        </button>
    </header>

    {#if form?.error}
        <p style="color: var(--color-error);">{form.error}</p>
    {/if}
    {#if form?.success}
        <p style="color: var(--color-success);">Drank succesvol toegevoegd!</p>
    {/if}
    {#if form?.updated}
        <p style="color: var(--color-success);">Drank bijgewerkt!</p>
    {/if}

    {#if showAddForm}
        <article style="border: 1px solid var(--pico-muted-border-color); padding: 1.5rem; margin-bottom: 1rem;">
            <h3>Nieuwe Drank Toevoegen</h3>
            <form method="POST" action="?/addDrink" use:enhance>
                <div class="grid">
                    <label>
                        Naam *
                        <input type="text" name="name" required placeholder="Coca-Cola" />
                    </label>
                    <label>
                        Categorie *
                        <select name="categoryId" required>
                            {#each data.categories as cat}
                                <option value={cat.id}>{cat.name_nl}</option>
                            {/each}
                        </select>
                    </label>
                </div>
                <label>
                    Beschrijving
                    <input type="text" name="description" placeholder="Flesje 20cl" />
                </label>
                <div class="grid">
                    <label>
                        Verkoopprijs incl. BTW (€) *
                        <input type="number" name="salePrice" step="0.01" min="0" required placeholder="2.00" />
                    </label>
                    <label>
                        Inkoopprijs excl. BTW (€) *
                        <input type="number" name="purchasePrice" step="0.01" min="0" required placeholder="0.80" />
                    </label>
                    <label>
                        BTW-tarief *
                        <select name="vatRate" required>
                            {#each data.vatRates as vat}
                                <option value={vat.rate}>{vat.description_nl}</option>
                            {/each}
                        </select>
                    </label>
                </div>
                <div class="grid">
                    <label>
                        Lage voorraad drempel
                        <input type="number" name="lowStockThreshold" min="0" value="10" />
                    </label>
                    <label>
                        Afbeelding pad
                        <input type="text" name="imagePath" placeholder="placeholder.svg" />
                    </label>
                </div>
                <button type="submit">Drank Toevoegen</button>
            </form>
        </article>
    {/if}
    
    <div class="overflow-auto">
        <table class="striped">
            <thead>
                <tr>
                    <th>Naam</th>
                    <th>Categorie</th>
                    <th>Verkoopprijs</th>
                    <th>Voorraad</th>
                    <th>Drempel</th>
                    <th>Acties</th>
                </tr>
            </thead>
            <tbody>
                {#each data.drinks as drink}
                    <tr>
                        <td><strong>{drink.name_nl}</strong></td>
                        <td>{drink.category_name}</td>
                        <td>{formatPrice(drink.sale_price_incl_vat)}</td>
                        <td class={drink.stock <= drink.low_stock_threshold ? 'text-error' : ''}>
                            {drink.stock}
                        </td>
                        <td>{drink.low_stock_threshold}</td>
                        <td>
                            <form method="POST" action="?/updateDrink" use:enhance style="display: flex; gap: 0.5rem; align-items: center; margin: 0;">
                                <input type="hidden" name="drinkId" value={drink.id} />
                                <input type="number" name="salePrice" step="0.01" value={drink.sale_price_incl_vat} style="width: 5rem; margin: 0; padding: 0.25rem;" />
                                <input type="number" name="lowStockThreshold" min="0" value={drink.low_stock_threshold} style="width: 4rem; margin: 0; padding: 0.25rem;" />
                                <button type="submit" class="outline" style="padding: 0.25rem 0.5rem; margin: 0; font-size: 0.8rem; white-space: nowrap;">
                                    Opslaan
                                </button>
                            </form>
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
