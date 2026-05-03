import { db } from '$lib/server/db.js';

export const load = async () => {
    const sales = await db`
        SELECT s.id, s.total_incl_vat, s.payment_method, s.payment_status, s.completed_at, m.full_name
        FROM sales s
        JOIN members m ON s.member_id = m.id
        ORDER BY s.initiated_at DESC
        LIMIT 100
    `;
    return { sales };
};
