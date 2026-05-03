import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { verify } from '@node-rs/argon2';
import { createSession } from '$lib/server/auth.js';

export const actions = {
    default: async ({ request, cookies }) => {
        const data = await request.formData();
        const email = data.get('email');
        const password = data.get('password');

        if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
            return fail(400, { error: 'Vul email en wachtwoord in.' });
        }

        const [admin] = await db`
            SELECT id, password_hash, is_active, failed_login_count, locked_until
            FROM admins
            WHERE email = ${email}
        `;

        if (!admin) {
            await new Promise(r => setTimeout(r, 500));
            return fail(401, { error: 'Ongeldige inloggegevens.' });
        }

        if (!admin.is_active) {
            return fail(403, { error: 'Account is gedeactiveerd.' });
        }

        if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
            return fail(403, { error: 'Account is tijdelijk geblokkeerd. Probeer later opnieuw.' });
        }

        const isValid = await verify(admin.password_hash, password);

        if (!isValid) {
            const newCount = admin.failed_login_count + 1;
            let lockedUntil = null;
            if (newCount >= 5) {
                lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
            }
            await db`UPDATE admins SET failed_login_count = ${newCount}, locked_until = ${lockedUntil} WHERE id = ${admin.id}`;
            return fail(401, { error: 'Ongeldige inloggegevens.' });
        }

        await db`UPDATE admins SET failed_login_count = 0, locked_until = NULL, last_login_at = now() WHERE id = ${admin.id}`;

        const ip = 'unknown'; 
        const userAgent = request.headers.get('user-agent') || 'Unknown';
        
        const { sessionId, expiresAt } = await createSession(admin.id, ip, userAgent);

        cookies.set('session_id', sessionId, {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            expires: expiresAt
        });

        throw redirect(303, '/');
    }
};
