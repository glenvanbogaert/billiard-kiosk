import { db } from '$lib/server/db.js';

export const load = async () => {
    const [{ count: openTopups }] = await db`SELECT COUNT(*) FROM top_ups WHERE status != 'paid'`;
    
    const lowStock = await db`SELECT id, name_nl, stock FROM drinks WHERE is_active = true AND stock <= low_stock_threshold`;
    
    const [{ total_sales }] = await db`
        SELECT COALESCE(SUM(total_incl_vat), 0) as total_sales 
        FROM sales 
        WHERE completed_at >= current_date
    `;

    return {
        openTopups: parseInt(openTopups),
        lowStock,
        totalSalesToday: parseFloat(total_sales)
    };
};
