export async function generateScopedToken(scriptId, timestamp, scope, secret) {
    const enc = new TextEncoder();
    const data = enc.encode(`${scriptId}:${scope}:${timestamp}`);
    const key = await crypto.subtle.importKey(
        "raw",
        enc.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, data);
    return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
export async function generateDynamicToken(scriptId, timestamp, secret) {
    return generateScopedToken(scriptId, timestamp, "auth", secret);
}
export async function generateLaunchToken(scriptId, timestamp, secret) {
    return generateScopedToken(scriptId, timestamp, "launch", secret);
}
export function xorEncryptToBase64(plaintext, key) {
    const textBytes = new TextEncoder().encode(plaintext);
    const keyBytes = new TextEncoder().encode(key);
    const result = new Uint8Array(textBytes.length);
    for (let i = 0; i < textBytes.length; i++) {
        result[i] = textBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    return uint8ToBase64(result);
}
export async function aesEncryptCTR(plaintext, keyString) {
    return xorEncryptToBase64(plaintext, keyString);
}
export async function verifyAuthenticator(request, scriptId, secret) {
    const auth = request.headers.get("X-M-A") || request.headers.get("Authorization");
    if (!auth || !auth.includes(".")) return false;
    const [ts, sig] = auth.split(".");
    const timestamp = parseInt(ts);
    if (isNaN(timestamp) || Math.abs(Date.now() - timestamp) > 120000) return false;
    const expected = await generateDynamicToken(scriptId, ts, secret);
    return sig === expected;
}
export async function verifyTOTP(secret, code) {
    if (!secret || !code) return false;
    const key = decodeBase32(secret);
    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / 30);
    for (let i = -1; i <= 1; i++) {
        const expected = await generateHOTP(key, counter + i);
        if (expected === code) return true;
    }
    return false;
}
async function generateHOTP(keyBuffer, counter) {
    const counterBuffer = new ArrayBuffer(8);
    const view = new DataView(counterBuffer);
    view.setBigUint64(0, BigInt(counter), false);
    const cryptoKey = await crypto.subtle.importKey(
        "raw", keyBuffer, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, counterBuffer);
    const hmac = new Uint8Array(signature);
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary = ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);
    return (binary % 1000000).toString().padStart(6, '0');
}
function decodeBase32(s) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    s = s.toUpperCase().replace(/=+$/, "");
    let bits = 0, value = 0, index = 0;
    const output = new Uint8Array((s.length * 5 / 8) | 0);
    for (let i = 0; i < s.length; i++) {
        value = (value << 5) | alphabet.indexOf(s[i]);
        bits += 5;
        if (bits >= 8) {
            output[index++] = (value >>> (bits - 8)) & 255;
            bits -= 8;
        }
    }
    return output.buffer;
}
export function generateTOTPSecret() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(x => chars[x % chars.length]).join("");
}
export function xxteaEncrypt(plaintext, keyString) {
    const key = strToUint32(keyString.padEnd(16, '\0').substring(0, 16));
    const data = strToUint32(plaintext);
    if (data.length === 0) return "";
    if (data.length === 1) data.push(0); 
    const n = data.length;
    let z = data[n - 1];
    let y = data[0];
    const delta = 0x9e3779b9;
    let q = Math.floor(6 + 52 / n);
    let sum = 0;
    while (q-- > 0) {
        sum = (sum + delta) | 0;
        const e = (sum >>> 2) & 3;
        for (let p = 0; p < n - 1; p++) {
            y = data[p + 1];
            z = data[p] = (data[p] + (((z >>> 5 ^ y << 2) + (y >>> 3 ^ z << 4)) ^ ((sum ^ y) + (key[p & 3 ^ e] ^ z)))) | 0;
        }
        y = data[0];
        z = data[n - 1] = (data[n - 1] + (((z >>> 5 ^ y << 2) + (y >>> 3 ^ z << 4)) ^ ((sum ^ y) + (key[(n - 1) & 3 ^ e] ^ z)))) | 0;
    }
    return uint8ToBase64(uint32ToUint8(data));
}
function strToUint32(s) {
    const bytes = new TextEncoder().encode(s);
    const n = Math.ceil(bytes.length / 4);
    const uint32 = new Uint32Array(n);
    for (let i = 0; i < bytes.length; i++) {
        uint32[i >>> 2] |= bytes[i] << ((i & 3) << 3);
    }
    return Array.from(uint32);
}
function uint32ToUint8(uint32) {
    const res = new Uint8Array(uint32.length * 4);
    for (let i = 0; i < uint32.length; i++) {
        res[i * 4] = uint32[i] & 0xFF;
        res[i * 4 + 1] = (uint32[i] >>> 8) & 0xFF;
        res[i * 4 + 2] = (uint32[i] >>> 16) & 0xFF;
        res[i * 4 + 3] = (uint32[i] >>> 24) & 0xFF;
    }
    return res;
}
function uint8ToBase64(uint8) {
    let binary = "";
    for (let i = 0; i < uint8.length; i += 8192) {
        binary += String.fromCharCode(...uint8.subarray(i, Math.min(i + 8192, uint8.length)));
    }
    return btoa(binary);
}
export async function hashPassword(password) {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest("SHA-256", enc.encode(password));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
export async function hashIP(ip) {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest("SHA-1", enc.encode(ip + "maxitom_salt_9283"));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("").substring(0, 16);
}
