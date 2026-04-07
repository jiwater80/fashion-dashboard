/**
 * 신상·급상승 전용 소스 (예정). 지금은 빈 배열을 반환한다.
 *
 * 연동 예정 URL (참고):
 * - 지그재그 신상: https://zigzag.kr/categories/-1?title=신상품
 * - 29CM 신상: https://www.29cm.co.kr/shop/new/
 *
 * 구현 후: 아래 함수가 today_womens_rankings 와 동일한 필드 형태의 행 배열을 반환하면
 * fetch-live-rankings.mjs 가 mergeRankingPoolWithNewArrivals 로 합쳐 buildPredictionSnapshotFromRanking 에 넣는다.
 *
 * @returns {Promise<object[]>} product_url, platform, name, brand, price, img_url, …
 */
export async function fetchNewArrivalRows() {
  return [];
}
