<script lang="ts">
    import { enhance } from '$app/forms';
    let { data, form } = $props();
</script>

<article>
    <header>
        <h2>Voorraad Beheer</h2>
    </header>

    {#if form?.error}
        <p style="color: var(--color-error);">{form.error}</p>
    {/if}

    {#if form?.success}
        <p style="color: var(--color-success);">Voorraad succesvol bijgewerkt!</p>
    {/if}

    <div class="overflow-auto">
        <table class="striped">
            <thead>
                <tr>
                    <th>Drank</th>
                    <th>Categorie</th>
                    <th>Huidige Voorraad</th>
                    <th>Drempel</th>
                    <th>Aanvullen</th>
                </tr>
            </thead>
            <tbody>
                {#each data.drinks as drink}
                    <tr>
                        <td><strong>{drink.name_nl}</strong></td>
                        <td>{drink.category_name}</td>
                        <td class={drink.stock <= drink.low_stock_threshold ? 'text-error' : ''}>
                            {drink.stock}
                        </td>
                        <td>{drink.low_stock_threshold}</td>
                        <td>
                            <form method="POST" action="?/restock" use:enhance style="display: flex; gap: 0.5rem; align-items: center; margin: 0;">
                                <input type="hidden" name="drinkId" value={drink.id} />
                                <input type="number" name="quantity" min="1" value="24" style="width: 5rem; margin: 0; padding: 0.25rem 0.5rem;" />
                                <button type="submit" class="outline" style="padding: 0.25rem 0.75rem; margin: 0; font-size: 0.85rem; white-space: nowrap;">
                                    + Aanvullen
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
