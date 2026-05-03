<script lang="ts">
    import { kioskState } from '$lib/store.svelte.js';
    import { goto } from '$app/navigation';

    let processing = $state(false);
    let error = $state<string | null>(null);

    const formatPrice = (price: number) => `€${price.toFixed(2)}`;

    const projectedBalance = $derived(
        (kioskState.member?.cached_balance ?? 0) - kioskState.cartTotal
    );

    const canPayByCard = $derived(projectedBalance >= -50);

    async function payByMemberCard() {
        if (processing || !canPayByCard) return;
        processing = true;
        error = null;

        try {
            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    memberId: kioskState.member!.id,
                    cart: kioskState.cart,
                    paymentMethod: 'member_card'
                })
            });
            const data = await res.json();

            if (res.ok) {
                goto(`/receipt?saleId=${data.saleId}&balance=${data.newBalance}&method=member_card`);
            } else if (res.status === 402) {
                error = 'Saldo onvoldoende — laad eerst op.';
            } else {
                error = data.error || 'Er is een fout opgetreden.';
            }
        } catch (e) {
            error = 'Netwerkfout. Probeer opnieuw.';
        } finally {
            processing = false;
        }
    }

    async function payByEpcQr() {
        if (processing) return;
        processing = true;
        error = null;

        try {
            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    memberId: kioskState.member!.id,
                    cart: kioskState.cart,
                    paymentMethod: 'epc_qr'
                })
            });
            const data = await res.json();

            if (res.ok) {
                goto(`/payment/qr?saleId=${data.saleId}&comm=${data.structuredCommunication}&amount=${kioskState.cartTotal.toFixed(2)}`);
            } else {
                error = data.error || 'Er is een fout opgetreden.';
            }
        } catch (e) {
            error = 'Netwerkfout. Probeer opnieuw.';
        } finally {
            processing = false;
        }
    }

    async function payByCash() {
        if (processing) return;
        processing = true;
        error = null;

        try {
            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    memberId: kioskState.member!.id,
                    cart: kioskState.cart,
                    paymentMethod: 'cash'
                })
            });
            const data = await res.json();

            if (res.ok) {
                goto(`/receipt?saleId=${data.saleId}&method=cash`);
            } else {
                error = data.error || 'Er is een fout opgetreden.';
            }
        } catch (e) {
            error = 'Netwerkfout. Probeer opnieuw.';
        } finally {
            processing = false;
        }
    }

    if (!kioskState.member || kioskState.cart.length === 0) {
        goto('/');
    }
</script>

<div class="payment-overlay">
    <article class="payment-modal">
        <header>
            <h2>Kies je betaalmethode</h2>
            <p>Totaal: <strong>{formatPrice(kioskState.cartTotal)}</strong></p>
        </header>

        {#if error}
            <div class="error-banner">{error}</div>
        {/if}

        <div class="payment-options">
            <button
                class="payment-option {canPayByCard ? '' : 'disabled-option'}"
                onclick={payByMemberCard}
                disabled={!canPayByCard || processing}
            >
                <span class="option-icon">💳</span>
                <div class="option-text">
                    <strong>Lidkaart</strong>
                    {#if canPayByCard}
                        <span>Saldo: {formatPrice(kioskState.member?.cached_balance ?? 0)} → na betaling: {formatPrice(projectedBalance)}</span>
                    {:else}
                        <span class="option-warning">Saldo onvoldoende — laad eerst op</span>
                    {/if}
                </div>
            </button>

            <button
                class="payment-option"
                onclick={payByEpcQr}
                disabled={processing}
            >
                <span class="option-icon">📱</span>
                <div class="option-text">
                    <strong>QR-code (overschrijving)</strong>
                    <span>Scan de QR met je bank-app</span>
                </div>
            </button>

            <button
                class="payment-option"
                onclick={payByCash}
                disabled={processing}
            >
                <span class="option-icon">💰</span>
                <div class="option-text">
                    <strong>Cash</strong>
                    <span>Betaal contant in de kassa</span>
                </div>
            </button>
        </div>

        <footer>
            <a href="/menu" class="cancel-link">← Annuleer</a>
        </footer>
    </article>
</div>

<style>
    .payment-overlay {
        position: fixed; inset: 0; z-index: 100;
        display: flex; justify-content: center; align-items: center;
        background: rgba(0,0,0,0.5);
    }
    .payment-modal {
        width: 90%; max-width: 700px;
        background: white; border-radius: 1rem;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        overflow: hidden; margin: 0;
    }
    .payment-modal header {
        background: var(--color-primary); color: white;
        padding: 2rem; text-align: center; margin: 0;
    }
    .payment-modal header h2 { color: white; margin: 0 0 0.5rem 0; font-size: 2rem; }
    .payment-modal header p { margin: 0; font-size: 1.5rem; }

    .error-banner {
        background: var(--color-error); color: white;
        padding: 1rem; text-align: center; font-size: 1.2rem;
    }

    .payment-options { padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
    .payment-option {
        display: flex; align-items: center; gap: 1.5rem;
        padding: 1.5rem; border: 2px solid #e0e0e0; border-radius: 0.75rem;
        background: white; text-align: left; width: 100%;
        min-height: 80px; transition: border-color 0.2s;
    }
    .payment-option:active { border-color: var(--color-primary); transform: scale(0.98); }
    .disabled-option { opacity: 0.5; }
    .option-icon { font-size: 2.5rem; flex-shrink: 0; }
    .option-text { display: flex; flex-direction: column; gap: 0.25rem; }
    .option-text strong { font-size: 1.4rem; }
    .option-text span { font-size: 1rem; color: #666; }
    .option-warning { color: var(--color-error) !important; }

    .payment-modal footer {
        padding: 1.5rem; text-align: center;
        border-top: 1px solid #e0e0e0;
    }
    .cancel-link { font-size: 1.2rem; }
</style>
