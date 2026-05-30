/**
 * 29CM 어댑터 — display-bff-api 베스트 API로 오늘 여성의류 랭킹을 실시간 수집(진짜 랭킹).
 *   POST https://display-bff-api.29cm.co.kr/api/v1/plp/best/items
 *   categoryFacetInputs.largeId=268100100(여성의류), periodFacetInput HOURLY(실시간), POPULARITY.
 *
 * 실측: platform_rank, name, brand, price, discountRate, img_url, product_url.
 * 추정: view_count·cart_count·base_wish·success_prob 등 합성 보조지표.
 * 실패 시: 기존 시드 PDP 메타 갱신으로 폴백(데이터가 비지 않게).
 */
import { fetchJsonPost } from '../lib/http.mjs';
import { C29CM } from '../crawlConfig.mjs';
import { isNonWomensApparel, rowPriceFallback } from './shared.mjs';
import { collectViaPdp, ESTIMATED_FIELDS } from './pdpRefresh.mjs';

export const platform = '29CM';
export { ESTIMATED_FIELDS };

function rowFrom29cmItem(it, rank) {
  const p = it.itemEvent?.eventProperties || {};
  const info = it.itemInfo || {};
  const price = Number(p.price) || Number(info.price) || 0;
  const name = String(p.itemName || info.productName || '').trim();
  const brand = String(p.brandName || '').trim();
  const productUrl = it.itemUrl?.webLink || `https://product.29cm.co.kr/catalog/${it.itemId}`;
  const imgUrl = info.thumbnailUrl || '';

  // 합성(추정) 보조지표 — 순위 기반 시나리오 (무신사 어댑터와 동일 규약)
  const baseWish = Math.max(1800, 12000 - rank * 900);
  const viewCount = Math.max(2200, 62000 - rank * 5200);
  const cartCount = Math.max(800, 4800 - rank * 420);

  return {
    id: `rank_today_29cm_${rank}`,
    platform_rank: rank,
    name,
    brand,
    platform: '29CM',
    price,
    discount_rate: Number(p.discountRate) || 0, // 실측
    img_url: imgUrl,
    product_url: productUrl,
    base_wish: baseWish,
    brand_pop: Math.min(94, 78 + (6 - rank) * 3),
    view_count: viewCount,
    cart_count: cartCount,
    is_preorder: /예약|예약배송|순차/.test(name),
    seasonality_match: Math.min(95, 88 + (6 - rank)),
    competitor_avg_price: price > 0 ? Math.round(price * 1.15) : rowPriceFallback(price),
    tags: ['#여성의류', '#29CM', '#오늘랭킹'],
    key_details: [`29CM 여성의류 베스트(실시간) ${rank}위`, 'display-bff-api 스냅샷'],
    ai_summary: [
      '29CM 베스트 API 기준 실시간 스냅샷입니다.',
      '찜·조회·장바구니 수치는 추정 보조지표입니다(실측 아님).',
    ],
    cart_ratio: Number((7.2 + (6 - rank) * 0.12).toFixed(1)),
    success_prob: Math.min(97, 90 + (6 - rank)),
    production_alert: false,
    gender: 'women',
    audience: 'adult',
    data_source: '29cm_best_api',
    metrics_estimated: true,
    estimated_fields: ESTIMATED_FIELDS,
  };
}

export async function collect({ seedRows, itemsPerPlatform }) {
  try {
    const j = await fetchJsonPost(C29CM.apiUrl, C29CM.body, {
      origin: C29CM.origin,
      referer: C29CM.referer,
    });
    const list = Array.isArray(j?.data?.list) ? j.data.list : [];
    const picked = [];
    for (const it of list) {
      const p = it.itemEvent?.eventProperties || {};
      if (p.isAd) continue; // 광고 제외
      if (p.largeCategoryNo && p.largeCategoryNo !== C29CM.womensLargeCategoryId) continue;
      const label = `${p.itemName || ''} ${p.brandName || ''}`;
      if (isNonWomensApparel(label)) continue;
      picked.push(it);
      if (picked.length >= itemsPerPlatform) break;
    }
    if (picked.length === 0) throw new Error('여성의류 베스트 0건');
    return picked.map((it, i) => rowFrom29cmItem(it, i + 1));
  } catch (e) {
    console.warn(`[29CM] 베스트 API 실패 → 시드 PDP 갱신 폴백: ${e.message}`);
    return collectViaPdp(seedRows, { platform, mode: 'jsonld' });
  }
}
