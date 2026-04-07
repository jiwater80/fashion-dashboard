/**
 * - today_womens_rankings.json = 플랫폼 랭킹(공개 차트 순서 그대로).
 * - historical_trends.json[오늘] = scripts/lib/predictionSnapshot.mjs 로 후보·스코어 산출.
 *   fetch-new-arrivals.mjs 결과는 mergeRankingPoolWithNewArrivals 로 합친 뒤 동일 파이프라인에 태운다.
 *
 * Refreshes src/today_womens_rankings.json:
 * - 무신사: 공개 랭킹 API (여성 gf=F, 민소매 티 001011) 상위 10건
 * - 29CM / 지그재그: PDP JSON-LD Product로 상품명·브랜드·이미지 갱신 (지그재그는 schema에 가격이 없으면 기존 가격 유지)
 * - W컨셉: og:description / og:image로 상품명·브랜드·이미지 갱신 (가격은 기존 값 유지)
 * - 여성의류만 유지: 보석·가방·신발·수영복 등 비의류 키워드는 무신사 랭킹에서 건너뛰고, PDP 갱신 시 메타 반영을 생략
 */

import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { seoulDateKey } from '../src/utils/seoulDateKey.js';
import { fetchNewArrivalRows } from './fetch-new-arrivals.mjs';
import {
  buildPredictionSnapshotFromRanking,
  mergeRankingPoolWithNewArrivals,
} from './lib/predictionSnapshot.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'src', 'today_womens_rankings.json');
const HISTORICAL = join(ROOT, 'src', 'historical_trends.json');
const SEED = join(__dirname, 'seed-today_womens_rankings.json');

/** 플랫폼별 오늘 랭킹 노출·수집 상한 */
const LIVE_ITEMS_PER_PLATFORM = 10;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/** 보석·가방·신발 등 비(非)의류 — 여성의류 랭킹에서 제외 */
function isNonWomensApparel(text) {
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

function extractLdJsonBlocks(html) {
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

function findSchemaProduct(blocks) {
  for (const b of blocks) {
    const list = Array.isArray(b) ? b : [b];
    for (const x of list) {
      const t = x?.['@type'];
      if (t === 'Product' || (Array.isArray(t) && t.includes('Product'))) return x;
    }
  }
  return null;
}

function firstImageUrl(image) {
  if (!image) return null;
  if (typeof image === 'string') return image.replace(/&amp;/g, '&');
  if (Array.isArray(image)) return firstImageUrl(image[0]);
  if (image.contentUrl) return String(image.contentUrl);
  if (image.url) return String(image.url);
  return null;
}

function brandName(brand) {
  if (!brand) return null;
  if (typeof brand === 'string') return brand;
  if (brand.name) return String(brand.name);
  return null;
}

function offerPrice(offers) {
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

function metaContent(html, prop) {
  const re = new RegExp(`<meta[^>]+property="${prop}"[^>]+content="([^"]*)"`, 'i');
  const m = html.match(re);
  if (m) return m[1];
  const re2 = new RegExp(`<meta[^>]+content="([^"]*)"[^>]+property="${prop}"`, 'i');
  const m2 = html.match(re2);
  return m2 ? m2[1] : null;
}

function parseWconceptDescription(desc) {
  if (!desc) return { brand: null, name: null };
  const m = desc.match(/^\[([^\]]+)\]\s*(.+)$/);
  if (!m) return { brand: null, name: desc.trim() };
  const inner = m[1].trim();
  const name = m[2].trim();
  const parts = inner.split(/\s+/);
  const brand = parts[parts.length - 1] || inner;
  return { brand, name };
}

async function fetchHtml(url) {
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow',
  });
  return { ok: r.ok, status: r.status, text: await r.text() };
}

