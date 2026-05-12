export const ALLOWED_ORIGINS = [
    // Add your own domains here if you host frontend elsewhere
];

export const secureHeaders = {
    "Content-Security-Policy": "default-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://fonts.googleapis.com https://fonts.gstatic.com; worker-src 'self' blob:; font-src *;",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store, max-age=0"
};
