import { db } from '$lib/server/db.js';

export const load = async () => {
    const drinks = await db`
        SELECT d.id, d.name_nl, d.stock, d.sale_price_incl_vat, c.name_nl as category_name
        FROM drinks d
        JOIN drink_categories c ON d.category_id = c.id
        ORDER BY c.sort_order ASC, d.sort_order ASC
    `;
    return { drinks };
};
