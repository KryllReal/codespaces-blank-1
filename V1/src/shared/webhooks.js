export async function sendWebhook(env, channelOrUrl, { title, description, color, fields, footer, components }) {
    const targetUrl = env.MAXITOM_LOG_WEBHOOK || env.DISCORD_WEBHOOK;
    if (!targetUrl || !targetUrl.startsWith('http')) {
        return null;
    }
    try {
        const payload = {
            embeds: [{
                title: title || 'Network Activity',
                description: description || '',
                color: color || 0x5eead4, 
                fields: fields || [],
                footer: footer ? { text: footer } : { text: 'Maxitom Telemetry' },
                timestamp: new Date().toISOString()
            }]
        };

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[WEBHOOK_ERROR] ${response.status}: ${errorBody}`);
        }
        return response;
    } catch (e) {
        console.error('[WEBHOOK_EXCEPTION]', e);
        return null;
    }
}
