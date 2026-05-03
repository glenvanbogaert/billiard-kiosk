export function validateIBAN(iban: string): boolean {
    const cleaned = iban.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (cleaned.length < 15 || cleaned.length > 34) return false;

    const rearranged = cleaned.substring(4) + cleaned.substring(0, 4);
    const numericIban = rearranged.split('').map(char => {
        const code = char.charCodeAt(0);
        return code >= 65 && code <= 90 ? (code - 55).toString() : char;
    }).join('');

    let remainder = numericIban;
    let block;
    while (remainder.length > 2) {
        block = remainder.slice(0, 9);
        remainder = (parseInt(block, 10) % 97) + remainder.slice(block.length);
    }
    return parseInt(remainder, 10) % 97 === 1;
}

export function validateBelgianVAT(vat: string): boolean {
    const cleaned = vat.replace(/[^0-9]/g, '');
    if (cleaned.length !== 10) return false;
    if (!cleaned.startsWith('0') && !cleaned.startsWith('1')) return false;

    const base = parseInt(cleaned.substring(0, 8), 10);
    const checksum = parseInt(cleaned.substring(8, 10), 10);
    return (base + checksum) % 97 === 0;
}
