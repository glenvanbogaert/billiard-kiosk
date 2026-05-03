<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { kioskState } from '$lib/store.svelte.js';
    import { goto } from '$app/navigation';
    import { page } from '$app/state';

    const saleId = $derived(page.url.searchParams.get('saleId'));
    const comm = $derived(page.url.searchParams.get('comm'));
    const amount = $derived(page.url.searchParams.get('amount'));

    let secondsLeft = $state(90);
    let confirming = $state(false);
    let error = $state<string | null>(null);
    let timer: ReturnType<typeof setInterval> | null = null;

    const formatPrice = (price: string | null) => price ? `€${parseFloat(price).toFixed(2)}` : '';

    onMount(() => {
        if (!saleId || !comm) {
            goto('/');
            return;
        }
        timer = setInterval(() => {
            secondsLeft--;
            if (secondsLeft <= 0) {
                abandonSale();
            }
        }, 1000);
    });

    onDestroy(() => {
        if (timer) clearInterval(timer);
    });

    async function confirmPayment() {
        confirming = true;
        try {
            const res = await fetch('/api/checkout/confirm-epc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ saleId })
            });
            if (res.ok) {
                goto(`/receipt?saleId=${saleId}&method=epc_qr`);
            } else {
                error = 'Bevestiging mislukt.';
            }
        } catch (e) {
            error = 'Netwerkfout.';
        } finally {
            confirming = false;
        }
    }

    async function abandonSale() {
        try {
            await fetch('/api/checkout/abandon', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ saleId })
            });
        } catch { /* best effort */ }
        goto('/menu');
    }
</script>

<div class="qr-screen">
    <article class="qr-modal">
        <header>
            <h2>Scan de QR-code met je bank-app</h2>
        </header>

        {#if error}
            <div class="error-banner">{error}</div>
        {/if}

        <div class="qr-content">
            <div class="qr-box">
                <img src="/api/qr/{comm}" alt="EPC QR Code voor betaling" />
            </div>

            <div class="qr-details">
                <p><strong>Bedrag:</strong> {formatPrice(amount)}</p>
                <p><strong>Mededeling:</strong> +++{comm}+++</p>
                <p class="timer {secondsLeft <= 30 ? 'timer-warning' : ''}">
                    Nog {secondsLeft} seconden
                </p>
            </div>
        </div>

        <footer>
            <button class="confirm-btn" onclick={confirmPayment} disabled={confirming}>
                {confirming ? 'Verwerken...' : 'Ik heb betaald'}
            </button>
            <button class="secondary outline" onclick={abandonSale}>
                Annuleer
            </button>
        </footer>
    </article>
</div>

<style>
    .qr-screen {
        position: fixed; inset: 0; z-index: 100;
        display: flex; justify-content: center; align-items: center;
        background: rgba(0,0,0,0.6);
    }
    .qr-modal {
        width: 90%; max-width: 700px;
        background: white; border-radius: 1rem;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        overflow: hidden; margin: 0;
    }
    .qr-modal header {
        background: var(--color-primary); color: white;
        padding: 2rem; text-align: center; margin: 0;
    }
    .qr-modal header h2 { color: white; margin: 0; font-size: 1.75rem; }

    .error-banner {
        background: var(--color-error); color: white;
        padding: 1rem; text-align: center;
    }

    .qr-content { padding: 2rem; text-align: center; }
    .qr-box {
        background: white; display: inline-block;
        padding: 1rem; border-radius: 0.5rem;
        border: 2px solid #e0e0e0;
    }
    .qr-box img { width: 280px; height: 280px; object-fit: contain; }
    .qr-details { margin-top: 1.5rem; }
    .qr-details p { font-size: 1.3rem; margin: 0.5rem 0; }
    .timer { font-size: 1.5rem !important; font-weight: bold; color: var(--color-primary); }
    .timer-warning { color: var(--color-error) !important; }

    .qr-modal footer {
        padding: 1.5rem; display: flex; gap: 1rem; justify-content: center;
        border-top: 1px solid #e0e0e0;
    }
    .confirm-btn { min-width: 200px; height: 72px; font-size: 1.4rem; }
    footer button { min-width: 150px; height: 72px; font-size: 1.2rem; }
</style>