async function refreshFromPdp(row) {
  const url = row.product_url;
  if (!url) return row;

  const { ok, text, status } = await fetchHtml(url);
  if (!ok) {
    console.warn(`PDP HTTP ${status}: ${url}`);
    return row;
  }

  const platform = row.platform;

  if (platform === '29CM' || platform === '지그재그') {
    const ld = findSchemaProduct(extractLdJsonBlocks(text));
    if (!ld) {
      console.warn(`No Product JSON-LD: ${url}`);
      return row;
    }
    const price = offerPrice(ld.offers);
    const img = firstImageUrl(ld.image);
    const name = ld.name ? String(ld.name) : row.name;
    const brand = brandName(ld.brand) || row.brand;
    const candidate = `${name} ${brand}`;
    if (isNonWomensApparel(candidate)) {
      console.warn(`여성의류 외 카테고리 → PDP 메타 반영 생략 (${platform}): ${candidate.slice(0, 60)}`);
      return row;
    }
    return {
      ...row,
      name,
      brand,
      price: price ?? row.price,
      img_url: img || row.img_url,
    };
  }

  if (platform === 'W컨셉') {
    const ogDesc = metaContent(text, 'og:description');
    const ogImg = metaContent(text, 'og:image');
    const parsed = parseWconceptDescription(ogDesc);
    const name = parsed.name || row.name;
    const brand = parsed.brand || row.brand;
    const candidate = `${name} ${brand}`;
    if (isNonWomensApparel(candidate)) {
      console.warn(`여성의류 외 카테고리 → PDP 메타 반영 생략 (W컨셉): ${candidate.slice(0, 60)}`);
      return row;
    }
    return {
      ...row,
      name,
      brand,
      img_url: ogImg || row.img_url,
    };
  }

  return row;
}

function rowPriceFallback(price) {
  return price > 0 ? Math.round(price * 1.2) : 99000;
}

function musinsaRowFromApi(it, i) {
  const rank = it.image?.rank ?? i + 1;
  const info = it.info || {};
  const amp = it.image?.onClickLike?.eventLog?.amplitude?.payload;
  const reviewCount = amp?.reviewCount != null ? parseInt(String(amp.reviewCount), 10) : 0;
  const goodsNo = String(it.id || '');
  const productUrl = it.onClick?.url || `https://www.musinsa.com/products/${goodsNo}`;
  const imgUrl = it.image?.url || '';
  const price = info.finalPrice != null ? Number(info.finalPrice) : 0;

  const baseWish = reviewCount > 0 ? Math.min(25000, 2000 + reviewCount * 400) : Math.max(1800, 12000 - rank * 900);
  const viewCount = Math.max(2200, 62000 - rank * 5200);
  const cartCount = Math.max(480, 4800 - rank * 420);

  return {
    id: `rank_today_ms_${rank}`,
    platform_rank: rank,
    name: String(info.productName || '').trim(),
    brand: String(info.brandName || '').trim(),
    platform: '무신사',
    price,
    img_url: imgUrl,
    product_url: productUrl,
    base_wish: baseWish,
    brand_pop: Math.min(94, 78 + (6 - rank) * 3),
    view_count: viewCount,
    cart_count: Math.max(800, cartCount),
    is_preorder: false,
    seasonality_match: Math.min(95, 88 + (6 - rank)),
    competitor_avg_price: price > 0 ? Math.round(price * 1.15) : rowPriceFallback(price),
    tags: ['#여성의류', '#무신사', '#오늘랭킹'],
    key_details: [`무신사 여성 랭킹(민소매 티·실시간) ${rank}위`, 'api.musinsa.com 스냅샷'],
    ai_summary: [
      '공개 랭킹 API 기준 스냅샷입니다.',
      '찜·조회·장바구니 수치는 보조 지표(고정 시나리오)입니다.',
    ],
    cart_ratio: Number((7.2 + (6 - rank) * 0.12).toFixed(1)),
    success_prob: Math.min(97, 90 + (6 - rank)),
    production_alert: false,
    gender: 'women',
    audience: 'adult',
  };
}

