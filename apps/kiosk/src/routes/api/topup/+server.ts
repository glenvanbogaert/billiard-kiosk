import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { generateStructuredCommunication } from '@billiard/shared';

export const POST = async ({ request }) => {
    const { memberId, amount, method } = await request.json();

    if (!memberId || !amount || amount <= 0 || !['epc_qr', 'email_invoice'].includes(method)) {
        return json({ error: 'Ongeldig bedrag of methode' }, { status: 400 });
    }

    try {
        const result = await db.begin(async (sql) => {
            // Check member status
            const [member] = await sql`
                SELECT id, status, is_blocked_for_topup, email 
                FROM members WHERE id = ${memberId}
            `;
            if (!member || member.status !== 'active') {
                throw new Error('Member niet actief');
            }

            if (method === 'email_invoice') {
                if (member.is_blocked_for_topup) {
                    throw new Error('Deze kaart is geblokkeerd voor opwaarderen per mail.');
                }
                
                // Check outstanding cap
                const [capSetting] = await sql`SELECT value FROM settings WHERE key = 'topup_outstanding_cap_eur'`;
                const cap = parseFloat(capSetting?.value || '50');

                const [{ sum: outstanding }] = await sql`
                    SELECT COALESCE(SUM(amount), 0) as sum
                    FROM top_ups
                    WHERE member_id = ${memberId} 
                    AND status = 'pending_payment_unverified'
                    AND method = 'email_invoice'
                `;

                if (parseFloat(outstanding) + amount > cap) {
                    throw new Error(`Limiet overschreden. Je hebt nog €${parseFloat(outstanding).toFixed(2)} aan openstaande opwaardeerbeurten. Het limiet is €${cap.toFixed(2)}.`);
                }
            }

            // Create top-up record
            const [topup] = await sql`
                INSERT INTO top_ups (
                    member_id, 
                    amount, 
                    method, 
                    status,
                    expires_at
                )
                VALUES (
                    ${memberId}, 
                    ${amount}, 
                    ${method}, 
                    'pending_payment_unverified',
                    ${method === 'email_invoice' ? sql`now() + interval '14 days'` : sql`now() + interval '1 days'`}
                )
                RETURNING id
            `;

            // Always generate structured communication for tracking
            const structComm = generateStructuredCommunication(topup.id.toString());
            await sql`UPDATE top_ups SET structured_communication = ${structComm} WHERE id = ${topup.id}`;

            if (method === 'email_invoice') {
                // Queue notification
                if (member.email) {
                    // Get bank settings for the email
                    const settingsRows = await sql`SELECT key, value FROM settings WHERE key IN ('club_iban', 'club_beneficiary_name', 'club_bic')`;
                    const s = new Map(settingsRows.map(row => [row.key, row.value]));
                    
                    const body = `Je hebt gevraagd om je saldo op te waarderen met €${amount.toFixed(2)}.\n\n` +
                                 `Gelieve dit bedrag binnen de 14 dagen over te schrijven:\n` +
                                 `Naam: ${s.get('club_beneficiary_name')}\n` +
                                 `IBAN: ${s.get('club_iban')}\n` +
                                 `BIC: ${s.get('club_bic') || '-'}\n` +
                                 `Mededeling: +++${structComm}+++\n\n` +
                                 `Bedankt!`;

                    await sql`
                        INSERT INTO notifications (channel, recipient, subject, body, category, related_entity_type, related_entity_id, status)
                        VALUES ('email', ${member.email}, 'Opwaardering saldo', ${body}, 'topup_pending', 'top_up', ${topup.id}, 'pending')
                    `;
                }
            }

            return { topupId: topup.id, structuredCommunication: structComm };
        });

        return json(result);
    } catch (err: any) {
        return json({ error: err.message }, { status: 500 });
    }
};
