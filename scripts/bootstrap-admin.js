import { createDbClient } from '../packages/shared/src/db.ts';
import { hash } from '@node-rs/argon2';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const db = createDbClient(process.env.DATABASE_URL_ADMIN || 'postgresql://billiard_root:change_me_strong_random@localhost:5432/billiard');

async function main() {
    console.log('--- Bootstrap First Admin ---');
    
    // Safety check
    const existingAdmins = await db`SELECT id FROM admins LIMIT 1`;
    if (existingAdmins.length > 0) {
        console.error('An admin already exists. Bootstrap script aborted for safety.');
        process.exit(1);
    }

    const rl = readline.createInterface({ input, output });

    const email = await rl.question('Admin Email: ');
    const fullName = await rl.question('Full Name: ');
    const password = await rl.question('Password: ');

    const passwordHash = await hash(password, {
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1
    });

    try {
        await db`
            INSERT INTO admins (email, full_name, password_hash, mfa_enabled)
            VALUES (${email}, ${fullName}, ${passwordHash}, false)
        `;
        console.log('Admin user created successfully.');
    } catch (err) {
        console.error('Failed to create admin:', err);
    } finally {
        rl.close();
        process.exit(0);
    }
}

main();
