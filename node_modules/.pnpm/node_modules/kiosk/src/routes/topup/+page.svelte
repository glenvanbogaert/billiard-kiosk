<script lang="ts">
    import { kioskState } from '$lib/store.svelte.js';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';

    let amount = $state<number | null>(null);
    let processing = $state(false);
    let error = $state<string | null>(null);

    const amounts = [10, 20, 50, 100];
    const formatPrice = (price: number) => `€${price.toFixed(2)}`;

    onMount(() => {
        if (!kioskState.member) {
            goto('/');
        }
    });

    async function handleMethodSelect(method: 'epc_qr' | 'email_invoice') {
        if (!amount || processing) return;
        processing = true;
        error = null;

        try {
            const res = await fetch('/api/topup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    memberId: kioskState.member!.id,
                    amount,
                    method
                })
            });
            const data = await res.json();

            if (res.ok) {
                if (method === 'epc_qr') {
                    goto(`/topup/qr?topupId=${data.topupId}&comm=${data.structuredCommunication}&amount=${amount}`);
                } else {
                    goto(`/topup/email-confirm`);
                }
            } else {
                error = data.error || 'Er is een fout opgetreden bij het opwaarderen.';
            }
        } catch (e) {
            error = 'Netwerkfout. Probeer opnieuw.';
        } finally {
            processing = false;
        }
    }
</script>

<div class="topup-screen">
    <article class="topup-modal">
        <header>
            <h2>Saldo Opladen</h2>
        </header>

        {#if error}
            <div class="error-banner">{error}</div>
        {/if}

        <div class="content">
            {#if !amount}
                <h3>Hoeveel wil je opladen?</h3>
                <div class="amount-grid">
                    {#each amounts as amt}
                        <button class="amount-tile" onclick={() => amount = amt}>
                            {formatPrice(amt)}
                        </button>
                    {/each}
                </div>
            {:else}
                <h3>Kies een betaalmethode voor {formatPrice(amount)}</h3>
                <div class="method-list">
                    <button class="method-btn" onclick={() => handleMethodSelect('epc_qr')} disabled={processing}>
                        <span class="method-icon">📱</span>
                        <div class="method-text">
                            <strong>QR-code (onmiddellijk)</strong>
                            <span>Scan de QR met je bank-app</span>
                        </div>
                    </button>
                    <button class="method-btn" onclick={() => handleMethodSelect('email_invoice')} disabled={processing}>
                        <span class="method-icon">📧</span>
                        <div class="method-text">
                            <strong>Per mail betalen (binnen 14 dagen)</strong>
                            <span>Ontvang een overschrijvingsformulier per e-mail</span>
                        </div>
                    </button>
                </div>
            {/if}
        </div>

        <footer>
            <button class="secondary outline" onclick={() => {
                if (amount) {
                    amount = null; // back to amount selection
                } else {
                    goto('/menu'); // back to menu
                }
            }}>
                {amount ? 'Kies ander bedrag' : 'Annuleer'}
            </button>
        </footer>
    </article>
</div>

<style>
    .topup-screen {
        position: fixed; inset: 0; z-index: 100;
        display: flex; justify-content: center; align-items: center;
        background: rgba(0,0,0,0.5);
    }
    .topup-modal {
        width: 90%; max-width: 800px;
        background: white; border-radius: 1rem;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        overflow: hidden; margin: 0;
    }
    .topup-modal header {
        background: var(--color-primary); color: white;
        padding: 2rem; text-align: center; margin: 0;
    }
    .topup-modal header h2 { margin: 0; font-size: 2rem; color: white; }
    
    .error-banner {
        background: var(--color-error); color: white;
        padding: 1rem; text-align: center; font-size: 1.2rem;
    }

    .content { padding: 2rem; text-align: center; }
    .content h3 { margin-top: 0; margin-bottom: 2rem; font-size: 1.75rem; }

    .amount-grid {
        display: flex; justify-content: center; gap: 1.5rem; flex-wrap: wrap;
    }
    .amount-tile {
        width: 150px; height: 120px; font-size: 2.5rem;
        background-color: #f1f3f5; color: var(--color-primary);
        border: 2px solid #e0e0e0; border-radius: 1rem;
        display: flex; align-items: center; justify-content: center;
        transition: all 0.2s; font-weight: bold;
    }
    .amount-tile:active { background-color: var(--color-primary); color: white; transform: scale(0.95); }

    .method-list { display: flex; flex-direction: column; gap: 1rem; }
    .method-btn {
        display: flex; align-items: center; gap: 1.5rem;
        padding: 1.5rem; border: 2px solid #e0e0e0; border-radius: 0.75rem;
        background: white; text-align: left; width: 100%; min-height: 80px;
    }
    .method-btn:active { border-color: var(--color-primary); transform: scale(0.98); }
    .method-icon { font-size: 2.5rem; flex-shrink: 0; }
    .method-text { display: flex; flex-direction: column; gap: 0.25rem; }
    .method-text strong { font-size: 1.4rem; color: var(--color-text); }
    .method-text span { font-size: 1rem; color: #666; }

    footer {
        padding: 1.5rem; text-align: center;
        border-top: 1px solid #e0e0e0;
    }
    footer button { min-width: 200px; height: 60px; font-size: 1.2rem; }
</style>
