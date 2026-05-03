import { createDbClient } from '@billiard/shared';

export const db = createDbClient(process.env.DATABASE_URL_KIOSK || 'postgresql://billiard_root:change_me_strong_random@localhost:5432/billiard');
