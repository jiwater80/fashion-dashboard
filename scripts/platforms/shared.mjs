/**
 * 어댑터 공용 헬퍼 — 비의류 필터, JSON-LD/og 파싱, 가격·이미지 정규화.
 * fetch-live-rankings.mjs 에 흩어져 있던 순수 함수들을 한 곳에 모았다.
 */

/** 보석·가방·신발 등 비(非)의류 — 여성의류 랭킹에서 제외 */
export function isNonWomensApparel(text) {
  if (!text || typeof text !== 'string') return false;
  const s = text.toLowerCase().replace(/&amp;/g, '&');
  const checks = [
    /반지|귀걸이|목걸이|팔찌|주얼리|피어싱|다이아|금반지|은반지|커플링|쥬얼리/,
    /14k|18k|24k|14\s*k|18\s*k/,
    /\bring\b|earring|necklace|bracelet|jewelry|jewellery|couple\s*ring/,
    /에코백|토트백|크로스백|백팩|클러치|파우치|숄더백|가방|에코\s*백/,
    /\bbag\b|tote|backpack|crossbody|clutch|pouch/i,
    /스니커|운동화|샌들|로퍼|힐|부츠|슬리퍼|슈즈|mule|플랫\s*슈즈/,
    /\bsneaker|\bloafer|\bsandal|\bheel|\bboot|footwear|shoe/i,
    /수영복|비키니|swimwear|bikini|swimsuit/i,
    /\bwatch\b|시계|워치/,
    /선글라스|sunglass|안경테/,
    /향수|perfume|cosmetic|립스틱/,
  ];
  return checks.some((re) => re.test(s));
}

export function extractLdJsonBlocks(html) {
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      out.push(JSON.parse(m[1].trim()));
    } catch {
      /* ignore */
    }
  }
  return out;
}

export function findSchemaProduct(blocks) {
  for (const b of blocks) {
    const list = Array.isArray(b) ? b : [b];
    for (const x of list) {
      const t = x?.['@type'];
      if (t === 'Product' || (Array.isArray(t) && t.includes('Product'))) return x;
    }
  }
  return null;
}

export function firstImageUrl(image) {
  if (!image) return null;
  if (typeof image === 'string') return image.replace(/&amp;/g, '&');
  if (Array.isArray(image)) return firstImageUrl(image[0]);
  if (image.contentUrl) return String(image.contentUrl);
  if (image.url) return String(image.url);
  return null;
}

export function brandName(brand) {
  if (!brand) return null;
  if (typeof brand === 'string') return brand;
  if (brand.name) return String(brand.name);
  return null;
}

export function offerPrice(offers) {
  if (!offers) return null;
  const list = Array.isArray(offers) ? offers : [offers];
  for (const o of list) {
    const p = o?.price;
    if (p != null) {
      const n = typeof p === 'number' ? p : parseInt(String(p).replace(/,/g, ''), 10);
      if (!Number.isNaN(n) && n > 0) return n;
    }
  }
  return null;
}

export function metaContent(html, prop) {
  const re = new RegExp(`<meta[^>]+property="${prop}"[^>]+content="([^"]*)"`, 'i');
  const m = html.match(re);
  if (m) return m[1];
  const re2 = new RegExp(`<meta[^>]+content="([^"]*)"[^>]+property="${prop}"`, 'i');
  const m2 = html.match(re2);
  return m2 ? m2[1] : null;
}

export function parseWconceptDescription(desc) {
  if (!desc) return { brand: null, name: null };
  const m = desc.match(/^\[([^\]]+)\]\s*(.+)$/);
  if (!m) return { brand: null, name: desc.trim() };
  const inner = m[1].trim();
  const name = m[2].trim();
  const parts = inner.split(/\s+/);
  const brand = parts[parts.length - 1] || inner;
  return { brand, name };
}

export function rowPriceFallback(price) {
  return price > 0 ? Math.round(price * 1.2) : 99000;
}
