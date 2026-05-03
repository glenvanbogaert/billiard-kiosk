<script lang="ts">
    import { onMount } from 'svelte';
    import { kioskState } from '$lib/store.svelte.js';
    import { page } from '$app/state';

    const method = $derived(page.url.searchParams.get('method') || 'member_card');
    const balance = $derived(page.url.searchParams.get('balance'));

    const formatPrice = (val: string | null) => val ? `€${parseFloat(val).toFixed(2)}` : '';

    const methodLabels: Record<string, string> = {
        member_card: 'Lidkaart',
        epc_qr: 'QR-code (overschrijving)',
        cash: 'Cash'
    };

    onMount(() => {
        // Auto-redirect to idle after 8 seconds
        const timer = setTimeout(() => {
            kioskState.clearSession();
        }, 8000);

        return () => clearTimeout(timer);
    });
</script>

<div class="receipt-screen">
    <article class="receipt-card">
        <div class="checkmark">✓</div>
        <h1>Bedankt!</h1>

        <div class="details">
            <p><strong>Betaalmethode:</strong> {methodLabels[method] || method}</p>
            {#if balance}
                <p class="new-balance">
                    Nieuw saldo: <strong>{formatPrice(balance)}</strong>
                </p>
            {/if}
        </div>

        <button class="done-btn" onclick={() => kioskState.clearSession()}>Klaar</button>

        <p class="auto-close">Dit scherm sluit automatisch over enkele seconden...</p>
    </article>
</div>

<style>
    .receipt-screen {
        display: flex; justify-content: center; align-items: center;
        height: 100vh; background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
    }
    .receipt-card {
        text-align: center; padding: 4rem 3rem;
        background: white; border-radius: 1.5rem;
        box-shadow: 0 20px 60px rgba(0,0,0,0.15);
        max-width: 600px; width: 90%; margin: 0;
    }
    .checkmark {
        width: 120px; height: 120px; margin: 0 auto 2rem;
        background: var(--color-success); color: white;
        border-radius: 50%; display: flex; align-items: center;
        justify-content: center; font-size: 4rem;
        animation: pop 0.4s ease-out;
    }
    @keyframes pop {
        0% { transform: scale(0); }
        80% { transform: scale(1.1); }
        100% { transform: scale(1); }
    }
    h1 {
        font-size: var(--font-size-receipt, 3rem);
        color: var(--color-success); margin-bottom: 2rem;
    }
    .details { font-size: 1.5rem; margin-bottom: 2rem; }
    .details p { margin: 0.5rem 0; }
    .new-balance { font-size: 2rem !important; color: var(--color-primary); }
    .done-btn {
        min-width: 250px; height: 80px; font-size: 1.75rem;
        margin-bottom: 1rem;
    }
    .auto-close { font-size: 1rem; color: #888; margin: 0; }
</style>
