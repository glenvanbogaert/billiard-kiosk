<script lang="ts">
    import { onMount } from 'svelte';
    import { kioskState } from '$lib/store.svelte.js';
    import { goto } from '$app/navigation';

    onMount(() => {
        // Auto-redirect to idle after 8 seconds if cart is empty,
        // or back to menu if cart is full
        const timer = setTimeout(() => {
            if (kioskState.cart.length > 0) {
                goto('/menu');
            } else {
                kioskState.clearSession();
            }
        }, 8000);

        return () => clearTimeout(timer);
    });
</script>

<div class="receipt-screen">
    <article class="receipt-card">
        <div class="checkmark">✓</div>
        <h1>Mail verzonden!</h1>

        <div class="details">
            <p>We hebben je een e-mail gestuurd met de overschrijvingsgegevens.</p>
            <p>Gelieve het bedrag <strong>binnen de 14 dagen</strong> over te schrijven.</p>
        </div>

        <button class="done-btn" onclick={() => {
            if (kioskState.cart.length > 0) {
                goto('/menu');
            } else {
                kioskState.clearSession();
            }
        }}>Klaar</button>

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
    .done-btn {
        min-width: 250px; height: 80px; font-size: 1.75rem;
        margin-bottom: 1rem;
    }
    .auto-close { font-size: 1rem; color: #888; margin: 0; }
</style>
