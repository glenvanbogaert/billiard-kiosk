import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { generateStructuredCommunication } from '@billiard/shared';

export const POST = async ({ request }) => {
    const { memberId, amount } = await request.json();

    if (!memberId || !amount || amount <= 0) {
        return json({ error: 'Ongeldig bedrag' }, { status: 400 });
    }

    try {
        const result = await db.begin(async (sql) => {
            const [topup] = await sql`
                INSERT INTO top_ups (member_id, amount, method, status)
                VALUES (${memberId}, ${amount}, 'epc_qr', 'pending_payment_unverified')
                RETURNING id
            `;

            const structComm = generateStructuredCommunication(topup.id.toString());

            await sql`UPDATE top_ups SET structured_communication = ${structComm} WHERE id = ${topup.id}`;

            return { topupId: topup.id, structuredCommunication: structComm };
        });

        return json(result);
    } catch (err: any) {
        return json({ error: err.message }, { status: 500 });
    }
};
