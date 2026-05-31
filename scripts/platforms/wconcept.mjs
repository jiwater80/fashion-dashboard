/**
 * W컨셉 어댑터 — display-bff 베스트 API로 여성 일간 랭킹을 실시간 수집(진짜 랭킹).
 *   POST https://gw-front.wconcept.co.kr/display/api/best/v1/product (display-api-key 헤더)
 *   웹 프론트는 안티봇이지만 BFF는 정적 키만 있으면 서버에서 직접 호출됨 → 브라우저 불필요.
 *
 * 실측: platform_rank, name, brand, price, discount_rate, img_url, base_wish(heartCnt 찜), review_count, review_rating.
 * 추정: view_count·cart_count·success_prob 등.
 * 실패(키 회전 등) 시: 기존 시드 PDP 메타 갱신으로 폴백.
 */
import { fetchJsonPost } from '../lib/http.mjs';
import { WCONCEPT } from '../crawlConfig.mjs';
import { isNonWomensApparel, rowPriceFallback } from './shared.mjs';
import { collectViaPdp } from './pdpRefresh.mjs';

export const platform = 'W컨셉';

/** 합성(추정) 보조지표 — W컨셉은 찜(base_wish)·리뷰가 실측이라 그 외만 추정 */
export const ESTIMATED_FIELDS = ['brand_pop', 'view_count', 'cart_count', 'competitor_avg_price', 'cart_ratio', 'success_prob', 'seasonality_match'];

function rowFromWconcept(p, rank) {
  const price = Number(p.finalPrice) || Number(p.salePrice) || Number(p.customerPrice) || 0;
  const name = String(p.itemName || '').trim();
  const brand = String(p.brandNameKr || p.brandNameEn || '').trim();
  const heart = Math.max(0, Number(p.heartCnt) || 0); // 실측 찜수
  const reviewCount = Math.max(0, Number(p.reviewCnt) || 0);

  return {
    id: `rank_today_wconcept_${rank}`,
    platform_rank: rank,
    name,
    brand,
    platform: 'W컨셉',
    price,
    discount_rate: Number(p.finalDiscountRate) || 0, // 실측
    img_url: p.productImageUrl || '',
    product_url: p.landingUrl || `https://www.wconcept.co.kr/Product/${p.itemCd}`,
    base_wish: heart, // 실측 (찜)
    review_count: reviewCount, // 실측
    review_rating: Math.round((Number(p.reviewScore) || 0) * 10) / 10, // 실측
    brand_pop: Math.min(94, 78 + (6 - rank) * 3),
    view_count: Math.max(2200, 62000 - rank * 5200),
    cart_count: Math.max(800, 4800 - rank * 420),
    is_preorder: false,
    seasonality_match: Math.min(95, 88 + (6 - rank)),
    competitor_avg_price: price > 0 ? Math.round(price * 1.15) : rowPriceFallback(price),
    tags: ['#여성의류', '#W컨셉', '#오늘랭킹'],
    key_details: [`W컨셉 여성 일간 베스트(실시간) ${rank}위`, `찜 ${heart.toLocaleString()} · display-bff 스냅샷`],
    ai_summary: ['W컨셉 베스트 API 기준 실시간 스냅샷입니다.', '찜·리뷰는 실측, 조회·장바구니는 추정 보조지표입니다.'],
    cart_ratio: Number((7.2 + (6 - rank) * 0.12).toFixed(1)),
    success_prob: Math.min(97, 90 + (6 - rank)),
    production_alert: false,
    gender: 'women',
    audience: 'adult',
    data_source: 'wconcept_best_api',
    metrics_estimated: true,
    estimated_fields: ESTIMATED_FIELDS,
  };
}

export async function collect({ seedRows, itemsPerPlatform }) {
  try {
    const j = await fetchJsonPost(WCONCEPT.apiUrl, WCONCEPT.body, {
      origin: WCONCEPT.origin,
      referer: WCONCEPT.referer,
      headers: { 'display-api-key': WCONCEPT.apiKey },
    });
    const list = Array.isArray(j?.data?.content) ? j.data.content : [];
    const picked = [];
    for (const p of list) {
      if (p.categoryDepthName1 && p.categoryDepthName1 !== '의류') continue; // 의류만
      const label = `${p.itemName || ''} ${p.brandNameKr || ''} ${p.categoryDepthName2 || ''}`;
      if (isNonWomensApparel(label)) continue;
      picked.push(p);
      if (picked.length >= itemsPerPlatform) break;
    }
    if (picked.length === 0) throw new Error('여성의류 베스트 0건');
    return picked.map((p, i) => rowFromWconcept(p, i + 1));
  } catch (e) {
    console.warn(`[W컨셉] 베스트 API 실패 → 시드 PDP 갱신 폴백: ${e.message}`);
    return collectViaPdp(seedRows, { platform, mode: 'og' });
  }
}