async function fetchMusinsaTop5() {
  const apiUrl =
    'https://api.musinsa.com/api2/hm/web/v5/pans/ranking/sections/200?storeCode=musinsa&categoryCode=001011&contentsId=&gf=F';
  const r = await fetch(apiUrl, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!r.ok) throw new Error(`Musinsa API ${r.status}`);
  const j = await r.json();
  const mod = j?.data?.modules?.find((m) => m.type === 'MULTICOLUMN' && Array.isArray(m.items));
  const cols = (mod?.items || []).filter((it) => it.type === 'PRODUCT_COLUMN');
  const picked = [];
  for (const it of cols) {
    const info = it.info || {};
    const label = `${String(info.productName || '')} ${String(info.brandName || '')}`;
    if (isNonWomensApparel(label)) continue;
    picked.push(it);
    if (picked.length >= LIVE_ITEMS_PER_PLATFORM) break;
  }
  if (picked.length < LIVE_ITEMS_PER_PLATFORM) {
    console.warn(
      `무신사: 여성의류 필터 적용 후 ${picked.length}건만 확보 (목표 ${LIVE_ITEMS_PER_PLATFORM}, 상위 ${cols.length}건 스캔)`,
    );
  }
  return picked.map((it, i) => {
    const rank = i + 1;
    const withRank = { ...it, image: { ...(it.image || {}), rank } };
    return musinsaRowFromApi(withRank, i);
  });
}

async function main() {
  if (!existsSync(OUT)) {
    if (existsSync(SEED)) {
      copyFileSync(SEED, OUT);
      console.error(`src/today_womens_rankings.json 이 없어 scripts/ 시드로 복사했습니다. 이어서 갱신합니다.\n  → ${OUT}`);
    } else {
      console.error(
        `파일이 없습니다: ${OUT}\n` +
          '프로젝트 루트( package.json 이 있는 폴더 )에서 실행했는지 확인하거나, scripts/seed-today_womens_rankings.json 을 복구하세요.',
      );
      process.exit(1);
    }
  }
  const data = JSON.parse(readFileSync(OUT, 'utf8'));
  const musinsaLive = await fetchMusinsaTop5();

  const order = ['29CM', '무신사', '지그재그', 'W컨셉'];
  const final = [];

  for (const p of order) {
    if (p === '무신사') {
      final.push(...musinsaLive.sort((a, b) => a.platform_rank - b.platform_rank));
      continue;
    }
    const rows = data.filter((r) => r.platform === p).sort((a, b) => a.platform_rank - b.platform_rank);
    for (const row of rows) {
      final.push(await refreshFromPdp(row));
      await new Promise((res) => setTimeout(res, 400));
    }
  }

  writeFileSync(OUT, JSON.stringify(final, null, 2) + '\n', 'utf8');
  console.log('Updated', OUT);

  const dayKey = seoulDateKey();
  let historical = {};
  if (existsSync(HISTORICAL)) {
    try {
      historical = JSON.parse(readFileSync(HISTORICAL, 'utf8'));
      if (typeof historical !== 'object' || historical === null || Array.isArray(historical)) {
        historical = {};
      }
    } catch (e) {
      console.warn('historical_trends.json 파싱 실패, 새로 만듭니다.', e.message);
      historical = {};
    }
  }
  let newArrivalRows = [];
  try {
    newArrivalRows = await fetchNewArrivalRows();
  } catch (e) {
    console.warn('fetch-new-arrivals 실패(무시하고 랭킹 풀만 사용):', e.message);
  }
  const mergedPool = mergeRankingPoolWithNewArrivals(final, newArrivalRows);
  const predictionSnapshot = buildPredictionSnapshotFromRanking(mergedPool, {
    itemsPerPlatform: LIVE_ITEMS_PER_PLATFORM,
  });
  historical[dayKey] = predictionSnapshot;
  console.log(
    'Prediction snapshot:',
    dayKey,
    predictionSnapshot.length,
    'rows (ranking file:',
    final.length,
    ')',
  );
  const sortedKeys = Object.keys(historical).sort(
    (a, b) => new Date(b.replace(/\./g, '-')) - new Date(a.replace(/\./g, '-')),
  );
  const ordered = {};
  for (const k of sortedKeys) ordered[k] = historical[k];
  writeFileSync(HISTORICAL, JSON.stringify(ordered, null, 2) + '\n', 'utf8');
  console.log('Historical snapshot:', dayKey, '→', HISTORICAL);

  console.log(
    '무신사 랭킹:',
    musinsaLive.map((x) => `${x.platform_rank}.${x.brand}`).join(', '),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
