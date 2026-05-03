<script lang="ts">
	import '../app.css';
	let { children } = $props();
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
			<li><a href="/login">Login</a></li>
		</ul>
	</nav>
	{@render children()}
</main>
