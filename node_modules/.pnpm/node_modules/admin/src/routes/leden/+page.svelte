<script lang="ts">
    let { data } = $props();
    const formatPrice = (price: number | string) => `€${parseFloat(price as string).toFixed(2)}`;
</script>

<article>
    <header style="display: flex; justify-content: space-between; align-items: center;">
        <h2>Leden</h2>
    </header>
    
    <div class="overflow-auto">
        <table class="striped">
            <thead>
                <tr>
                    <th>Naam</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Saldo</th>
                    <th>Opwaardeer Methode</th>
                </tr>
            </thead>
            <tbody>
                {#each data.members as member}
                    <tr>
                        <td><strong>{member.full_name}</strong></td>
                        <td>{member.email}</td>
                        <td>
                            <span class="badge {member.status === 'active' ? 'success' : 'error'}">
                                {member.status}
                            </span>
                        </td>
                        <td class={parseFloat(member.cached_balance) < 0 ? 'text-error' : 'text-success'}>
                            {formatPrice(member.cached_balance)}
                        </td>
                        <td>{member.preferred_topup_method}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
</article>

<style>
    .badge { padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8em; }
    .success { background-color: var(--color-success); color: white; }
    .error { background-color: var(--color-error); color: white; }
    .text-error { color: var(--color-error); font-weight: bold; }
    .text-success { color: var(--color-success); }
</style>
