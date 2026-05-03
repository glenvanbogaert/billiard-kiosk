<script lang="ts">
	import '../app.css';
	let { children, data } = $props();
</script>

<main class="container">
	<nav>
		<ul>
			<li><strong>Billiard Admin</strong></li>
		</ul>
		<ul>
			<li><a href="/">Dashboard</a></li>
			<li><a href="/leden">Leden</a></li>
			<li><a href="/dranken">Dranken</a></li>
			<li><a href="/voorraad">Voorraad</a></li>
			<li><a href="/topups">Top-ups</a></li>
			<li><a href="/verkopen">Verkopen</a></li>
			<li><a href="/instellingen">Instellingen</a></li>
			{#if data.user}
				<li>
					<a href="/logout" data-sveltekit-preload-data="off" onclick={(e) => {
						e.preventDefault();
						fetch('/logout', { method: 'POST' }).then(() => window.location.href = '/login');
					}}>Uitloggen</a>
				</li>
			{:else}
				<li><a href="/login">Login</a></li>
			{/if}
		</ul>
	</nav>
	{@render children()}
</main>
