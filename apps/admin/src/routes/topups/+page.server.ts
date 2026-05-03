import { db } from '$lib/server/db.js';
import { fail } from '@sveltejs/kit';

export const load = async () => {
    const topups = await db`
        SELECT t.id, t.amount, t.method, t.status, t.initiated_at, m.full_name
        FROM top_ups t
        JOIN members m ON t.member_id = m.id
        ORDER BY t.initiated_at DESC
        LIMIT 50
    `;
    return { topups };
};

export const actions = {
    markPaid: async ({ request }) => {
        const data = await request.formData();
        const topupId = data.get('topupId');
        
        if (!topupId) return fail(400, { error: 'Top-up ID ontbreekt' });

        try {
            await db.begin(async (sql) => {
                const [topup] = await sql`
                    SELECT id, amount, member_id, status 
                    FROM top_ups 
                    WHERE id = ${topupId} FOR UPDATE
                `;

                if (!topup || topup.status === 'paid_manual_admin') {
                    throw new Error('Top-up niet gevonden of al betaald');
                }

                await sql`
                    UPDATE top_ups 
                    SET status = 'paid_manual_admin', completed_at = now() 
                    WHERE id = ${topup.id}
                `;

                await sql`
                    INSERT INTO balance_transactions (member_id, delta, type, related_topup_id)
                    VALUES (${topup.member_id}, ${topup.amount}, 'topup_paid', ${topup.id})
                `;
            });
            return { success: true };
        } catch (err: any) {
            return fail(400, { error: err.message });
        }
    }
};
