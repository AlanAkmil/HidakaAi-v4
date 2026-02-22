export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }

    try {
        const body = await new Promise((resolve, reject) => {
            let data = '';
            req.on('data', chunk => data += chunk);
            req.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(e); }
            });
            req.on('error', reject);
        });

        const { prompt } = body;

        let hfRes = await fetch('https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + process.env.HF_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ inputs: prompt })
        });

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

        const arrayBuffer = await hfRes.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const mime = hfRes.headers.get('content-type') || 'image/jpeg';

        res.status(200).json({ image: `data:${mime};base64,${base64}` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}