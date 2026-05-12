import { secureHeaders, ALLOWED_ORIGINS } from './constants.js';

export function getCorsHeaders(request) {
    const origin = request.headers.get("Origin") || "";
    const ok = ALLOWED_ORIGINS.some(o => {
        if (origin === o) return true;
        const domain = o.replace('https://', '');
        return origin.endsWith(`.${domain}`) || origin === `https://${domain}`;
    });
    return {
        "Access-Control-Allow-Origin": ok ? origin : "null",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, X-M-A, X-M-K, X-M-Ts, X-M-T, X-M-Op, X-M-ID, X-M-U, X-M-G, Exploit-Guid, Identifier, HWID",
        "Access-Control-Allow-Credentials": "true",
        "Vary": "Origin"
    };
}

export function json(data, status = 200, extraHeaders = {}, request = null) {
    const cors = request ? getCorsHeaders(request) : {};
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...secureHeaders, ...cors, ...extraHeaders }
    });
}

export function text(t, status = 200, extraHeaders = {}, request = null) {
    const cors = request ? getCorsHeaders(request) : {};
    return new Response(t, {
        status,
        headers: { "Content-Type": "text/plain; charset=utf-8", ...cors, ...extraHeaders }
    });
}
