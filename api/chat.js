/**
 * @project    : HidakaAI - Chat Endpoint (DeepSeek V4 Flash, no API key)
 * @desc       : Proxy chat ke chat-deep.ai (deepseek-v4-flash), parse SSE -> text
 * @route      : POST /api/chat
 * @body       : { "messages": [{role, content}, ...], "superMode": boolean }
 * @response   : { "content": "..." }  atau  { "error": "..." }
 */

const CONFIG = {
    hostname: 'chat-deep.ai',
    path: '/wp-json/dsc/v1/chat',
    wpNonce: '35ee29a958',
    model: 'deepseek-v4-flash',
    origin: 'https://chat-deep.ai',
    referer: 'https://chat-deep.ai/',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36'
};

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { messages, superMode = false } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Messages kosong atau tidak valid' });
    }

    try {
        // Coba dengan session baru
        let result = await chatOnce(messages, generateSessionId(), superMode);

        // Kalau quota habis, retry sekali dengan session baru
        if (result.quotaRemaining !== null && result.quotaRemaining <= 0) {
            result = await chatOnce(messages, generateSessionId(), superMode);
        }

        if (!result.answer) {
            return res.status(502).json({ error: 'Tidak ada respons dari model' });
        }

        return res.status(200).json({ content: result.answer });
    } catch (err) {
        console.error('Chat error:', err);
        return res.status(500).json({ error: err.message || 'Chat gagal' });
    }
}

function generateSessionId() {
    return crypto.randomUUID();
}

async function chatOnce(messages, sessionId, superMode) {
    // Thinking mode: matikan biar cepat, kecuali Super Mode (boleh lebih dalam)
    const payload = JSON.stringify({
        messages,
        model: CONFIG.model,
        thinking: !!superMode,
        session_id: sessionId
    });

    const response = await fetch(`https://${CONFIG.hostname}${CONFIG.path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            'X-WP-Nonce': CONFIG.wpNonce,
            'Origin': CONFIG.origin,
            'Referer': CONFIG.referer,
            'User-Agent': CONFIG.userAgent
        },
        body: payload
    });

    if (!response.ok) {
        throw new Error(`chat-deep.ai merespons status ${response.status}`);
    }

    const raw = await response.text();
    return parseSSE(raw);
}

function parseSSE(raw) {
    let fullContent = '';
    let quotaRemaining = null;

    const lines = raw.split('\n');
    for (const line of lines) {
        if (!line.startsWith('data: ')) continue;

        const jsonStr = line.substring(6).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;

        try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
                fullContent += delta.content;
            }
            if (parsed.quota !== undefined) {
                quotaRemaining = parsed.quota;
            }
        } catch {
            // skip baris yang gagal di-parse
        }
    }

    return {
        answer: fullContent.trim(),
        quotaRemaining
    };
}
