import { renderEPCQR } from '@billiard/shared';
import { db } from '$lib/server/db.js';

export const GET = async ({ params }) => {
    const structComm = params.text;
    if (!structComm) return new Response('Missing structured communication', { status: 400 });

    const [topup] = await db`SELECT amount FROM top_ups WHERE structured_communication = ${structComm}`;
    if (!topup) return new Response('Topup not found', { status: 404 });

    const settingsRows = await db`SELECT key, value FROM settings WHERE key IN ('club_iban', 'club_bic', 'club_beneficiary_name')`;
    const settings = settingsRows.reduce((acc, row) => {
        acc[row.key] = row.value;
        return acc;
    }, {} as Record<string, string>);

    const qrBuffer = await renderEPCQR({
        beneficiaryName: settings['club_beneficiary_name'] || 'Wase Biljart Belangen',
        iban: settings['club_iban'] || 'BE00000000000000',
        bic: settings['club_bic'],
        amount: parseFloat(topup.amount),
        structuredCommunication: structComm
    });

    return new Response(qrBuffer, {
        headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=86400'
        }
    });
};
