/**
 * 크롤 전용 설정 (Node 스크립트에서만 사용 — 프론트 번들에 포함 안 됨).
 * 내부 API 경로·카테고리 코드 등 "사람이 안 보는" 수집 파라미터.
 * 시즌/표시 설정은 src/config.js 참고.
 */

/** 무신사 공개 랭킹 API */
export const MUSINSA = {
  apiBase: 'https://api.musinsa.com/api2/hm/web/v5/pans/ranking/sections/200',
  storeCode: 'musinsa',
  gf: 'F', // 여성
  /**
   * 수집 카테고리.
   * - 현재(Phase 1): '001011'(민소매 티) — 기존 동작 유지.
   * - Phase 2 확장안: ''(여성 전체) 또는 ['001','003','002','100','022'] 핵심 카테고리 라운드로빈.
   *   확장 시 응답이 여성의류로 채워지는지 검증 후 전환할 것.
   */
  categoryCodes: ['001011'],
};

/**
 * 29CM 베스트(랭킹) API — display-bff-api 직접 POST (브라우저 불필요).
 * categoryFacetInputs.largeId 268100100 = 여성의류. period HOURLY = 실시간.
 */
export const C29CM = {
  apiUrl: 'https://display-bff-api.29cm.co.kr/api/v1/plp/best/items',
  origin: 'https://www.29cm.co.kr',
  referer: 'https://www.29cm.co.kr/',
  womensLargeCategoryId: 268100100,
  body: {
    pageRequest: { page: 1, size: 100 },
    userSegment: { gender: 'F' },
    facets: {
      categoryFacetInputs: [{ largeId: 268100100 }],
      periodFacetInput: { type: 'HOURLY', order: 'DESC' },
      rankingFacetInput: { type: 'POPULARITY' },
    },
  },
};

/** 플랫폼별 PDP 갱신 간 지연(ms) — 과도한 요청 방지 */
export const PDP_DELAY_MS = 400;

/**
 * historical_trends.json 보존 스냅샷 수(일).
 * 화면은 오늘 + 한 달 전만 쓰지만, 향후 1년 전 비교 여지를 두고 넉넉히 보존.
 */
export const MAX_HISTORY_SNAPSHOTS = 400;
