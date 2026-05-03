import bwipjs from 'bwip-js';

export function generateStructuredCommunication(referenceStr: string): string {
    const cleaned = referenceStr.replace(/[^0-9]/g, '');
    let padded = cleaned.padStart(10, '0');
    let checksum = parseInt(padded, 10) % 97;
    if (checksum === 0) checksum = 97;
    const checksumStr = checksum.toString().padStart(2, '0');
    const full = padded + checksumStr;
    return `+++${full.substring(0, 3)}/${full.substring(3, 7)}/${full.substring(7)}+++`;
}

export interface EPCData {
    beneficiaryName: string;
    iban: string;
    bic?: string;
    amount: number;
    structuredCommunication: string;
}

export function generateEPCPayload(data: EPCData): string {
    const amountStr = data.amount.toFixed(2);
    const lines = [
        'BCD',
        '002',
        '1',
        'SCT',
        data.bic || '',
        data.beneficiaryName.substring(0, 70),
        data.iban.replace(/\s+/g, ''),
        `EUR${amountStr}`,
        '',
        '',
        data.structuredCommunication,
        ''
    ];
    return lines.join('\n');
}

export function renderEPCQR(data: EPCData): Promise<Buffer> {
    const text = generateEPCPayload(data);
    return bwipjs.toBuffer({
        bcid: 'qrcode',
        text: text,
        scale: 3,
        height: 10,
        width: 10,
        includetext: false,
    });
}
