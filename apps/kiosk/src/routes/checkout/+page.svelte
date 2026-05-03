<script lang="ts">
    import { onMount } from 'svelte';
    import { kioskState } from '$lib/store.svelte.js';
    import { goto } from '$app/navigation';

    let loading = $state(true);
    let error = $state<string | null>(null);
    let success = $state(false);
    let newBalance = $state<number | null>(null);
    let requiresTopup = $state(false);
    let topupQrUrl = $state<string | null>(null);

    onMount(async () => {
        if (!kioskState.member || kioskState.cart.length === 0) {
            goto('/');
            return;
        }

        try {
            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    memberId: kioskState.member.id,
                    cart: kioskState.cart
                })
            });

            const data = await res.json();

            if (res.ok) {
                success = true;
                newBalance = data.newBalance;
                // Important: we clear the cart directly, the user requested it
                // and the overall session will be cleared on redirect
                setTimeout(() => kioskState.clearSession(), 5000);
            } else if (res.status === 402 && data.error === 'INSUFFICIENT_FUNDS') {
                requiresTopup = true;
                await initiateTopup();
            } else {
                error = data.error || 'Er is een fout opgetreden bij het afrekenen.';
            }
        } catch (e) {
            error = 'Netwerkfout bij afrekenen. Probeer later opnieuw.';
        } finally {
            loading = false;
        }
    });

    async function initiateTopup() {
        try {
            const res = await fetch('/api/topup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    memberId: kioskState.member!.id,
                    amount: 50 // Standard top-up amount
                })
            });
            const data = await res.json();
            if (res.ok) {
                topupQrUrl = `/api/qr/${data.structuredCommunication}`;
            } else {
                error = 'Kon geen opwaardering starten.';
            }
        } catch (e) {
            error = 'Fout bij starten opwaardering.';
        }
    }

    const formatPrice = (price: number) => `€${price.toFixed(2)}`;
</script>

<div class="checkout-container">
    {#if loading}
        <article aria-busy="true">
            <h2>Betaling verwerken...</h2>
        </article>
    {:else if success}
        <article class="success-card">
            <header style="background-color: var(--color-success); color: white;">
                <h2>Betaling Geslaagd!</h2>
            </header>
            <div style="padding: 2rem; font-size: 2rem;">
                <p>Bedankt, {kioskState.member?.full_name}.</p>
                <p>Nieuw saldo: <strong>{formatPrice(newBalance!)}</strong></p>
                <p style="font-size: 1rem; color: gray; margin-top: 2rem;">Dit scherm sluit automatisch...</p>
            </div>
            <footer>
                <button onclick={() => kioskState.clearSession()}>Sluiten</button>
            </footer>
        </article>
    {:else if requiresTopup}
        <article class="topup-card">
            <header style="background-color: var(--color-warning); color: white;">
                <h2>Onvoldoende Saldo</h2>
            </header>
            <div class="topup-content">
                <p>Je hebt de maximale limiet bereikt en moet je saldo opwaarderen om deze bestelling te voltooien.</p>
                {#if topupQrUrl}
                    <div class="qr-box">
                        <img src={topupQrUrl} alt="EPC QR Code" />
                        <p>Scan deze code met je bank app om <strong>€50,00</strong> op te waarderen.</p>
                    </div>
                {:else}
                    <p aria-busy="true">QR code genereren...</p>
                {/if}
            </div>
            <footer>
                <button class="secondary outline" onclick={() => goto('/menu')}>Terug naar menu</button>
                <button onclick={() => kioskState.clearSession()}>Afsluiten</button>
            </footer>
        </article>
    {:else if error}
        <article class="error-card">
            <header style="background-color: var(--color-error); color: white;">
                <h2>Fout</h2>
            </header>
            <div style="padding: 2rem;">
                <p>{error}</p>
            </div>
            <footer>
                <button onclick={() => goto('/menu')}>Terug</button>
            </footer>
        </article>
    {/if}
</div>

<style>
    .checkout-container {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        background-color: #f1f3f5;
        padding: 2rem;
    }
    article {
        width: 100%;
        max-width: 800px;
        text-align: center;
        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        border-radius: 1rem;
        overflow: hidden;
    }
    header { padding: 2rem; margin-bottom: 0; }
    h2 { margin: 0; font-size: 2.5rem; }
    .topup-content { padding: 2rem; font-size: 1.5rem; }
    .qr-box { margin-top: 2rem; padding: 2rem; background: white; border-radius: 1rem; display: inline-block;}
    .qr-box img { width: 300px; height: 300px; object-fit: contain; }
    footer { padding: 2rem; display: flex; gap: 1rem; justify-content: center; }
    button { min-width: 200px; height: 80px; font-size: 1.5rem; }
</style>
