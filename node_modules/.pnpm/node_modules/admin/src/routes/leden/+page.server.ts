import { db } from '$lib/server/db.js';
import { fail } from '@sveltejs/kit';

export const load = async () => {
    const members = await db`
        SELECT m.id, m.full_name, m.email, m.date_of_birth, m.status,
               m.cached_balance, m.preferred_topup_method, m.is_blocked_for_topup
        FROM members m
        ORDER BY m.full_name ASC
    `;
    return { members };
};

export const actions = {
    addMember: async ({ request }) => {
        const data = await request.formData();
        const fullName = data.get('fullName') as string;
        const email = data.get('email') as string;
        const dateOfBirth = data.get('dateOfBirth') as string;
        const cardIdentifier = data.get('cardIdentifier') as string;

        if (!fullName || !dateOfBirth) {
            return fail(400, { error: 'Naam en geboortedatum zijn verplicht' });
        }

        try {
            await db.begin(async (sql) => {
                const [member] = await sql`
                    INSERT INTO members (full_name, email, date_of_birth, gdpr_consent_at, gdpr_consent_version, preferred_topup_method)
                    VALUES (${fullName}, ${email || null}, ${dateOfBirth}, now(), 'v1.0-2026-05', 'epc_qr')
                    RETURNING id
                `;
                if (cardIdentifier) {
                    await sql`
                        INSERT INTO member_cards (member_id, card_identifier)
                        VALUES (${member.id}, ${cardIdentifier})
                    `;
                }
            });
            return { success: true };
        } catch (err: any) {
            if (err.message?.includes('date_of_birth')) {
                return fail(400, { error: 'Lid moet minstens 18 jaar oud zijn' });
            }
            return fail(500, { error: err.message });
        }
    },

    updateMember: async ({ request }) => {
        const data = await request.formData();
        const memberId = data.get('memberId') as string;
        const fullName = data.get('fullName') as string;
        const email = data.get('email') as string;
        const dateOfBirth = data.get('dateOfBirth') as string;
        const preferredTopupMethod = data.get('preferredTopupMethod') as string;
        const status = data.get('status') as string;

        if (!memberId || !fullName || !dateOfBirth) {
            return fail(400, { error: 'Naam en geboortedatum zijn verplicht' });
        }

        if (!['epc_qr', 'email_invoice'].includes(preferredTopupMethod)) {
            return fail(400, { error: 'Ongeldige opwaardeer methode' });
        }

        if (!['active', 'blocked'].includes(status)) {
            return fail(400, { error: 'Ongeldige status' });
        }

        try {
            await db`
                UPDATE members
                SET full_name             = ${fullName},
                    email                 = ${email || null},
                    date_of_birth         = ${dateOfBirth},
                    preferred_topup_method = ${preferredTopupMethod},
                    status                = ${status},
                    updated_at            = now()
                WHERE id = ${memberId}
            `;
            return { updated: true };
        } catch (err: any) {
            return fail(500, { error: err.message });
        }
    }
};
