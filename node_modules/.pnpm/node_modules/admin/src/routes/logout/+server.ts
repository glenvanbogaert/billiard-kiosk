import { redirect } from '@sveltejs/kit';
import { revokeSession } from '$lib/server/auth.js';

export const POST = async ({ cookies }) => {
    const sessionId = cookies.get('session_id');
    if (sessionId) {
        await revokeSession(sessionId);
        cookies.delete('session_id', { path: '/' });
    }
    throw redirect(303, '/login');
};
