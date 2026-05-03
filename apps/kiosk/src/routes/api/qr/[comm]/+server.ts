import { db } from '$lib/server/db.js';
import { generateEPCPayload } from '@billiard/shared';
import QRCode from 'qrcode';

export const GET = async ({ params }) => {
    const { comm } = params;

    // Check if it's for a sale or a topup
    const [sale] = await db`SELECT * FROM sales WHERE structured_communication = ${comm}`;
    const [topup] = await db`SELECT * FROM top_ups WHERE structured_communication = ${comm}`;

    if (!sale && !topup) {
        return new Response('Not found', { status: 404 });
    }

    const amount = sale ? parseFloat(sale.total_incl_vat) : parseFloat(topup.amount);

    // Get club bank details from settings
    const settings = await db`SELECT key, value FROM settings WHERE key IN ('club_iban', 'club_beneficiary_name', 'club_bic')`;
    const settingsMap = new Map(settings.map(s => [s.key, s.value]));

    const iban = settingsMap.get('club_iban')?.replace(/\s+/g, '') || '';
    const beneficiary = settingsMap.get('club_beneficiary_name') || 'Biljartclub Wortegem';
    const bic = settingsMap.get('club_bic') || '';

    const epcString = generateEPCPayload({
        beneficiaryName: beneficiary,
        iban: iban,
        amount: amount,
        structuredCommunication: comm,
        bic: bic || undefined
    });

    try {
        const qrBuffer = await QRCode.toBuffer(epcString, {
            type: 'png',
            margin: 2,
            width: 400
        });

        return new Response(qrBuffer, {
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=86400'
            }
        });
    } catch (e) {
        return new Response('Error generating QR', { status: 500 });
    }
};
