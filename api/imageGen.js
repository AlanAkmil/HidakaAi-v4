/**
 * @project    : HidakaAI - Image Generation Endpoint
 * @desc       : Generate gambar via Zimage (text_to_image), tanpa API key
 * @route      : POST /api/imageGen
 * @body       : { "prompt": "kucing lucu" }
 * @response   : { "image": "https://..." }  atau  { "error": "..." }
 */

export default async function handler(req, res) {
    // CORS (kalau frontend beda domain)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt, width = 512, height = 512 } = req.body || {};

    if (!prompt || !prompt.trim()) {
        return res.status(400).json({ error: 'Prompt kosong' });
    }

    try {
        // 1. Cek moderasi prompt -> dapat token
        const token = await checkPrompt(prompt);

        // 2. Submit job generate -> dapat task UUID
        const taskUuid = await generateImage(prompt, token, width, height);

        // 3. Polling hasil sampai selesai
        const imageUrl = await waitForResult(taskUuid);

        if (!imageUrl) {
            return res.status(504).json({ error: 'Timeout: gambar belum selesai dibuat, coba lagi' });
        }

        return res.status(200).json({ image: imageUrl, prompt });
    } catch (err) {
        console.error('ImageGen error:', err);
        return res.status(500).json({ error: err.message || 'Gagal generate gambar' });
    }
}

// ============================
// HELPERS - Zimage API
// ============================

async function checkPrompt(prompt) {
    const r = await fetch('https://zimage.run/api/prompt-moderation/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt,
            routeKey: 'text_to_image',
            targetType: 'text_to_image'
        })
    });

    if (!r.ok) throw new Error('Gagal cek moderasi prompt');

    const json = await r.json();
    const token = json?.data?.promptModerationToken;
    if (!token) throw new Error('Prompt ditolak moderasi atau token tidak ditemukan');

    return token;
}

async function generateImage(prompt, token, width, height) {
    const r = await fetch('https://zimage.run/api/z-image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt,
            width,
            height,
            modelType: 'turbo',
            batchSize: 1,
            promptModerationToken: token
        })
    });

    if (!r.ok) throw new Error('Gagal memulai proses generate');

    const json = await r.json();
    const uuid = json?.data?.task?.uuid;
    if (!uuid) throw new Error('Task UUID tidak ditemukan');

    return uuid;
}

async function waitForResult(taskUuid) {
    // Total maksimal ~50 detik (25 x 2s) - sesuai limit serverless function Vercel
    for (let i = 0; i < 25; i++) {
        await sleep(2000);

        const r = await fetch(`https://zimage.run/api/z-image/task/${taskUuid}`);
        if (!r.ok) continue;

        const json = await r.json();
        const task = json?.data?.task;

        if (task?.taskStatus === 'completed' && task?.resultUrl) {
            return task.resultUrl;
        }
        if (task?.taskStatus === 'failed') {
            throw new Error('Generate gambar gagal di server Zimage');
        }
        // status masih 'pending'/'processing' -> lanjut polling
    }
    return null;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
