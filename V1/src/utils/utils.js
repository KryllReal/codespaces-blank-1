import { loginAttempts } from './state.js';
import { MANUAL_USERS } from './users.js';
import { hashPassword } from './crypto.js';
export function getAdminKey(env) {
    return env.ADMIN_KEY;
}
export function generateId(length = 8) {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) result += chars[randomValues[i] % chars.length];
    return result;
}
export function generateSessionId() {
    return generateId(32);
}
export async function isAdmin(request, env) {
    const url = new URL(request.url);
    const queryKey = url.searchParams.get('key') || url.searchParams.get('admin_key');
    if (queryKey && env.ADMIN_KEY && queryKey === env.ADMIN_KEY) {
        return { admin_name: 'admin', isMaster: true };
    }
    const cookie = request.headers.get("Cookie") || "";
    const match = cookie.match(/session_id=([^;]+)/);
    if (!match) return null;
    const sessionId = match[1];
    const session = await env.DB.prepare(`
        SELECT s.*, a.disabled as admin_disabled, a.avatar 
        FROM sessions s 
        LEFT JOIN admins a ON s.admin_name = a.username 
        WHERE s.id = ?
    `).bind(sessionId).first();
    if (!session || session.expires_at < Date.now()) return null;
    if (session.admin_disabled) return null;
    if (MANUAL_USERS[session.admin_name] && MANUAL_USERS[session.admin_name].disabled) return null;
    if (Math.random() < 0.02) {
        env.DB.prepare(`DELETE FROM sessions WHERE expires_at < ?`).bind(Date.now()).run().catch(() => {});
    }
    return session;
}
export async function verifyPassword(username, adminKey, env) {
    let user = null;
    if (username === "admin" && adminKey === getAdminKey(env)) {
        user = { username: "admin", isStatic: true, totp_enabled: 0 };
    } else if (MANUAL_USERS[username]) {
        if (!MANUAL_USERS[username].disabled && MANUAL_USERS[username].password === adminKey) {
            user = { username, ...MANUAL_USERS[username], isStatic: true, totp_enabled: 0 };
        }
    }
    try {
        const row = await env.DB.prepare(`SELECT * FROM admins WHERE username = ?`).bind(username).first();
        if (row) {
            if (row.disabled) return { valid: false };
            if (user) {
                user.totp_enabled = row.totp_enabled;
                user.totp_secret = row.totp_secret;
            } else {
                const h = await hashPassword(adminKey);
                if (h === row.password_hash) {
                    user = { ...row, isStatic: false };
                }
            }
        }
    } catch (e) {
        console.error("Auth DB Error:", e);
    }
    if (user) return { valid: true, user };
    return { valid: false };
}
export function checkLoginRateLimit(ip) {
    if (!ip) return true;
    const now = Date.now();
    const entry = loginAttempts.get(ip);
    if (entry) {
        if (now > entry.resetTime) {
            loginAttempts.set(ip, { count: 1, resetTime: now + 6e4 });
            return true;
        }
        if (entry.count >= 5) return false;
        entry.count++;
        return true;
    }
    loginAttempts.set(ip, { count: 1, resetTime: now + 6e4 });
    return true;
}
export async function recordStats(env, script, request, ctx) {
    await env.DB.prepare(`UPDATE scripts SET views = views + 1, executions = executions + 1 WHERE id = ?`).bind(script.id).run();
    if (env.ADMIN_LOG_WEBHOOK) {
        const ip = request.headers.get("CF-Connecting-IP") || "Unknown IP";
        const country = request.cf?.country || "Unknown";
        const user = request.headers.get("X-M-U") || "Unknown User";
        const hwid = request.headers.get("X-M-ID") || "Unknown HWID";
        const gameId = request.headers.get("X-M-G");
        let gameFieldValue = "Unknown";
        if (gameId && gameId !== "0") {
            gameFieldValue = `[Place ${gameId}](https://www.roblox.com/games/${gameId})`;
        } else if (gameId === "0") {
            gameFieldValue = "Studio / Unknown";
        }
        const embed = {
            title: `Script Executed: ${script.name}`,
            color: 5793266,
            fields: [
                { name: "Who (User)", value: user, inline: true },
                { name: "Who (HWID)", value: hwid, inline: true },
                { name: "Where (IP / Country)", value: `${ip} (${country})`, inline: false },
                { name: "What Game", value: gameFieldValue, inline: false },
                { name: "When", value: `<t:${Math.floor(Date.now() / 1e3)}:f>`, inline: false }
            ],
            footer: { text: "maxitom Script Hub" }
        };
        const webhookPromise = fetch(env.ADMIN_LOG_WEBHOOK, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ embeds: [embed] })
        }).catch((e) => console.error("Webhook error", e));
        if (ctx) ctx.waitUntil(webhookPromise);
    }
}
