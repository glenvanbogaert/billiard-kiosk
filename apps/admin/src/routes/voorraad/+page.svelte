<script lang="ts">
    import { enhance } from '$app/forms';
    let { data, form } = $props();

    let correcting = $state(false); // global "Aanpassen" toggle for stock correction
    let stockValues = $state<Record<string, number>>({});

    // Initialise local stock inputs whenever data loads
    $effect(() => {
        for (const d of data.drinks) {
            stockValues[d.id] = d.stock;
        }
    });

    $effect(() => {
        if (form?.corrected) correcting = false;
        if (form?.success)   correcting = false;
    });
</script>

<article>
    <header style="display:flex;justify-content:space-between;align-items:center;">
        <h2>Voorraad Beheer</h2>
        <button class="{correcting ? '' : 'outline'}" onclick={() => correcting = !correcting}>
            {correcting ? '✕ Aanpassing annuleren' : '✎ Voorraad aanpassen'}
        </button>
    </header>

    {#if form?.error}
        <p class="msg-error">{form.error}</p>
    {/if}
    {#if form?.success}
        <p class="msg-ok">Voorraad succesvol bijgewerkt!</p>
    {/if}
    {#if form?.corrected}
        <p class="msg-ok">Voorraad gecorrigeerd!</p>
    {/if}

    {#if correcting}
        <p class="hint">Pas de huidige voorraad direct aan en klik <strong>Opslaan</strong> om te corrigeren (wordt gelogd als correctie).</p>
    {/if}

    <div class="overflow-auto">
        <table class="striped">
            <thead>
                <tr>
                    <th>Drank</th>
                    <th>Categorie</th>
                    <th>Huidige Voorraad</th>
                    <th>Aanvullen</th>
                    {#if correcting}<th>Opslaan</th>{/if}
                </tr>
            </thead>
            <tbody>
                {#each data.drinks as drink (drink.id)}
                    <tr class={drink.stock <= drink.low_stock_threshold ? 'row-warn' : ''}>
                        <td><strong>{drink.name_nl}</strong></td>
                        <td>{drink.category_name}</td>
                        <td>
                            {#if correcting}
                                <input
                                    type="number" min="0"
                                    value={stockValues[drink.id] ?? drink.stock}
                                    oninput={(e) => stockValues[drink.id] = parseInt((e.currentTarget as HTMLInputElement).value)}
                                    style="width:6rem;margin:0;padding:0.25rem 0.4rem;"
                                />
                            {:else}
                                <span class={drink.stock <= drink.low_stock_threshold ? 'text-warn' : ''}>
                                    {drink.stock}
                                </span>
                            {/if}
                        </td>
                        <td>
                            <form method="POST" action="?/restock" use:enhance
                                style="display:flex;gap:0.5rem;align-items:center;margin:0;">
                                <input type="hidden" name="drinkId" value={drink.id} />
                                <input type="number" name="quantity" min="1" value="24"
                                    style="width:5rem;margin:0;padding:0.25rem 0.5rem;" />
                                <button type="submit" class="outline btn-sm">+ Aanvullen</button>
                            </form>
                        </td>
                        {#if correcting}
                            <td>
                                <form method="POST" action="?/correctStock" use:enhance style="margin:0;">
                                    <input type="hidden" name="drinkId" value={drink.id} />
                                    <input type="hidden" name="newStock" value={stockValues[drink.id] ?? drink.stock} />
                                    <button type="submit" class="btn-sm">Opslaan</button>
                                </form>
                            </td>
                        {/if}
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
</article>

<style>
    .msg-ok    { color: var(--color-success); }
    .msg-error { color: var(--color-error); }
    .text-warn { color: var(--color-error); font-weight: bold; }
    .row-warn  { background-color: #fff3f3; }
    .hint      { font-size: 0.9rem; color: #555; font-style: italic; margin-bottom: 0.5rem; }
    .btn-sm    { padding: 0.2rem 0.6rem; font-size: 0.82rem; margin: 0; white-space: nowrap; }
</style>
