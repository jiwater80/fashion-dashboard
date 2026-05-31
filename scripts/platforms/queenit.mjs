/**
 * 퀸잇 어댑터 — 랭킹 페이지(CSR)를 헤드리스로 띄워 general-products 응답을 수확(진짜 랭킹).
 *   실측: platform_rank(응답 rank), name, brand, price, review_count, review_rating, img_url.
 *   추정: view_count·cart_count·base_wish 등 합성 보조지표.
 *   data_source='queenit_ranking_harvest'. 실패(브라우저 미설치 등) 시 빈 배열 → 오케스트레이터가 처리.
 */
import { harvestJsonResponses } from '../lib/harvest.mjs';
import { QUEENIT } from '../crawlConfig.mjs';
import { isNonWomensApparel, rowPriceFallback } from './shared.mjs';

export const platform = '퀸잇';

/** 합성(추정) 보조지표 — 퀸잇은 리뷰수·평점이 실측이라 그 외만 추정 */
export const ESTIMATED_FIELDS = ['base_wish', 'brand_pop', 'view_count', 'cart_count', 'competitor_avg_price', 'cart_ratio', 'success_prob', 'seasonality_match'];

function rowFromQueenit(p, rank) {
  const price = Number(p.finalPrice) || Number(p.originalPrice) || 0;
  const name = String(p.name || p.displayName || '').trim();
  const brand = String(p.brand || p.mallName || '').trim();
  const img = p.imageUrl || p.thumbnailUrl || p.multiResolutionImage?.url_2x || '';
  const reviewCount = Number(p.reviewCount) || 0;

  const baseWish = reviewCount > 0 ? Math.min(25000, 2000 + reviewCount * 200) : Math.max(1800, 12000 - rank * 900);
  return {
    id: `rank_today_queenit_${rank}`,
    platform_rank: rank,
    name,
    brand,
    platform: '퀸잇',
    price,
    discount_rate: Number(p.discountPercentage) || 0, // 실측
    img_url: img,
    product_url: `${QUEENIT.productUrlBase}${p.productId}`,
    review_count: reviewCount, // 실측
    review_rating: Number(p.reviewRatingAvg) || 0, // 실측
    base_wish: baseWish,
    brand_pop: Math.min(94, 78 + (6 - rank) * 3),
    view_count: Math.max(2200, 62000 - rank * 5200),
    cart_count: Math.max(800, 4800 - rank * 420),
    is_preorder: false,
    seasonality_match: Math.min(95, 88 + (6 - rank)),
    competitor_avg_price: price > 0 ? Math.round(price * 1.15) : rowPriceFallback(price),
    tags: ['#여성의류', '#퀸잇', '#오늘랭킹'],
    key_details: [`퀸잇 랭킹(실시간) ${rank}위`, 'api.queenit.kr 수확'],
    ai_summary: ['퀸잇 랭킹 페이지 수확 스냅샷입니다.', '리뷰수·평점은 실측, 찜·조회·장바구니는 추정입니다.'],
    cart_ratio: Number((7.2 + (6 - rank) * 0.12).toFixed(1)),
    success_prob: Math.min(97, 90 + (6 - rank)),
    production_alert: false,
    gender: 'women',
    audience: 'adult',
    data_source: 'queenit_ranking_harvest',
    metrics_estimated: true,
    estimated_fields: ESTIMATED_FIELDS,
  };
}

export async function collect({ itemsPerPlatform }) {
  let caps;
  try {
    caps = await harvestJsonResponses(QUEENIT.rankingPageUrl, { match: QUEENIT.apiMatch });
  } catch (e) {
    console.warn(`[퀸잇] 헤드리스 수확 실패(빈 결과 반환): ${e.message}`);
    return [];
  }
  // 응답들에서 상품 리스트 합치고 productId 중복 제거, rank 순 정렬
  const seen = new Set();
  const all = [];
  for (const j of caps) {
    for (const p of j?.list || []) {
      if (!p?.productId || seen.has(p.productId)) continue;
      if (p.isSponsoredProduct || p.adProductId) continue; // 광고 제외
      const label = `${p.name || ''} ${p.brand || ''} ${p.category || ''}`;
      if (isNonWomensApparel(label)) continue;
      seen.add(p.productId);
      all.push(p);
    }
  }
  all.sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999));
  return all.slice(0, itemsPerPlatform).map((p, i) => rowFromQueenit(p, i + 1));
}
