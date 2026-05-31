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
  headerTitle: '5월 타겟 (초여름) 예측 히스토리',
  /** 헤더 상단 영문 서브타이틀 (T-N 자동 반영) */
  subtitlePrefix: 'Fashion Intelligence',
  /** 빨간 강조 한 줄 */
  tagline: 'F/W 제외 | 코어 카테고리 한정 | 7일 급상승 추적',
  /** 생산 리드타임(일). 서브타이틀의 "T-45" 및 production 알림 기준 */
  tMinusDays: 45,
  /** 시즌 키워드 — 예측 모멘텀에 가중(초여름·쿨소재) */
  seasonalKeywords: /린넨|린네|반팔|시어|냉감|시폰|메시|아이스|쿨/i,
  /** 시즌 키워드 매칭 시 모멘텀 배수 */
  seasonalBoost: 1.2,
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
  { key: '퀸잇', label: '퀸잇', order: 3, enabled: true, live: true, adapter: 'queenit' },
  // 참고용: 랭킹이 앱 전용(지그재그)·안티봇(W컨셉)이라 실시간 수집 불가 → 시드 + 메타 갱신
  { key: '지그재그', label: '지그재그', order: 4, enabled: true, live: false, adapter: 'zigzag' },
  { key: 'W컨셉', label: 'W컨셉', order: 5, enabled: true, live: false, adapter: 'wconcept' },
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

/** 예측 스코어링 상수 */
export const PREDICTION = {
  /** 등록일(추정) 최대 일수 — 이 안쪽이면 '신상' 후보 풀 */
  recentRegMaxDays: 56,
  /** 후보 풀에서 제외할 상위 랭크(이미 떡상한 것 제외) */
  rankExcludeTop: 3,
  /** 아우터군 — 카테고리 필드 또는 상품명 */
  outerwear: /자켓|재킷|점퍼|가디건|블루종|jacket|cardigan|jumper/i,
  /** 썸네일·경로 기반 신상 힌트 */
  imgNewHint: /summer|26ss|ss26|27ss|ss27/i,
  imgNewHintBoost: 1.15,
};
