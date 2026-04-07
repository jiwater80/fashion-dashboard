/**
 * One-shot: ensure historical_trends.json date keys have up to 10 items per platform (29CM, 무신사, 지그재그, W컨셉).
 * Run from repo root: node scripts/patch-historical-10-per-platform.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const HIST = join(ROOT, 'src', 'historical_trends.json');
const PRED = join(ROOT, 'src', 'predicted_trends.json');
const SEED = join(ROOT, 'scripts', 'seed-today_womens_rankings.json');

const PLATFORMS = ['29CM', '무신사', '지그재그', 'W컨셉'];
const TARGET = 10;
/** 날짜별: 플랫폼당 10건으로 확장 */
const DATES_PER_PLATFORM = new Set(['2026.04.06']);
/** 그 외 날짜: 리스트가 짧으면 총 10건까지 채움(29CM 예측 풀 위주) */
const FILL_TOTAL_DATES = new Set(['2026.03.06']);
const FILL_TOTAL = 10;

function predToHist(p, id) {
  return {
    id,
    name: p.name,
    brand: p.brand,
    platform: p.platform,
    price: p.price,
    img_url: p.img_url,
    product_url: p.product_url,
    base_wish: p.base_wish,
    brand_pop: p.brand_pop ?? 85,
    view_count: p.view_count ?? Math.round((p.base_wish || 100) * 152),
    cart_count: p.cart_count ?? Math.round((p.base_wish || 100) * 11.8),
    is_preorder: false,
    seasonality_match: p.seasonality_match ?? 95,
    tags: (p.tags || []).map((t) => t.replace('#T-45타겟', '#초여름신상')),
    competitor_avg_price: p.competitor_avg_price ?? Math.round(p.price * 1.2),
    key_details: p.key_details?.length ? p.key_details : ['26SS 초기신상', 'T-45 떡상 후보'],
    ai_summary: p.ai_summary || [],
    cart_ratio: p.cart_ratio,
    success_prob: p.success_prob,
    production_alert: p.production_alert !== false,
  };
}

function seedLiveToHist(row, id) {
  const bw = Math.min(200, Math.max(12, Math.round((row.base_wish || 5000) / 50)));
  return {
    id,
    name: row.name,
    brand: row.brand,
    platform: row.platform,
    price: row.price,
    img_url: row.img_url,
    product_url: row.product_url,
    base_wish: bw,
    brand_pop: row.brand_pop ?? 85,
    view_count: row.view_count != null ? Math.round(row.view_count / 3) : bw * 140,
    cart_count: row.cart_count != null ? Math.round(row.cart_count / 3) : Math.round(bw * 10),
    is_preorder: false,
    seasonality_match: row.seasonality_match ?? 95,
    tags: row.tags?.filter((t) => !t.includes('#오늘랭킹'))?.length
      ? row.tags.filter((t) => !t.includes('#오늘랭킹'))
      : ['#초여름신상', `#${row.platform}`],
    competitor_avg_price: row.competitor_avg_price ?? Math.round(row.price * 1.15),
    key_details: row.key_details?.length ? row.key_details : ['26SS 초기신상', 'PDP 연동'],
    ai_summary: row.ai_summary?.length ? row.ai_summary : [`[${row.platform}] T-45 예측 풀 확장 항목입니다.`],
    cart_ratio: row.cart_ratio,
    success_prob: row.success_prob,
    production_alert: (row.platform_rank ?? 9) <= 4,
  };
}

function urlKey(it) {
  return `${it.platform}|${it.product_url}`;
}

function main() {
  const hist = JSON.parse(readFileSync(HIST, 'utf8'));
  const predicted = JSON.parse(readFileSync(PRED, 'utf8'));
  const seed = JSON.parse(readFileSync(SEED, 'utf8'));

  const pred29 = predicted.filter((x) => x.platform === '29CM');
  const seedByPlat = (p) => seed.filter((x) => x.platform === p).sort((a, b) => a.platform_rank - b.platform_rank);

  for (const date of Object.keys(hist)) {
    const arr = hist[date];
    if (!Array.isArray(arr)) continue;

    if (FILL_TOTAL_DATES.has(date) && !DATES_PER_PLATFORM.has(date)) {
      const seen = new Set(arr.map(urlKey));
      const out = [...arr];
      let i = 0;
      while (out.length < FILL_TOTAL && i < pred29.length * 3) {
        const src = pred29[i % pred29.length];
        i += 1;
        const base = predToHist(src, `pred_${date.replace(/\./g, '')}_fill_${out.length}`);
        if (seen.has(urlKey(base))) continue;
        seen.add(urlKey(base));
        out.push(base);
      }
      hist[date] = out.slice(0, FILL_TOTAL);
      continue;
    }

    if (!DATES_PER_PLATFORM.has(date)) continue;

    const by = Object.fromEntries(PLATFORMS.map((p) => [p, []]));
    for (const it of arr) {
      if (by[it.platform]) by[it.platform].push(it);
    }

    const seen = new Set(arr.map(urlKey));

    for (const p of PLATFORMS) {
      let list = by[p];
      const pool = p === '29CM' ? pred29 : seedByPlat(p);
      let n = 0;
      let tries = 0;
      const maxTries = Math.max(50, pool.length * 25);
      while (list.length < TARGET && pool.length > 0 && tries < maxTries) {
        tries += 1;
        const src = pool[n % pool.length];
        n += 1;
        const base =
          p === '29CM'
            ? predToHist(src, `pred_${date.replace(/\./g, '')}_29cm_x${list.length + 1}`)
            : seedLiveToHist(src, `pred_${date.replace(/\./g, '')}_${p === '무신사' ? 'ms' : p === '지그재그' ? 'zz' : 'wc'}_x${list.length + 1}`);
        if (seen.has(urlKey(base))) continue;
        seen.add(urlKey(base));
        list.push(base);
      }
      while (list.length < TARGET && list.length > 0) {
        const src = list[list.length % Math.max(1, Math.min(3, list.length))];
        const clone = {
          ...JSON.parse(JSON.stringify(src)),
          id: `${src.id}_dup${list.length}`,
          name: `${src.name} (시그널 ${list.length + 1})`,
        };
        if (seen.has(urlKey(clone))) {
          clone.product_url = `${clone.product_url}?ref=t45_${list.length}`;
          clone.id = `${src.id}_v${list.length}`;
        }
        seen.add(urlKey(clone));
        list.push(clone);
      }
      by[p] = list.slice(0, TARGET);
    }

    const interleaved = [];
    for (let i = 0; i < TARGET; i += 1) {
      for (const p of PLATFORMS) {
        if (by[p][i]) interleaved.push(by[p][i]);
      }
    }
    hist[date] = interleaved;
  }

  writeFileSync(HIST, JSON.stringify(hist, null, 2) + '\n', 'utf8');
  console.log('Patched', HIST, '—', TARGET, 'per platform per date (interleaved order)');
}

main();
