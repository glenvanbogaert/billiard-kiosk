import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { generateStructuredCommunication } from '@billiard/shared';

export const POST = async ({ request }) => {
    const { memberId, cart, paymentMethod } = await request.json();

    if (!memberId || !cart || cart.length === 0 || !paymentMethod) {
        return json({ error: 'Ongeldige bestelling' }, { status: 400 });
    }

    try {
        const result = await db.begin(async (sql) => {
            const [member] = await sql`
                SELECT id, cached_balance, status
                FROM members
                WHERE id = ${memberId} FOR UPDATE
            `;

            if (!member || member.status !== 'active') {
                throw new Error('Member niet actief');
            }

            // Calculate line totals
            let totalExcl = 0;
            let totalVat = 0;
            let totalIncl = 0;
            const linesToInsert = [];

            for (const item of cart) {
                const [drink] = await sql`SELECT * FROM drinks WHERE id = ${item.drink.id}`;
                if (!drink || !drink.is_active) throw new Error(`Drink ${item.drink.id} niet beschikbaar`);

                const qty = item.quantity;
                const vatRate = parseFloat(drink.vat_rate);
                const unitIncl = parseFloat(drink.sale_price_incl_vat);
                const unitExcl = unitIncl / (1 + vatRate);

                const lineIncl = unitIncl * qty;
                const lineExcl = unitExcl * qty;
                const lineVat = lineIncl - lineExcl;

                totalExcl += lineExcl;
                totalVat += lineVat;
                totalIncl += lineIncl;

                linesToInsert.push({
                    drink_id: drink.id,
                    drink_name_snapshot: drink.name_nl,
                    unit_price_excl_vat_snapshot: unitExcl,
                    vat_rate_snapshot: vatRate,
                    unit_price_incl_vat_snapshot: unitIncl,
                    quantity: qty,
                    line_total_excl_vat: lineExcl,
                    line_total_vat: lineVat,
                    line_total_incl_vat: lineIncl
                });
            }

            const currentBalance = parseFloat(member.cached_balance);

            if (paymentMethod === 'member_card') {
                // ── Member card: immediate balance debit ──
                if (currentBalance - totalIncl < -50) {
                    throw new Error('INSUFFICIENT_FUNDS');
                }

                const [sale] = await sql`
                    INSERT INTO sales (member_id, payment_method, payment_status, total_excl_vat, total_vat, total_incl_vat, completed_at)
                    VALUES (${memberId}, 'member_card', 'paid_member_card', ${totalExcl}, ${totalVat}, ${totalIncl}, now())
                    RETURNING id
                `;

                for (const line of linesToInsert) {
                    await sql`
                        INSERT INTO sale_lines (sale_id, drink_id, drink_name_snapshot, unit_price_excl_vat_snapshot, vat_rate_snapshot, unit_price_incl_vat_snapshot, quantity, line_total_excl_vat, line_total_vat, line_total_incl_vat)
                        VALUES (${sale.id}, ${line.drink_id}, ${line.drink_name_snapshot}, ${line.unit_price_excl_vat_snapshot}, ${line.vat_rate_snapshot}, ${line.unit_price_incl_vat_snapshot}, ${line.quantity}, ${line.line_total_excl_vat}, ${line.line_total_vat}, ${line.line_total_incl_vat})
                    `;
                    await sql`UPDATE drinks SET stock = stock - ${line.quantity} WHERE id = ${line.drink_id}`;
                    await sql`INSERT INTO stock_transactions (drink_id, delta, type, related_sale_id) VALUES (${line.drink_id}, ${-line.quantity}, 'sale', ${sale.id})`;
                }

                await sql`
                    INSERT INTO balance_transactions (member_id, delta, type, related_sale_id)
                    VALUES (${memberId}, ${-totalIncl}, 'sale_debit', ${sale.id})
                `;

                return { saleId: sale.id, newBalance: currentBalance - totalIncl };

            } else if (paymentMethod === 'epc_qr') {
                // ── EPC QR: pending sale, no stock decrement yet ──
                const [sale] = await sql`
                    INSERT INTO sales (member_id, payment_method, payment_status, total_excl_vat, total_vat, total_incl_vat)
                    VALUES (${memberId}, 'epc_qr', 'pending_payment_unverified', ${totalExcl}, ${totalVat}, ${totalIncl})
                    RETURNING id
                `;

                const structComm = generateStructuredCommunication(sale.id.toString());
                await sql`UPDATE sales SET structured_communication = ${structComm} WHERE id = ${sale.id}`;

                for (const line of linesToInsert) {
                    await sql`
                        INSERT INTO sale_lines (sale_id, drink_id, drink_name_snapshot, unit_price_excl_vat_snapshot, vat_rate_snapshot, unit_price_incl_vat_snapshot, quantity, line_total_excl_vat, line_total_vat, line_total_incl_vat)
                        VALUES (${sale.id}, ${line.drink_id}, ${line.drink_name_snapshot}, ${line.unit_price_excl_vat_snapshot}, ${line.vat_rate_snapshot}, ${line.unit_price_incl_vat_snapshot}, ${line.quantity}, ${line.line_total_excl_vat}, ${line.line_total_vat}, ${line.line_total_incl_vat})
                    `;
                }

                return { saleId: sale.id, structuredCommunication: structComm };

            } else if (paymentMethod === 'cash') {
                // ── Cash: immediate sale, no balance impact ──
                const [sale] = await sql`
                    INSERT INTO sales (member_id, payment_method, payment_status, total_excl_vat, total_vat, total_incl_vat, completed_at)
                    VALUES (${memberId}, 'cash', 'paid_cash', ${totalExcl}, ${totalVat}, ${totalIncl}, now())
                    RETURNING id
                `;

                for (const line of linesToInsert) {
                    await sql`
                        INSERT INTO sale_lines (sale_id, drink_id, drink_name_snapshot, unit_price_excl_vat_snapshot, vat_rate_snapshot, unit_price_incl_vat_snapshot, quantity, line_total_excl_vat, line_total_vat, line_total_incl_vat)
                        VALUES (${sale.id}, ${line.drink_id}, ${line.drink_name_snapshot}, ${line.unit_price_excl_vat_snapshot}, ${line.vat_rate_snapshot}, ${line.unit_price_incl_vat_snapshot}, ${line.quantity}, ${line.line_total_excl_vat}, ${line.line_total_vat}, ${line.line_total_incl_vat})
                    `;
                    await sql`UPDATE drinks SET stock = stock - ${line.quantity} WHERE id = ${line.drink_id}`;
                    await sql`INSERT INTO stock_transactions (drink_id, delta, type, related_sale_id) VALUES (${line.drink_id}, ${-line.quantity}, 'sale', ${sale.id})`;
                }

                return { saleId: sale.id };

            } else {
                throw new Error('Onbekende betaalmethode');
            }
        });

        return json(result);
    } catch (err: any) {
        if (err.message === 'INSUFFICIENT_FUNDS') {
            return json({ error: 'INSUFFICIENT_FUNDS' }, { status: 402 });
        }
        return json({ error: err.message }, { status: 500 });
    }
};
