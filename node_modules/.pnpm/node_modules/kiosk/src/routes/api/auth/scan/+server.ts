import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';

export const POST = async ({ request }) => {
    const { barcode } = await request.json();

    if (!barcode) return json({ error: 'Barcode vereist' }, { status: 400 });

    const [memberCard] = await db`
        SELECT m.id, m.full_name, m.cached_balance, m.status, mc.status as card_status
        FROM member_cards mc
        JOIN members m ON mc.member_id = m.id
        WHERE mc.card_identifier = ${barcode}
    `;

    if (!memberCard) {
        return json({ error: 'Kaart niet herkend' }, { status: 404 });
    }

    if (memberCard.card_status !== 'active' || memberCard.status !== 'active') {
        return json({ error: 'Kaart of account is niet actief' }, { status: 403 });
    }

    return json({
        member: {
            id: memberCard.id,
            full_name: memberCard.full_name,
            cached_balance: parseFloat(memberCard.cached_balance)
        }
    });
};
