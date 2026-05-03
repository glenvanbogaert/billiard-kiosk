import { createDbClient } from '@billiard/shared';

// Use environment variable if available, else fallback for local development
export const db = createDbClient(process.env.DATABASE_URL_ADMIN || 'postgresql://billiard_root:change_me_strong_random@localhost:5432/billiard');
