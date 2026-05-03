import { db } from '$lib/server/db.js';
import { fail } from '@sveltejs/kit';

export const load = async () => {
    const drinks = await db`
        SELECT d.id, d.name_nl, d.stock, d.low_stock_threshold, d.is_active,
               c.name_nl as category_name
        FROM drinks d
        JOIN drink_categories c ON d.category_id = c.id
        WHERE d.is_active = true
        ORDER BY c.sort_order ASC, d.sort_order ASC
    `;
    return { drinks };
};

export const actions = {
    restock: async ({ request, locals }) => {
        const data = await request.formData();
        const drinkId = data.get('drinkId');
        const quantity = parseInt(data.get('quantity') as string);

        if (!drinkId || isNaN(quantity) || quantity <= 0) {
            return fail(400, { error: 'Ongeldig drink ID of hoeveelheid' });
        }

        try {
            await db.begin(async (sql) => {
                await sql`
                    UPDATE drinks SET stock = stock + ${quantity}, updated_at = now()
                    WHERE id = ${drinkId}
                `;
                await sql`
                    INSERT INTO stock_transactions (drink_id, delta, type, reason, admin_id)
                    VALUES (${drinkId}, ${quantity}, 'restock', 'Voorraad aanvulling via admin', ${locals.user?.adminId ?? null})
                `;
            });
            return { success: true };
        } catch (err: any) {
            return fail(500, { error: err.message });
        }
    },

    correctStock: async ({ request, locals }) => {
        const data = await request.formData();
        const drinkId = data.get('drinkId') as string;
        const newStock = parseInt(data.get('newStock') as string);

        if (!drinkId || isNaN(newStock) || newStock < 0) {
            return fail(400, { error: 'Ongeldig drink ID of voorraad' });
        }

        try {
            await db.begin(async (sql) => {
                const [drink] = await sql`SELECT stock FROM drinks WHERE id = ${drinkId}`;
                const delta = newStock - drink.stock;

                await sql`
                    UPDATE drinks SET stock = ${newStock}, updated_at = now()
                    WHERE id = ${drinkId}
                `;

                if (delta !== 0) {
                    await sql`
                        INSERT INTO stock_transactions (drink_id, delta, type, reason, admin_id)
                        VALUES (${drinkId}, ${delta}, 'correction', 'Handmatige correctie via admin', ${locals.user?.adminId ?? null})
                    `;
                }
            });
            return { corrected: true };
        } catch (err: any) {
            return fail(500, { error: err.message });
        }
    }
};
