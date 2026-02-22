export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }

    try {
        const { query } = req.body;
        const googleKey = process.env.GOOGLE_API_KEY;
        const googleCx  = process.env.GOOGLE_CX;

        if (!googleKey || !googleCx) {
            res.status(200).json({ results: '' });
            return;
        }

        const url = `https://www.googleapis.com/customsearch/v1?key=${googleKey}&cx=${googleCx}&q=${encodeURIComponent(query)}&num=5`;
        const searchRes = await fetch(url);
        const data = await searchRes.json();

        if (!data.items) { res.status(200).json({ results: '' }); return; }

        const results = data.items.map((item, i) =>
            `${i+1}. **${item.title}**\n${item.snippet}`
        ).join('\n\n');

        res.status(200).json({ results });
    } catch (e) {
        res.status(200).json({ results: '' });
    }
}
