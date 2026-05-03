import { validateSession } from '$lib/server/auth.js';
import { redirect, type Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
    const sessionId = event.cookies.get('session_id');

    if (sessionId) {
        const session = await validateSession(sessionId);
        if (session) {
            event.locals.user = session;
        } else {
            event.cookies.delete('session_id', { path: '/' });
        }
    }

    if (event.url.pathname.startsWith('/login')) {
        if (event.locals.user) {
            throw redirect(303, '/');
        }
    } else {
        if (!event.locals.user) {
            throw redirect(303, '/login');
        }
    }

    return resolve(event);
};
