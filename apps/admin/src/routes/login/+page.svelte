<script lang="ts">
    let { form } = $props();
</script>

<div class="container" style="max-width: 400px; margin-top: 5rem;">
    <article>
        <header>
            <h2>Billiard Admin Login</h2>
        </header>

        {#if form?.error}
            <p style="color: var(--color-error);">{form.error}</p>
        {/if}

        <form method="POST">
            <label for="email">Email</label>
            <input type="email" id="email" name="email" required />

            <label for="password">Wachtwoord</label>
            <input type="password" id="password" name="password" required />

            <button type="submit">Log in</button>
        </form>
    </article></div>
