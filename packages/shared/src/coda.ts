export interface CodaTransaction {
    bookingDate: Date;
    valueDate?: Date;
    amount: number;
    counterpartyName?: string;
    counterpartyIban?: string;
    structuredCommunication?: string;
    freeText?: string;
    bankReference: string;
    rawRecord: string;
}

export function parseCoda(fileContent: string): CodaTransaction[] {
    const lines = fileContent.split('\n');
    const transactions: CodaTransaction[] = [];
    
    // In a full implementation, you parse the CODA standard format.
    // This is a placeholder structure based on section 7.5.
    
    return transactions;
}
