/**
 * @project    : HidakaAI - Chat Endpoint (Groq API)
 * @desc       : Proxy chat ke Groq (llama-3.3-70b / gpt-oss-120b untuk Super Mode)
 * @route      : POST /api/chat
 * @body       : { "messages": [{role, content}, ...], "superMode": boolean }
 * @response   : { "content": "..." }  atau  { "error": "..." }
 *
 * SETUP:
 * 1. Daftar gratis di https://console.groq.com -> buat API key
 * 2. Di Vercel: Project Settings -> Environment Variables
 *    Tambahkan: GROQ_API_KEY = gsk_xxxxxxxxxxxxxxxx
 * 3. Redeploy project
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Model normal: cepat, cocok untuk chat & RP
const MODEL_NORMAL = 'llama-3.3-70b-versatile';
// Model Super Mode: reasoning lebih kuat, untuk respons super detail
const MODEL_SUPER = 'openai/gpt-oss-120b';

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'GROQ_API_KEY belum diset di Environment Variables Vercel' });
    }

    const { messages, superMode = false } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Messages kosong atau tidak valid' });
    }

    const model = superMode ? MODEL_SUPER : MODEL_NORMAL;

    try {
        const response = await fetch(GROQ_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: 0.8,
                max_tokens: superMode ? 8000 : 2000,
                top_p: 1,
                stream: false
            })
        });

        const data = await response.json();

        if (!response.ok) {
            const errMsg = data?.error?.message || `Groq merespons status ${response.status}`;
            return res.status(response.status).json({ error: errMsg });
        }

        const content = data?.choices?.[0]?.message?.content;
        if (!content) {
            return res.status(502).json({ error: 'Tidak ada respons dari model' });
        }

        return res.status(200).json({ content });
    } catch (err) {
        console.error('Chat error:', err);
        return res.status(500).json({ error: err.message || 'Chat gagal' });
    }
}
