import { db } from '$lib/server/db.js';

export const load = async () => {
    const isTestMode = process.env.KIOSK_TEST_MODE === 'true';
    const clubName = process.env.PUBLIC_CLUB_NAME || 'Wase Biljart Belangen';

    if (isTestMode) {
        const testCards = await db`
            SELECT m.id, m.full_name, mc.card_identifier
            FROM member_cards mc
            JOIN members m ON mc.member_id = m.id
            WHERE m.status = 'active'
        `;
        return {
            isTestMode,
            testCards,
            clubName
        };
    }

    return {
        isTestMode: false,
        testCards: [],
        clubName
    };
};
