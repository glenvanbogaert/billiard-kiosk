import { db } from '$lib/server/db.js';
import { fail } from '@sveltejs/kit';

export const load = async () => {
    const drinks = await db`
        SELECT d.id, d.name_nl, d.description_nl, d.stock, d.sale_price_incl_vat, 
               d.purchase_price_excl_vat, d.vat_rate, d.low_stock_threshold,
               d.is_active, d.image_path, d.sort_order,
               c.name_nl as category_name, d.category_id
        FROM drinks d
        JOIN drink_categories c ON d.category_id = c.id
        ORDER BY c.sort_order ASC, d.sort_order ASC
    `;
    const categories = await db`SELECT id, name_nl FROM drink_categories WHERE is_active = true ORDER BY sort_order`;
    const vatRates = await db`SELECT rate, description_nl FROM vat_rates ORDER BY rate`;
    return { drinks, categories, vatRates };
};

export const actions = {
    addDrink: async ({ request }) => {
        const data = await request.formData();
        const name = data.get('name') as string;
        const description = data.get('description') as string;
        const categoryId = data.get('categoryId') as string;
        const salePrice = data.get('salePrice') as string;
        const purchasePrice = data.get('purchasePrice') as string;
        const vatRate = data.get('vatRate') as string;
        const lowStockThreshold = data.get('lowStockThreshold') as string;
        const imagePath = (data.get('imagePath') as string) || 'placeholder.svg';

        if (!name || !categoryId || !salePrice || !purchasePrice || !vatRate) {
            return fail(400, { error: 'Vul alle verplichte velden in' });
        }

        try {
            await db`
                INSERT INTO drinks (name_nl, description_nl, category_id, image_path, 
                    purchase_price_excl_vat, sale_price_incl_vat, vat_rate, low_stock_threshold, stock)
                VALUES (${name}, ${description || null}, ${categoryId}, ${imagePath},
                    ${purchasePrice}, ${salePrice}, ${vatRate}, ${parseInt(lowStockThreshold) || 10}, 0)
            `;
            return { success: true };
        } catch (err: any) {
            return fail(500, { error: err.message });
        }
    },

    updateDrink: async ({ request }) => {
        const data = await request.formData();
        const drinkId = data.get('drinkId') as string;
        const salePrice = data.get('salePrice') as string;
        const lowStockThreshold = data.get('lowStockThreshold') as string;

        if (!drinkId) return fail(400, { error: 'Drink ID ontbreekt' });

        try {
            await db`
                UPDATE drinks 
                SET sale_price_incl_vat = ${salePrice}, 
                    low_stock_threshold = ${parseInt(lowStockThreshold) || 10},
                    updated_at = now()
                WHERE id = ${drinkId}
            `;
            return { updated: true };
        } catch (err: any) {
            return fail(500, { error: err.message });
        }
    }
};
