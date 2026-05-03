<script lang="ts">
    import { enhance } from '$app/forms';

    let { data, form } = $props();
    let showAddForm = $state(false);
    let editingId = $state<string | null>(null);

    const fmt = (v: number | string) => `€${parseFloat(v as string).toFixed(2)}`;
    const kioskImgBase = 'http://localhost:3001'; // kiosk dev port

    function imgSrc(path: string) {
        // Point at kiosk static server; fallback handled by onerror
        return `${kioskImgBase}/images/${path}`;
    }

    // After a successful action, close the form / editing row
    $effect(() => {
        if (form?.success) showAddForm = false;
        if (form?.updated) editingId = null;
    });
</script>

<article>
    <header style="display:flex;justify-content:space-between;align-items:center;">
        <h2>Dranken</h2>
        <button onclick={() => showAddForm = !showAddForm}>
            {showAddForm ? 'Annuleren' : '+ Nieuwe Drank'}
        </button>
    </header>

    {#if form?.error}
        <p class="msg-error">{form.error}</p>
    {/if}
    {#if form?.success}
        <p class="msg-ok">Drank succesvol toegevoegd!</p>
    {/if}
    {#if form?.updated}
        <p class="msg-ok">Drank bijgewerkt!</p>
    {/if}

    <!-- ── ADD FORM ── -->
    {#if showAddForm}
        <article class="sub-card">
            <h3>Nieuwe Drank Toevoegen</h3>
            <form method="POST" action="?/addDrink" use:enhance enctype="multipart/form-data">
                <div class="grid">
                    <label>Naam *<input type="text" name="name" required placeholder="Coca-Cola" /></label>
                    <label>Categorie *
                        <select name="categoryId" required>
                            {#each data.categories as cat}
                                <option value={cat.id}>{cat.name_nl}</option>
                            {/each}
                        </select>
                    </label>
                </div>
                <label>Beschrijving<input type="text" name="description" placeholder="Flesje 20cl" /></label>
                <div class="grid">
                    <label>Verkoopprijs incl. BTW (€) *<input type="number" name="salePrice" step="0.01" min="0" required placeholder="2.00" /></label>
                    <label>Inkoopprijs excl. BTW (€) *<input type="number" name="purchasePrice" step="0.01" min="0" required placeholder="0.80" /></label>
                    <label>BTW-tarief *
                        <select name="vatRate" required>
                            {#each data.vatRates as vat}
                                <option value={vat.rate}>{vat.description_nl}</option>
                            {/each}
                        </select>
                    </label>
                </div>
                <div class="grid">
                    <label>Lage voorraad drempel<input type="number" name="lowStockThreshold" min="0" value="10" /></label>
                    <label>Afbeelding<input type="file" name="imageFile" accept="image/*" /></label>
                </div>
                <button type="submit">Drank Toevoegen</button>
            </form>
        </article>
    {/if}

    <!-- ── DRINKS TABLE ── -->
    <div class="overflow-auto">
        <table class="striped">
            <thead>
                <tr>
                    <th style="width:56px;">Foto</th>
                    <th>Naam</th>
                    <th>Categorie</th>
                    <th>Verkoopprijs</th>
                    <th>Voorraad</th>
                    <th>Drempel</th>
                    <th style="width:110px;"></th>
                </tr>
            </thead>
            <tbody>
                {#each data.drinks as drink (drink.id)}
                    {#if editingId === drink.id}
                        <!-- ── EDIT ROW ── -->
                        <tr class="edit-row">
                            <td colspan="7" style="padding:1rem;">
                                <form method="POST" action="?/updateDrink" use:enhance enctype="multipart/form-data">
                                    <input type="hidden" name="drinkId" value={drink.id} />
                                    <div class="edit-grid">
                                        <!-- Image upload -->
                                        <div class="img-upload">
                                            <img src={imgSrc(drink.image_path)} alt={drink.name_nl}
                                                onerror={(e) => (e.currentTarget as HTMLImageElement).src = imgSrc('placeholder.svg')} />
                                            <label class="file-label">
                                                📷 Nieuwe foto
                                                <input type="file" name="imageFile" accept="image/*" />
                                            </label>
                                        </div>
                                        <!-- Fields -->
                                        <div class="edit-fields">
                                            <div class="grid">
                                                <label>Naam *<input type="text" name="name" value={drink.name_nl} required /></label>
                                                <label>Categorie *
                                                    <select name="categoryId" required>
                                                        {#each data.categories as cat}
                                                            <option value={cat.id} selected={String(cat.id) === String(drink.category_id)}>{cat.name_nl}</option>
                                                        {/each}
                                                    </select>
                                                </label>
                                            </div>
                                            <label>Beschrijving<input type="text" name="description" value={drink.description_nl ?? ''} /></label>
                                            <div class="grid">
                                                <label>Verkoopprijs (€) *<input type="number" name="salePrice" step="0.01" value={drink.sale_price_incl_vat} required /></label>
                                                <label>Inkoopprijs (€) *<input type="number" name="purchasePrice" step="0.01" value={drink.purchase_price_excl_vat} required /></label>
                                                <label>BTW *
                                                    <select name="vatRate" required>
                                                        {#each data.vatRates as vat}
                                                            <option value={vat.rate} selected={String(vat.rate) === String(drink.vat_rate)}>{vat.description_nl}</option>
                                                        {/each}
                                                    </select>
                                                </label>
                                            </div>
                                            <label>Lage voorraad drempel<input type="number" name="lowStockThreshold" min="0" value={drink.low_stock_threshold} /></label>
                                        </div>
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
                            <td>
                                <img class="thumb" src={imgSrc(drink.image_path)} alt={drink.name_nl}
                                    onerror={(e) => (e.currentTarget as HTMLImageElement).src = imgSrc('placeholder.svg')} />
                            </td>
                            <td><strong>{drink.name_nl}</strong></td>
                            <td>{drink.category_name}</td>
                            <td>{fmt(drink.sale_price_incl_vat)}</td>
                            <td class={drink.stock <= drink.low_stock_threshold ? 'text-warn' : ''}>{drink.stock}</td>
                            <td>{drink.low_stock_threshold}</td>
                            <td>
                                <button class="outline btn-sm" onclick={() => editingId = drink.id}>Aanpassen</button>
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
    .msg-ok  { color: var(--color-success); }
    .msg-error { color: var(--color-error); }
    .text-warn { color: var(--color-error); font-weight: bold; }

    .thumb { width: 40px; height: 40px; object-fit: contain; border-radius: 4px; border: 1px solid #e0e0e0; background: white; }

    .btn-sm { padding: 0.2rem 0.6rem; font-size: 0.82rem; margin: 0; }

    .edit-row td { background: #f0f4ff; border-left: 4px solid var(--color-primary); }

    .edit-grid { display: grid; grid-template-columns: 120px 1fr; gap: 1.5rem; align-items: start; }

    .img-upload { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
    .img-upload img { width: 100px; height: 100px; object-fit: contain; border: 1px solid #ccc; border-radius: 8px; background: white; }

    .file-label {
        cursor: pointer; font-size: 0.8rem; padding: 0.3rem 0.6rem;
        border: 1px dashed #aaa; border-radius: 4px; text-align: center;
        display: block; width: 100%;
    }
    .file-label input[type="file"] { display: none; }

    .edit-fields label { font-size: 0.85rem; }
    .edit-fields input, .edit-fields select { padding: 0.35rem 0.5rem; font-size: 0.9rem; margin-bottom: 0.4rem; }

    .edit-actions { display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1rem; }
    .edit-actions button { min-width: 100px; }
</style>
