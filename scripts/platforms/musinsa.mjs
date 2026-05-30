/**
 * 무신사 어댑터 — 공개 랭킹 API로 상품 목록 자체를 실시간 수집(진짜 랭킹).
 * 실측: platform_rank, name, brand, price, img_url, review_count.
 * 추정(estimated): view_count, cart_count, base_wish, success_prob 등 — 순위 기반 합성값.
 */

import { fetchJson } from '../lib/http.mjs';
import { MUSINSA } from '../crawlConfig.mjs';
import { isNonWomensApparel, rowPriceFallback } from './shared.mjs';

export const platform = '무신사';

/** 합성(추정) 보조지표 필드 — UI에서 '추정' 표기에 사용 */
export const ESTIMATED_FIELDS = [
  'base_wish',
  'brand_pop',
  'view_count',
  'cart_count',
  'competitor_avg_price',
  'cart_ratio',
  'success_prob',
  'seasonality_match',
];

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
    review_count: reviewCount, // 실측
    base_wish: baseWish,
    brand_pop: Math.min(94, 78 + (6 - rank) * 3),
    view_count: viewCount,
    cart_count: Math.max(800, cartCount),
    is_preorder: false,
    seasonality_match: Math.min(95, 88 + (6 - rank)),
    competitor_avg_price: price > 0 ? Math.round(price * 1.15) : rowPriceFallback(price),
    tags: ['#여성의류', '#무신사', '#오늘랭킹'],
    key_details: [`무신사 여성 랭킹(실시간) ${rank}위`, 'api.musinsa.com 스냅샷'],
    ai_summary: [
      '공개 랭킹 API 기준 스냅샷입니다.',
      '찜·조회·장바구니 수치는 추정 보조지표입니다(실측 아님).',
    ],
    cart_ratio: Number((7.2 + (6 - rank) * 0.12).toFixed(1)),
    success_prob: Math.min(97, 90 + (6 - rank)),
    production_alert: false,
    gender: 'women',
    audience: 'adult',
    // --- 데이터 투명성 메타 ---
    data_source: 'musinsa_ranking_api',
    metrics_estimated: true,
    estimated_fields: ESTIMATED_FIELDS,
  };
}

function pickWomensColumns(modules, limit) {
  const mod = modules?.find((m) => m.type === 'MULTICOLUMN' && Array.isArray(m.items));
  const cols = (mod?.items || []).filter((it) => it.type === 'PRODUCT_COLUMN');
  const picked = [];
  for (const it of cols) {
    const info = it.info || {};
    const label = `${String(info.productName || '')} ${String(info.brandName || '')}`;
    if (isNonWomensApparel(label)) continue;
    picked.push(it);
    if (picked.length >= limit) break;
  }
  return { picked, scanned: cols.length };
}

/**
 * @param {{ itemsPerPlatform: number }} ctx
 * @returns {Promise<object[]>}
 */
export async function collect({ itemsPerPlatform }) {
  // 여러 categoryCode를 합쳐 상위 N (중복 product_url 제거)
  const seen = new Set();
  const merged = [];
  for (const cat of MUSINSA.categoryCodes) {
    const url = `${MUSINSA.apiBase}?storeCode=${MUSINSA.storeCode}&categoryCode=${cat}&contentsId=&gf=${MUSINSA.gf}`;
    const j = await fetchJson(url);
    const { picked, scanned } = pickWomensColumns(j?.data?.modules, itemsPerPlatform * 2);
    for (const it of picked) {
      const key = String(it.id || it.onClick?.url || '');
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      merged.push(it);
    }
    if (MUSINSA.categoryCodes.length === 1 && picked.length < itemsPerPlatform) {
      console.warn(
        `무신사: 여성의류 필터 후 ${picked.length}건 (목표 ${itemsPerPlatform}, 상위 ${scanned}건 스캔)`,
      );
    }
    if (merged.length >= itemsPerPlatform) break;
  }
  return merged
    .slice(0, itemsPerPlatform)
    .map((it, i) => musinsaRowFromApi({ ...it, image: { ...(it.image || {}), rank: i + 1 } }, i));
}
