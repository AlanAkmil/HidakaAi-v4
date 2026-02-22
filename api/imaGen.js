export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }

    try {
        const { prompt } = req.body;

        // Coba FLUX dulu
        let hfRes = await fetch('https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + process.env.HF_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ inputs: prompt })
        });

        // Fallback ke SDXL kalau FLUX 503
        if (hfRes.status === 503) {
            hfRes = await fetch('https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + process.env.HF_API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ inputs: prompt })
            });
        }

        if (!hfRes.ok) {
            res.status(500).json({ error: 'HuggingFace error ' + hfRes.status });
            return;
        }

        // Kirim balik sebagai base64
        const arrayBuffer = await hfRes.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const mime = hfRes.headers.get('content-type') || 'image/jpeg';

        res.status(200).json({ image: `data:${mime};base64,${base64}` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
    }
