import { db } from './db.js';
import crypto from 'crypto';

export async function createSession(adminId: number, ip: string, userAgent: string) {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const hashedSessionId = crypto.createHash('sha256').update(sessionId).digest('hex');
    
    // 8-hour absolute expiry
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);

    await db`
        INSERT INTO admin_sessions (id, admin_id, expires_at, ip, user_agent)
        VALUES (${hashedSessionId}, ${adminId}, ${expiresAt}, ${ip}, ${userAgent})
    `;

    return { sessionId, expiresAt };
}

export async function validateSession(sessionId: string) {
    const hashedSessionId = crypto.createHash('sha256').update(sessionId).digest('hex');
    
    const [session] = await db`
        SELECT s.*, a.email, a.full_name, a.is_active
        FROM admin_sessions s
        JOIN admins a ON s.admin_id = a.id
        WHERE s.id = ${hashedSessionId} 
          AND s.revoked_at IS NULL 
          AND s.expires_at > now()
          AND a.is_active = true
          AND a.deactivated_at IS NULL
    `;

    if (!session) {
        return null;
    }

    const expiresAt = new Date(session.expires_at);
    if (expiresAt.getTime() - Date.now() < 4 * 60 * 60 * 1000) {
        const newExpiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
        await db`UPDATE admin_sessions SET expires_at = ${newExpiresAt} WHERE id = ${hashedSessionId}`;
        session.expires_at = newExpiresAt;
    }

    return {
        id: session.id,
        adminId: session.admin_id,
        email: session.email,
        fullName: session.full_name,
        expiresAt: session.expires_at
    };
}

export async function revokeSession(sessionId: string) {
    const hashedSessionId = crypto.createHash('sha256').update(sessionId).digest('hex');
    await db`UPDATE admin_sessions SET revoked_at = now() WHERE id = ${hashedSessionId}`;
}
