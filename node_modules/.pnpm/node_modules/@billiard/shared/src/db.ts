import postgres from 'postgres';

export function createDbClient(connectionString: string, maxConnections: number = 10) {
    return postgres(connectionString, {
        max: maxConnections,
        transform: {
            undefined: null
        }
    });
}
