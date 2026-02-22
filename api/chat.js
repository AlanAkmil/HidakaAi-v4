export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }

    try {
        // Parse body manual
        const body = await new Promise((resolve, reject) => {
            let data = '';
            req.on('data', chunk => data += chunk);
            req.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(e); }
            });
            req.on('error', reject);
        });

        const { messages, superMode } = body;

        const GROQ_MODELS = [
            'llama-3.3-70b-versatile',
            'llama-3.1-70b-versatile',
            'mixtral-8x7b-32768'
        ];

        let lastError = null;
        for (const model of GROQ_MODELS) {
            try {
                const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + process.env.GROQ_API_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model,
                        messages,
                        temperature: 0.75,
                        max_tokens: superMode ? 4000 : 2000
                    })
                });

                const data = await groqRes.json();
                if (!groqRes.ok) { lastError = data.error?.message; continue; }

                const content = data.choices?.[0]?.message?.content;
                if (!content) { lastError = 'Respons kosong'; continue; }

                res.status(200).json({ content });
                return;
            } catch (e) { lastError = e.message; }
        }

        res.status(500).json({ error: lastError || 'Semua model gagal' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}