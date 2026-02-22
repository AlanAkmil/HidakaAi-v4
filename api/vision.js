export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }

    try {
        const { imageBase64, mimeType, msg } = req.body;

        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + process.env.GROQ_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: msg || 'Analisis gambar ini secara detail. Berikan deskripsi lengkap tentang apa yang kamu lihat, termasuk objek, warna, komposisi, dan deteksi konten NSFW jika ada.'
                        },
                        {
                            type: 'image_url',
                            image_url: { url: `data:${mimeType};base64,${imageBase64}` }
                        }
                    ]
                }],
                max_tokens: 2048
            })
        });

        const data = await groqRes.json();
        if (!groqRes.ok) {
            res.status(500).json({ error: data.error?.message || 'Groq Vision error' });
            return;
        }

        const content = data.choices?.[0]?.message?.content;
        if (!content) { res.status(500).json({ error: 'Respons kosong dari Vision' }); return; }

        res.status(200).json({ content });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}
