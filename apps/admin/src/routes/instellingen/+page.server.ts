import { db } from '$lib/server/db.js';
import { fail } from '@sveltejs/kit';

const MANAGED_KEYS = [
    // Bank / EPC
    'club_beneficiary_name',
    'club_iban',
    'club_bic',
    // Topup limits
    'topup_outstanding_cap_eur',
    // Notifications
    'notification_low_stock_email',
    'notification_low_stock_ntfy',
    // Kiosk behaviour (read-only hint, set via .env)
];

export const load = async () => {
    const rows = await db`SELECT key, value, description_nl FROM settings ORDER BY key`;
    // Convert to a plain object for easy template use
    const settings: Record<string, { value: string; description: string }> = {};
    for (const row of rows) {
        settings[row.key] = { value: row.value, description: row.description_nl ?? '' };
    }
    return { settings };
};

export const actions = {
    saveSetting: async ({ request }) => {
        const data = await request.formData();
        const key   = data.get('key') as string;
        const value = data.get('value') as string;

        if (!key) return fail(400, { error: 'Sleutel ontbreekt' });

        try {
            // Upsert: update if exists, insert if not
            await db`
                INSERT INTO settings (key, value, updated_at)
                VALUES (${key}, ${value}, now())
                ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = now()
            `;
            return { saved: key };
        } catch (err: any) {
            return fail(500, { error: err.message });
        }
    }
};
