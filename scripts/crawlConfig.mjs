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

/**
 * 퀸잇 — 랭킹 페이지를 헤드리스로 띄워 api.queenit.kr/general-products 응답을 수확.
 * CSR(클라이언트 렌더)이라 fetch로는 빈 화면 → 브라우저 필요. 응답에 rank·brand·name·finalPrice·reviewCount·reviewRatingAvg 포함.
 */
export const QUEENIT = {
  rankingPageUrl: 'https://queenit.kr/category/ranking',
  apiMatch: /\/general-products/,
  productUrlBase: 'https://web.queenit.kr/products/',
};

/**
 * W컨셉 베스트(랭킹) API — display-bff 직접 POST (브라우저 불필요).
 * 웹 프론트(/women/best)는 안티봇이지만 BFF는 정적 display-api-key 헤더만 있으면 서버에서 직접 호출됨.
 * domain:WOMEN, dateType:daily = 여성 일간 랭킹. 응답에 heartCnt(찜)·reviewCnt·reviewScore 실측 포함.
 * ⚠️ apiKey는 사이트에 박힌 정적 키 — 회전되면 401/403 → 어댑터가 시드 PDP로 폴백.
 */
export const WCONCEPT = {
  apiUrl: 'https://gw-front.wconcept.co.kr/display/api/best/v1/product',
  apiKey: 'VWmkUPgs6g2fviPZ5JQFQ3pERP4tIXv/J2jppLqSRBk=',
  origin: 'https://display.wconcept.co.kr',
  referer: 'https://display.wconcept.co.kr/',
  body: {
    custNo: '0', domain: 'WOMEN', genderType: 'all', dateType: 'daily',
    ageGroup: 'all', depth1Code: 'ALL', depth2Code: 'ALL', pageSize: 100, pageNo: 1,
  },
};

/**
 * 네이버 데이터랩 쇼핑인사이트 — 여성의류 인기 검색어 Top. 공식 오픈API가 아닌 데이터랩 웹 내부 엔드포인트.
 * 인증 토큰 불필요(Referer 헤더만). 상품 랭킹이 아니라 "검색 트렌드"(뜨는 검색어).
 */
export const NAVER_TRENDS = {
  url: 'https://datalab.naver.com/shoppingInsight/getCategoryKeywordRank.naver',
  referer: 'https://datalab.naver.com/shoppingInsight/sCategory.naver',
  origin: 'https://datalab.naver.com',
  cid: 50000167, // 패션의류 > 여성의류
  category: '여성의류',
  count: 100,
  lookbackDays: 7, // 최근 N일 기준 인기 검색어
};

/** 플랫폼별 PDP 갱신 간 지연(ms) — 과도한 요청 방지 */
export const PDP_DELAY_MS = 400;

/**
 * historical_trends.json 보존 스냅샷 수(일).
 * 화면은 오늘 + 한 달 전만 쓰지만, 향후 1년 전 비교 여지를 두고 넉넉히 보존.
 */
export const MAX_HISTORY_SNAPSHOTS = 400;
