<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';

	let { children } = $props();
	let isOnline = $state(true);

	onMount(() => {
		const interval = setInterval(async () => {
			try {
				const res = await fetch('/api/health');
				isOnline = res.ok;
			} catch (e) {
				isOnline = false;
			}
		}, 10000);

		let wakeLock: WakeLockSentinel | null = null;
		const requestWakeLock = async () => {
			try {
				if ('wakeLock' in navigator) {
					wakeLock = await navigator.wakeLock.request('screen');
				}
			} catch (err) {
				console.error(`${err.name}, ${err.message}`);
			}
		};

		requestWakeLock();
		document.addEventListener('visibilitychange', () => {
			if (wakeLock !== null && document.visibilityState === 'visible') {
				requestWakeLock();
			}
		});

        let barcodeBuffer = '';
        let barcodeTimeout: ReturnType<typeof setTimeout>;

        const handleKeydown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                if (barcodeBuffer.length > 0) {
                    document.dispatchEvent(new CustomEvent('barcode-scan', { detail: barcodeBuffer }));
                    barcodeBuffer = '';
                }
                return;
            }

            if (e.ctrlKey || e.altKey || e.metaKey) return;

            if (e.key.length === 1) {
                barcodeBuffer += e.key;
                clearTimeout(barcodeTimeout);
                barcodeTimeout = setTimeout(() => {
                    barcodeBuffer = '';
                }, 100);
            }
        };

        window.addEventListener('keydown', handleKeydown);

		return () => {
            clearInterval(interval);
            window.removeEventListener('keydown', handleKeydown);
        };
	});
</script>

{#if !isOnline}
	<div style="background-color: var(--color-error); color: white; text-align: center; padding: 10px; font-weight: bold; position: fixed; top: 0; width: 100%; z-index: 9999;">
		Geen verbinding — probeer opnieuw
	</div>
{/if}

{@render children()}
