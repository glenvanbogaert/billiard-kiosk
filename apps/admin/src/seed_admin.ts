import { db } from './lib/server/db.js';
import { hash } from '@node-rs/argon2';

async function run() {
    const h = await hash('change_me', {
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1
    });
    await db`INSERT INTO admins (email, full_name, password_hash, is_active) VALUES ('admin@example.com', 'Admin User', ${h}, true)`;
    console.log('Admin created: admin@example.com / change_me');
    process.exit(0);
}

run();
