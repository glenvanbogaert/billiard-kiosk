import { db } from '$lib/server/db.js';
import { fail } from '@sveltejs/kit';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

// In dev: save to kiosk static folder so Vite serves them immediately.
// In production Docker: /var/lib/billiard/images is bind-mounted there.
const UPLOAD_DIR = path.resolve('apps/kiosk/static/images');

async function saveImage(file: File): Promise<string | null> {
    if (!file || file.size === 0) return null;
    if (!file.type.startsWith('image/')) throw new Error('Alleen afbeeldingen zijn toegestaan');

    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const filename = `${randomUUID()}.${ext === 'jpg' ? 'jpg' : ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    const buffer = Buffer.from(await file.arrayBuffer());

    await sharp(buffer)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .withMetadata(false)
        .toFile(filepath);

    return filename;
}

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
        const imageFile = data.get('imageFile') as File | null;

        if (!name || !categoryId || !salePrice || !purchasePrice || !vatRate) {
            return fail(400, { error: 'Vul alle verplichte velden in' });
        }

        try {
            const uploadedFilename = imageFile ? await saveImage(imageFile) : null;
            const imagePath = uploadedFilename || 'placeholder.svg';

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
        const name = data.get('name') as string;
        const description = data.get('description') as string;
        const categoryId = data.get('categoryId') as string;
        const salePrice = data.get('salePrice') as string;
        const purchasePrice = data.get('purchasePrice') as string;
        const vatRate = data.get('vatRate') as string;
        const lowStockThreshold = data.get('lowStockThreshold') as string;
        const imageFile = data.get('imageFile') as File | null;

        if (!drinkId || !name || !categoryId || !salePrice || !purchasePrice || !vatRate) {
            return fail(400, { error: 'Vul alle verplichte velden in' });
        }

        try {
            const uploadedFilename = imageFile ? await saveImage(imageFile) : null;

            if (uploadedFilename) {
                await db`
                    UPDATE drinks
                    SET name_nl          = ${name},
                        description_nl   = ${description || null},
                        category_id      = ${categoryId},
                        sale_price_incl_vat   = ${salePrice},
                        purchase_price_excl_vat = ${purchasePrice},
                        vat_rate         = ${vatRate},
                        low_stock_threshold = ${parseInt(lowStockThreshold) || 10},
                        image_path       = ${uploadedFilename},
                        updated_at       = now()
                    WHERE id = ${drinkId}
                `;
            } else {
                await db`
                    UPDATE drinks
                    SET name_nl          = ${name},
                        description_nl   = ${description || null},
                        category_id      = ${categoryId},
                        sale_price_incl_vat   = ${salePrice},
                        purchase_price_excl_vat = ${purchasePrice},
                        vat_rate         = ${vatRate},
                        low_stock_threshold = ${parseInt(lowStockThreshold) || 10},
                        updated_at       = now()
                    WHERE id = ${drinkId}
                `;
            }

            return { updated: true };
        } catch (err: any) {
            return fail(500, { error: err.message });
        }
    }
};
