const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36';
const id = process.argv[2] || '128956240';
const url = `https://zigzag.kr/catalog/products/${id}`;
const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
const t = await r.text();
const m =
  t.match(/property="og:image"\s+content="([^"]+)"/i) ||
  t.match(/content="([^"]+)"\s+property="og:image"/i);
console.log(id, m ? m[1] : 'NOT_FOUND');
