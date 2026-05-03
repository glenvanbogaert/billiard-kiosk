<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { kioskState } from '$lib/store.svelte.js';
    import { goto } from '$app/navigation';
    import { page } from '$app/state';

    const topupId = $derived(page.url.searchParams.get('topupId'));
    const comm = $derived(page.url.searchParams.get('comm'));
    const amount = $derived(page.url.searchParams.get('amount'));

    let secondsLeft = $state(90);
    let confirming = $state(false);
    let error = $state<string | null>(null);
    let timer: ReturnType<typeof setInterval> | null = null;

    const formatPrice = (price: string | null) => price ? `€${parseFloat(price).toFixed(2)}` : '';

    onMount(() => {
        if (!topupId || !comm) {
            goto('/');
            return;
        }
        timer = setInterval(() => {
            secondsLeft--;
            if (secondsLeft <= 0) {
                abandonTopup();
            }
        }, 1000);
    });

    onDestroy(() => {
        if (timer) clearInterval(timer);
    });

    async function confirmPayment() {
        confirming = true;
        try {
            // Note: in the real world we might want a confirm-epc topup endpoint, 
            // but for topups, they just remain pending_payment_unverified until CODA.
            // There's no stock to decrement. So clicking this just means "I'm done".
            
            // If checkout was in progress, go back to cart, else go to menu/idle
            goto(`/menu`);
        } catch (e) {
            error = 'Netwerkfout.';
        } finally {
            confirming = false;
        }
    }

    async function abandonTopup() {
        try {
            // we can just leave it pending or mark abandoned. 
            // the spec doesn't require an explicit abandon for topups like it does for sales, 
            // since they just expire if unpaid.
        } catch { /* best effort */ }
        goto('/menu');
    }
</script>

<div class="qr-screen">
    <article class="qr-modal">
        <header>
            <h2>Scan de QR-code met je bank-app</h2>
        </header>

        <div class="qr-content">
            <p style="margin-top: 0;">Top-up gestart. Je saldo wordt zichtbaar zodra de bank de betaling verwerkt heeft.</p>
            
            <div class="qr-box">
                <img src="/api/qr/{comm}" alt="EPC QR Code voor opwaarderen" />
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
                Ik heb betaald
            </button>
            <button class="secondary outline" onclick={abandonTopup}>
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
