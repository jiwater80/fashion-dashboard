/**
 * 대시보드 공용 설정 — 프론트(App.jsx)와 크롤 스크립트(scripts/*)가 함께 임포트.
 * 시즌이 바뀌면 이 파일의 SEASON 한 곳만 수정하면 화면 문구·예측 가중·필터가 모두 따라간다.
 *
 * 크롤 전용(내부 API 경로·UA·categoryCode 등)은 프론트 번들에 넣지 않으려고
 * scripts/crawlConfig.mjs 로 분리했다. 이 파일은 "사람이 보는/스코어링" 설정만.
 */

/**
 * 현재 타겟 시즌. T-N 생산 리드타임 관점의 예측 대시보드라 라벨·가중 키워드가 시즌마다 바뀐다.
 * @typedef {Object} SeasonConfig
 */
export const SEASON = {
  key: 'early-summer-2026',
  /** 타겟 월 라벨 (모달 '작년 N월 유사도' 등에 사용) */
  monthLabel: '5월',
  /** 화면 헤더 큰 제목 */
  headerTitle: '여성의류 플랫폼 실시간 랭킹',
  /** 헤더 상단 영문 서브타이틀 (T-N 자동 반영) */
  subtitlePrefix: 'Fashion Intelligence',
  /** 빨간 강조 한 줄 */
  tagline: 'F/W 제외 | 코어 카테고리 한정 | 7일 급상승 추적',
  /** 생산 리드타임(일). 서브타이틀의 "T-45" 및 production 알림 기준 */
  tMinusDays: 45,
  /** 시즌 키워드 — 예측 점수에 가중. 타겟이 1달 후라 '초가을·간절기' 키워드 */
  seasonalKeywords: /니트|가디건|자[켓캣]|재[킷킷켓]|트렌치|코듀로이|기모|스웨이드|긴소매|간절기|맨투맨|후드|자켓|점퍼/i,
  /** 시즌 키워드 매칭 시 점수 배수 */
  seasonalBoost: 1.15,
};

/** 서브타이틀 전체 문자열 (예: "Fashion Intelligence : T-45 Production Dashboard") */
export function seasonSubtitle(season = SEASON) {
  return `${season.subtitlePrefix} : T-${season.tMinusDays} Production Dashboard`;
}

/**
 * 수집·노출 대상 플랫폼. order = 화면/저장 순서.
 * enabled=false 면 크롤·예측·필터에서 모두 제외(신규 플랫폼 단계적 도입용).
 * adapter = scripts/platforms/<adapter>.mjs 파일명(크롤 어댑터). 프론트는 무시.
 */
// live: true = 오늘 실제 랭킹을 실시간 수집 / false = 시드 고정 + 메타만 갱신(참고용)
export const PLATFORMS = [
  { key: '29CM', label: '29CM', order: 1, enabled: true, live: true, adapter: '29cm' },
  { key: '무신사', label: '무신사', order: 2, enabled: true, live: true, adapter: 'musinsa' },
  { key: 'W컨셉', label: 'W컨셉', order: 3, enabled: true, live: true, adapter: 'wconcept' },
  { key: '퀸잇', label: '퀸잇', order: 4, enabled: true, live: true, adapter: 'queenit' },
  // 지그재그: 랭킹 앱 전용이라 실시간 수집 불가 → 제거(2026-08-16)
  { key: '지그재그', label: '지그재그', order: 8, enabled: false, live: false, adapter: 'zigzag' },
  // 미도입(차단/미구현)
  { key: '에이블리', label: '에이블리', order: 6, enabled: false, live: false, adapter: 'ably' },
  { key: '브랜디', label: '브랜디', order: 7, enabled: false, live: false, adapter: 'brandi' },
];

/** 활성 플랫폼 key 목록 (화면 정렬 순) */
export const ACTIVE_PLATFORM_KEYS = PLATFORMS.filter((p) => p.enabled)
  .sort((a, b) => a.order - b.order)
  .map((p) => p.key);

/** 플랫폼별 오늘 랭킹 노출·수집 상한 */
export const ITEMS_PER_PLATFORM = 10;

/**
 * 예측 스코어링 — "1달 후 폭발할 아이템"을 신호 3개의 조합으로 산출.
 *  ① 순위 상승속도(rankVelocity): 최근 N일간 플랫폼 순위가 얼마나 빠르게 올랐나.
 *  ② 관심 급증(interestGrowth): 찜·리뷰 수가 최근 얼마나 늘었나(실측 지표 있는 플랫폼).
 *  ③ 신상 침투(newness): 신규 등록/신규 진입인데 벌써 상위권.
 * 추세(①②)는 과거 스냅샷(historical_trends.json) 대조로 계산 → 데이터 누적 1~2주 뒤 완전 발동.
 * 그 전(콜드스타트)에는 ③ + 실측 지표 크기 + 시즌 가중으로 동작.
 */
export const PREDICTION = {
  /** 등록일(추정) 최대 일수 — 이 안쪽이면 '신상' 후보 풀 */
  recentRegMaxDays: 56,
  /** 후보 풀에서 제외할 상위 랭크(이미 떡상한 것 제외) */
  rankExcludeTop: 3,
  /** 아우터군 — 카테고리 필드 또는 상품명 */
  outerwear: /자켓|재킷|점퍼|가디건|블루종|jacket|cardigan|jumper/i,
  /** 썸네일·경로 기반 신상 힌트 */
  imgNewHint: /summer|26ss|ss26|27ss|ss27|fall|autumn|25fw|fw25|26fw|fw26/i,
  imgNewHintBoost: 1.1,

  /** 추세 계산 시 과거 며칠 전과 비교할지 */
  velocityLookbackDays: 7,
  /** 이 일수 안에 처음 등장/등록이면 '신상'으로 */
  newnessWindowDays: 14,
  /**
   * 신호 가중치(사용 가능한 것만 재정규화).
   * 추세(velocity·growth)는 데이터 누적 후 발동 → 그 전엔 currentRank·interestLevel·newness가 정렬을 담당.
   */
  weights: {
    rankVelocity: 0.35, // ① 순위 상승속도 (추세)
    interestGrowth: 0.2, // ② 찜·리뷰 급증 (추세)
    newness: 0.2, // ③ 신상 침투
    currentRank: 0.15, // 현재 순위(실측 인기) — 콜드스타트 기본
    interestLevel: 0.1, // 찜·리뷰 규모(검증된 관심) — 콜드스타트 기본
  },
};
