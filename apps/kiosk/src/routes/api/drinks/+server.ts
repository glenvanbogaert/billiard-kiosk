import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';

export const GET = async () => {
    const drinks = await db`
        SELECT d.id, d.name_nl, d.category_id, d.image_path, d.sale_price_incl_vat, c.name_nl as category_name
        FROM drinks d
        JOIN drink_categories c ON d.category_id = c.id
        WHERE d.is_active = true AND c.is_active = true
        ORDER BY c.sort_order ASC, d.sort_order ASC
    `;

    return json({ drinks: drinks.map(d => ({...d, sale_price_incl_vat: parseFloat(d.sale_price_incl_vat)})) });
};
