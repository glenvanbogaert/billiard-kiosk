import { db } from '$lib/server/db.js';

export const load = async () => {
    const isTestMode = process.env.KIOSK_TEST_MODE === 'true';
    
    if (isTestMode) {
        const testCards = await db`
            SELECT m.id, m.full_name, mc.card_identifier
            FROM member_cards mc
            JOIN members m ON mc.member_id = m.id
            WHERE m.status = 'active'
        `;
        return {
            isTestMode,
            testCards
        };
    }
    
    return {
        isTestMode: false,
        testCards: []
    };
};
