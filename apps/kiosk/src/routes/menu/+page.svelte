<script lang="ts">
    import { onMount } from 'svelte';
    import { kioskState, type Drink } from '$lib/store.svelte.js';
    import { goto } from '$app/navigation';

    let drinks = $state<Drink[]>([]);
    let categories = $state<{id: string, name: string}[]>([]);
    let selectedCategory = $state<string>('');
    let loading = $state(true);

    onMount(async () => {
        if (!kioskState.member) {
            goto('/');
            return;
        }

        try {
            const res = await fetch('/api/drinks');
            const data = await res.json();
            drinks = data.drinks || [];
            
            const catsMap = new Map();
            for (const d of drinks) {
                if (!catsMap.has(d.category_id)) {
                    catsMap.set(d.category_id, d.category_name);
                }
            }
            categories = Array.from(catsMap).map(([id, name]) => ({id, name}));
            if (categories.length > 0) {
                selectedCategory = categories[0].id;
            }
        } catch (e) {
            console.error('Failed to load drinks', e);
        } finally {
            loading = false;
        }
    });

    const formatPrice = (price: number) => `€${price.toFixed(2)}`;

    function handleCheckout() {
        if (kioskState.cart.length > 0) {
            goto('/checkout');
        }
    }
</script>

{#if kioskState.showIdleWarning}
    <dialog open>
        <article>
            <header>
                <h2>Ben je er nog?</h2>
            </header>
            <p>Sessie wordt binnenkort afgesloten vanwege inactiviteit.</p>
            <footer>
                <button onclick={() => kioskState.resetIdleTimer()}>Ik ben er nog</button>
            </footer>
        </article>
    </dialog>
{/if}

<div class="kiosk-layout">
    <aside class="cart-sidebar">
        <header>
            <h2>{kioskState.member?.full_name}</h2>
            <p class="balance">Saldo: {formatPrice(kioskState.member?.cached_balance || 0)}</p>
        </header>

        <div class="cart-items">
            {#each kioskState.cart as item}
                <div class="cart-item">
                    <div class="item-info">
                        <strong>{item.drink.name_nl}</strong>
                        <span>{formatPrice(item.drink.sale_price_incl_vat)}</span>
                    </div>
                    <div class="item-actions">
                        <button class="qty-btn secondary" onclick={() => kioskState.updateQuantity(item.drink.id, -1)}>-</button>
                        <span class="qty">{item.quantity}</span>
                        <button class="qty-btn" onclick={() => kioskState.updateQuantity(item.drink.id, 1)}>+</button>
                    </div>
                </div>
            {/each}
            {#if kioskState.cart.length === 0}
                <p style="text-align: center; color: gray; margin-top: 2rem;">Winkelmandje is leeg</p>
            {/if}
        </div>

        <footer>
            <div class="total-row">
                <strong>Totaal:</strong>
                <strong>{formatPrice(kioskState.cartTotal)}</strong>
            </div>
            <button 
                class="checkout-btn" 
                disabled={kioskState.cart.length === 0}
                onclick={handleCheckout}
            >
                Afrekenen
            </button>
            <button class="topup-btn secondary outline" onclick={() => goto('/topup')}>
                Saldo opladen
            </button>
            <button class="cancel-btn secondary outline" onclick={() => kioskState.clearSession()}>
                Annuleren
            </button>
        </footer>
    </aside>

    <main class="product-area">
        {#if loading}
            <p aria-busy="true">Dranken laden...</p>
        {:else}
            <nav class="category-tabs">
                {#each categories as cat}
                    <button 
                        class="tab-btn {selectedCategory === cat.id ? '' : 'outline'}"
                        onclick={() => selectedCategory = cat.id}
                    >
                        {cat.name}
                    </button>
                {/each}
            </nav>

            <div class="product-grid">
                {#each drinks.filter(d => d.category_id === selectedCategory) as drink}
                    <button class="product-card" onclick={() => kioskState.addToCart(drink)}>
                        <div class="product-image">
                            <img src="/images/{drink.image_path}" alt={drink.name_nl} onerror={(e) => e.currentTarget.src = '/images/placeholder.svg'} />
                        </div>
                        <div class="product-details">
                            <h3>{drink.name_nl}</h3>
                            <span class="price">{formatPrice(drink.sale_price_incl_vat)}</span>
                        </div>
                    </button>
                {/each}
            </div>
        {/if}
    </main>
</div>

<style>
    .kiosk-layout {
        display: flex;
        height: 100vh;
        overflow: hidden;
    }
    .cart-sidebar {
        width: var(--layout-cart-sidebar-width, 28%);
        background-color: #f8f9fa;
        border-right: 2px solid #e0e0e0;
        display: flex;
        flex-direction: column;
        padding: 1rem;
    }
    .cart-sidebar header h2 { margin-bottom: 0.5rem; }
    .balance { font-size: 1.5rem; font-weight: bold; color: var(--color-primary); }
    
    .cart-items { flex: 1; overflow-y: auto; padding-right: 0.5rem; }
    .cart-item { display: flex; justify-content: space-between; align-items: center; padding: 1rem 0; border-bottom: 1px solid #ccc; }
    .item-info { display: flex; flex-direction: column; }
    .item-actions { display: flex; align-items: center; gap: 1rem; }
    .qty-btn { min-width: 64px; height: 64px; padding: 0; border-radius: 50%; font-size: 2rem; display: flex; align-items: center; justify-content: center; }
    .qty { font-size: 1.5rem; font-weight: bold; min-width: 2ch; text-align: center; }
    
    .total-row { display: flex; justify-content: space-between; font-size: 2rem; margin-bottom: 1rem; }
    .checkout-btn { width: 100%; height: 80px; font-size: 2rem; margin-bottom: 1rem; }
    .topup-btn { width: 100%; height: 64px; margin-bottom: 0.5rem; }
    .cancel-btn { width: 100%; height: 64px; }

    .product-area { flex: 1; display: flex; flex-direction: column; padding: 1rem; background-color: white; overflow: hidden; }
    .category-tabs { display: flex; gap: 1rem; overflow-x: auto; padding-bottom: 1rem; margin-bottom: 1rem; border-bottom: 2px solid #e0e0e0; }
    .tab-btn { min-width: 150px; height: 80px; font-size: 1.5rem; flex-shrink: 0; }
    
    .product-grid { 
        display: grid; 
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); 
        gap: 1.5rem; 
        overflow-y: auto; 
        align-content: start;
        padding-bottom: 2rem;
    }
    .product-card { 
        display: flex; flex-direction: column; padding: 1rem; background-color: #f1f3f5; 
        border: none; border-radius: 1rem; align-items: center; height: 250px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition: transform 0.1s;
    }
    .product-card:active { transform: scale(0.95); }
    .product-image { height: 120px; width: 100%; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem; }
    .product-image img { max-height: 100%; max-width: 100%; object-fit: contain; }
    .product-details { text-align: center; width: 100%; }
    .product-details h3 { margin: 0; font-size: 1.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .price { font-size: 1.5rem; font-weight: bold; color: var(--color-primary); }
</style>
