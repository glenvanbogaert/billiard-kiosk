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
			<li>
				{#if data.user}
					<form method="POST" action="/logout" style="margin: 0;">
						<button type="submit" class="outline" style="margin: 0; padding: 0.25rem 0.75rem;">
							Uitloggen
						</button>
					</form>
				{:else}
					<a href="/login">Login</a>
				{/if}
			</li>
		</ul>
	</nav>
	{@render children()}
</main>
