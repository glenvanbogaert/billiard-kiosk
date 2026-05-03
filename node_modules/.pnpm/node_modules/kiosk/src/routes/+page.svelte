<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { kioskState } from '$lib/store.svelte.js';

    let scanMessage = $state("Scan je lidkaart om te starten");
    let isError = $state(false);
    let isProcessing = $state(false);

    onMount(() => {
        const handleScan = async (e: CustomEvent<string>) => {
            if (isProcessing) return;
            const barcode = e.detail;
            
            if (barcode) {
                isProcessing = true;
                scanMessage = "Lidkaart herkend... Even geduld.";
                isError = false;
                
                try {
                    const res = await fetch('/api/auth/scan', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ barcode })
                    });
                    
                    const data = await res.json();
                    
                    if (res.ok && data.member) {
                        kioskState.member = data.member;
                        goto('/menu');
                    } else {
                        isError = true;
                        scanMessage = data.error || 'Kaart niet herkend';
                        setTimeout(() => {
                            scanMessage = "Scan je lidkaart om te starten";
                            isError = false;
                            isProcessing = false;
                        }, 3000);
                    }
                } catch (err) {
                    isError = true;
                    scanMessage = 'Netwerkfout bij inloggen';
                    setTimeout(() => {
                        scanMessage = "Scan je lidkaart om te starten";
                        isError = false;
                        isProcessing = false;
                    }, 3000);
                }
            }
        };

        document.addEventListener('barcode-scan', handleScan as EventListener);
        return () => {
            document.removeEventListener('barcode-scan', handleScan as EventListener);
        };
    });
</script>

<div style="display: flex; height: 100vh; justify-content: center; align-items: center; text-align: center; flex-direction: column;">
    <h1 style="font-size: var(--font-size-receipt); margin-bottom: 2rem;">Welkom bij {import.meta.env.VITE_PUBLIC_CLUB_NAME || 'Biljartclub Wortegem'}</h1>
    
    <div style="padding: 4rem; background-color: var(--color-primary); color: white; border-radius: 1rem; box-shadow: 0 10px 20px rgba(0,0,0,0.2);">
        <p style="font-size: var(--font-size-button); margin: 0;">
            {#if isError}
                <span style="color: #ffcccc;">{scanMessage}</span>
            {:else}
                {scanMessage}
            {/if}
        </p>
    </div>
</div>
