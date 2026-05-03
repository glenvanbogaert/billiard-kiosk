import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';

export const POST = async ({ request }) => {
    const { saleId } = await request.json();

    if (!saleId) {
        return json({ error: 'Ongeldige bestelling' }, { status: 400 });
    }

    try {
        await db.begin(async (sql) => {
            const [sale] = await sql`
                SELECT id, payment_status
                FROM sales
                WHERE id = ${saleId} AND payment_method = 'epc_qr'
                FOR UPDATE
            `;

            if (!sale) {
                throw new Error('Bestelling niet gevonden');
            }

            if (sale.payment_status !== 'pending_payment_unverified') {
                throw new Error('Bestelling heeft onjuiste status');
            }

            // Mark the sale as abandoned. Stock was never decremented.
            await sql`
                UPDATE sales
                SET payment_status = 'abandoned', completed_at = now()
                WHERE id = ${saleId}
            `;
        });

        return json({ success: true });
    } catch (err: any) {
        return json({ error: err.message }, { status: 500 });
    }
};
