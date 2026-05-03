import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';

export const POST = async ({ request }) => {
    const { saleId } = await request.json();

    if (!saleId) {
        return json({ error: 'Ongeldige bestelling' }, { status: 400 });
    }

    try {
        await db.begin(async (sql) => {
            // Check if sale exists and is pending
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

            // In the EPC QR flow, "Ik heb betaald" just means the user confirms they scanned the code.
            // The sale stays 'pending_payment_unverified' until reconciled with CODA.
            // However, we DO decrement the stock now, because the user walks away with the drinks.
            
            const lines = await sql`
                SELECT drink_id, quantity
                FROM sale_lines
                WHERE sale_id = ${saleId}
            `;

            for (const line of lines) {
                await sql`UPDATE drinks SET stock = stock - ${line.quantity} WHERE id = ${line.drink_id}`;
                await sql`
                    INSERT INTO stock_transactions (drink_id, delta, type, related_sale_id)
                    VALUES (${line.drink_id}, ${-line.quantity}, 'sale', ${saleId})
                `;
            }

            // We mark completed_at = now() to indicate the user interaction is done,
            // even though payment_status is still pending.
            await sql`
                UPDATE sales
                SET completed_at = now()
                WHERE id = ${saleId}
            `;
        });

        return json({ success: true });
    } catch (err: any) {
        return json({ error: err.message }, { status: 500 });
    }
};
