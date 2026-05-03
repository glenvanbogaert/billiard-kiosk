import { createDbClient } from '@billiard/shared';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from monorepo root (two levels up from apps/kiosk/)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export const db = createDbClient(process.env.DATABASE_URL_KIOSK || 'postgresql://billiard_root:change_me_strong_random@localhost:5432/billiard');
