import { db } from '$lib/server/db.js';

export const load = async () => {
    const members = await db`
        SELECT m.id, m.full_name, m.email, m.status, m.cached_balance, m.preferred_topup_method
        FROM members m
        ORDER BY m.full_name ASC
    `;
    return { members };
};
