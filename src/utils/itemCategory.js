/**
 * 상품 품목(아이템) 분류 — 상품명 기준 키워드 매칭.
 * 플랫폼 카테고리 필드가 제각각이라, 이름으로 분류하면 실시간·예측·과거 데이터에 모두 즉시 적용된다.
 *
 * 순서가 곧 우선순위(먼저 매칭되는 것으로 확정). 예: "데님 자켓"→자켓, "니트 원피스"→원피스,
 * "데님 스커트"→스커트. 아우터·원피스·스커트를 소재(니트/데님)보다 먼저 판정한다.
 */

/** @type {{ key: string, label: string, re: RegExp }[]} 우선순위 순 */
export const ITEM_CATEGORIES = [
  { key: '다운', label: '다운', re: /다운|패딩|덕다운|구스다운|puffer|padding|down\s?jacket/i },
  { key: '코트', label: '코트', re: /코트|트렌치|coat|trench/i },
  { key: '자켓', label: '자켓', re: /자[켓캣]|재[킷킷켓]|블레이[저져]|점퍼|점프|블루종|바람막이|jacket|blazer|blouson|windbreaker/i },
  { key: '원피스', label: '원피스', re: /원피스|드레스|dress|onepiece|one-?piece/i },
  { key: '스커트', label: '스커트', re: /스커트|치마|skirt/i },
  { key: '청바지', label: '청바지', re: /청바지|데님|denim|jean/i },
  { key: '바지', label: '바지', re: /바지|팬츠|슬랙스|조거|레깅스|반바지|숏\s?팬츠|버뮤다|와이드\s?팬츠|pants|slacks|trousers|jogger|leggings|shorts/i },
  { key: '니트', label: '스웨터(니트)', re: /니트|스웨터|가디건|풀오버|knit|sweater|cardigan|pullover/i },
  { key: '티셔츠', label: '티셔츠', re: /티셔[츠트]|반팔|반소매|민소매|나시|탱크|튜브\s?탑|홀터|뷔스티에|비스티에|슬리브리스|캐미솔|크롭\s?티|피케|tee|t-?shirt|sleeveless|tank|camisole|halter/i },
  { key: '블라우스', label: '블라우스', re: /블라우스|셔츠|남방|blouse|shirt/i },
];

/** 화면 필터용 순서(사용자 지정) — 코트/다운/자켓/블라우스/티셔츠/원피스/스웨터(니트)/바지/청바지/스커트 */
export const CATEGORY_DISPLAY_ORDER = ['코트', '다운', '자켓', '블라우스', '티셔츠', '원피스', '니트', '바지', '청바지', '스커트'];

/**
 * 상품을 품목 key 하나로 분류. 매칭 없으면 null.
 * @param {{ name?: string }} item
 * @returns {string|null}
 */
export function classifyItemCategory(item) {
  const text = String(item?.name || '');
  if (!text) return null;
  for (const c of ITEM_CATEGORIES) {
    if (c.re.test(text)) return c.key;
  }
  return null;
}

/** key(또는 'all')에 해당하는지 */
export function matchesItemCategory(item, key) {
  if (!key || key === 'all') return true;
  return classifyItemCategory(item) === key;
}

/** 표시 순서대로 [{key,label}] (전체 제외) */
export function orderedCategories() {
  const byKey = new Map(ITEM_CATEGORIES.map((c) => [c.key, c]));
  return CATEGORY_DISPLAY_ORDER.map((k) => byKey.get(k)).filter(Boolean).map((c) => ({ key: c.key, label: c.label }));
}
