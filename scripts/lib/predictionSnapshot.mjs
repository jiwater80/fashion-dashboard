/**
 * 「1달 후 폭발할 아이템」 예측 스냅샷 — 신호 3개 조합.
 *  ① 순위 상승속도(rankVelocity)   : 최근 N일간 플랫폼 순위가 얼마나 올랐나
 *  ② 관심 급증(interestGrowth)     : 찜·리뷰 수가 최근 얼마나 늘었나(실측 지표 있는 플랫폼)
 *  ③ 신상 침투(newness)            : 신규 등록/신규 진입인데 벌써 상위권
 *
 * ①②는 과거 스냅샷(historical_trends.json) 대조로 계산 → historical 이 매일 커밋되므로 별도 아카이브·워크플로 불필요.
 * 스냅샷 각 행에 source_rank(그날 실제 순위)·base_wish·review_count 를 남겨 다음 날 대조에 쓴다.
 * 과거 데이터가 없을 때(콜드스타트)는 ③ + 시즌 가중으로 동작하고, 힌트에 "상승속도 집계중"을 표기한다.
 */

import { parseProductRegistrationStart } from '../../src/utils/itemAnalytics.js';
import { SEASON, PREDICTION, ITEMS_PER_PLATFORM, ACTIVE_PLATFORM_KEYS } from '../../src/config.js';

export const PREDICTION_PLATFORMS = ACTIVE_PLATFORM_KEYS;
export const DEFAULT_ITEMS_PER_PLATFORM = ITEMS_PER_PLATFORM;
export const RECENT_REG_MAX_DAYS = PREDICTION.recentRegMaxDays;

const SEASONAL_KEYWORDS = SEASON.seasonalKeywords;
const IMG_NEW_HINT = PREDICTION.imgNewHint;
const { velocityLookbackDays: LOOKBACK, newnessWindowDays: NEW_WINDOW, weights: W } = PREDICTION;

const num = (x) => Math.max(0, Number(x) || 0);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const normUrl = (u) => String(u || '').split('?')[0].split('#')[0];
const dateMs = (key) => new Date(String(key).replace(/\./g, '-')).getTime();

function registrationAgeDays(row, nowMs) {
  const reg = parseProductRegistrationStart(row);
  if (!reg) return null;
  return (nowMs - reg.getTime()) / 86400000;
}

/**
 * 과거 스냅샷에서 url → [{ageDays, rank, wish, reviews}] (가까운 날 먼저) 인덱스.
 * source_rank 가 있는(신형) 스냅샷만 사용 → 과거 합성 데이터 오염 방지.
 */
function buildHistoryIndex(history, todayKey) {
  const idx = new Map();
  if (!history || typeof history !== 'object') return idx;
  const todayMs = dateMs(todayKey);
  const maxAge = LOOKBACK * 3;
  for (const [date, snap] of Object.entries(history)) {
    if (date === todayKey || !Array.isArray(snap)) continue;
    const ageDays = (todayMs - dateMs(date)) / 86400000;
    if (!(ageDays > 0) || ageDays > maxAge) continue;
    for (const row of snap) {
      if (row?.source_rank == null) continue;
      const url = normUrl(row.product_url);
      if (!url) continue;
      if (!idx.has(url)) idx.set(url, []);
      idx.get(url).push({ ageDays, rank: Number(row.source_rank), wish: num(row.base_wish), reviews: num(row.review_count) });
    }
  }
  for (const arr of idx.values()) arr.sort((a, b) => a.ageDays - b.ageDays);
  return idx;
}

/** 찜(base_wish)이 실측인 행인지 — estimated_fields 에 없으면 실측 */
function wishIsReal(row) {
  return !(Array.isArray(row.estimated_fields) && row.estimated_fields.includes('base_wish'));
}

/**
 * 한 상품의 세 신호 점수 계산.
 * @returns {{score:number, signals:string[], roem:boolean, isNew:boolean, velDelta:number|null, growthPct:number|null}}
 */
function scoreRow(row, ctx) {
  const { idx, hasHistory, itemsPerPlatform, nowMs, maxWish, maxReview } = ctx;
  const url = normUrl(row.product_url);
  const todayRank = Number(row.platform_rank) || itemsPerPlatform;
  const past = idx.get(url) || null;
  const oldest = past && past.length ? past[past.length - 1] : null;
  const signals = [];

  // ── ① 순위 상승속도 ──
  let velScore = null;
  let velDelta = null;
  let newEntry = false;
  if (hasHistory) {
    if (!oldest) {
      newEntry = true; // 과거 창엔 없고 오늘 등장 → 신규 진입
      velScore = 0.7;
    } else {
      velDelta = oldest.rank - todayRank; // +면 상승
      velScore = clamp01(velDelta / 8);
    }
  }

  // ── ② 관심 급증(찜·리뷰) ──
  let growthScore = null;
  let growthPct = null;
  let growthKind = '';
  if (hasHistory && oldest) {
    const cands = [];
    if (wishIsReal(row) && oldest.wish > 0) cands.push(['찜', (num(row.base_wish) - oldest.wish) / oldest.wish]);
    if (num(row.review_count) > 0 && oldest.reviews > 0) cands.push(['리뷰', (num(row.review_count) - oldest.reviews) / oldest.reviews]);
    if (cands.length) {
      const best = cands.reduce((a, b) => (b[1] > a[1] ? b : a));
      growthKind = best[0];
      growthPct = best[1];
      growthScore = clamp01(best[1] / 0.5); // +50% → 만점
    }
  }

  // ── ③ 신상 침투 ──
  const regAge = registrationAgeDays(row, nowMs);
  const regNew = regAge != null && regAge >= 0 && regAge <= NEW_WINDOW;
  const isNew = regNew || newEntry;
  const rankFactor = clamp01((itemsPerPlatform - todayRank + 1) / itemsPerPlatform);
  const newnessScore = isNew ? 0.5 + 0.5 * rankFactor : 0;

  // ── 기본 신호(항상): 현재 순위 · 실측 관심 규모 ──
  const rankScore = rankFactor;
  let interestScore = null;
  {
    const cands = [];
    if (wishIsReal(row) && maxWish > 0) cands.push(num(row.base_wish) / maxWish);
    if (num(row.review_count) > 0 && maxReview > 0) cands.push(num(row.review_count) / maxReview);
    if (cands.length) interestScore = clamp01(Math.max(...cands));
  }

  // ── 가중 결합(없는 신호는 가중치 재분배) ──
  const parts = [];
  if (velScore != null) parts.push(['rankVelocity', velScore]);
  if (growthScore != null) parts.push(['interestGrowth', growthScore]);
  parts.push(['newness', newnessScore]);
  parts.push(['currentRank', rankScore]);
  if (interestScore != null) parts.push(['interestLevel', interestScore]);
  const totalW = parts.reduce((s, [k]) => s + W[k], 0) || 1;
  let combined = parts.reduce((s, [k, v]) => s + (W[k] / totalW) * v, 0);

  if (SEASONAL_KEYWORDS.test(String(row.name || ''))) {
    combined = Math.min(1, combined * SEASON.seasonalBoost);
    signals.push('초가을 시즌 키워드');
  }
  if (IMG_NEW_HINT.test(String(row.img_url || ''))) combined = Math.min(1, combined * PREDICTION.imgNewHintBoost);

  // ── 신호 문구 ──
  if (newEntry) signals.unshift('신규 진입(랭킹 첫 등장)');
  else if (velDelta > 0) signals.unshift(`순위 +${velDelta}계단↑(${LOOKBACK}일)`);
  if (growthScore != null && growthPct > 0.05) signals.push(`${growthKind} +${Math.round(growthPct * 100)}%↑`);
  if (regNew) signals.push('신상 추정');
  if (!hasHistory) signals.push('상승속도 집계중(데이터 누적 후 반영)');

  const roem = velScore >= 0.6 || (growthScore != null && growthScore >= 0.6);

  return { score: Math.round(combined * 1000) / 10, signals, roem, isNew, velDelta, growthPct };
}

/**
 * 동일 PDP URL은 newArrivalRows 가 덮어쓴다(신상 소스 우선).
 */
export function mergeRankingPoolWithNewArrivals(rankingFinal, newArrivalRows) {
  const map = new Map();
  for (const r of rankingFinal) {
    const u = normUrl(r.product_url);
    if (!u) continue;
    map.set(u, { ...r, _prediction_sources: Array.isArray(r._prediction_sources) ? r._prediction_sources : ['ranking'] });
  }
  for (const r of newArrivalRows || []) {
    const u = normUrl(r.product_url);
    if (!u) continue;
    const prev = map.get(u) || {};
    map.set(u, { ...prev, ...r, _prediction_sources: [...new Set([...(prev._prediction_sources || []), 'new_arrivals'])] });
  }
  return Array.from(map.values());
}

/**
 * @param {object[]} poolRows merge 후 전체 후보 풀(오늘 랭킹, 실제 platform_rank·찜·리뷰 보유)
 * @param {{ itemsPerPlatform?: number, history?: object, todayKey?: string }} [opts]
 */
export function buildPredictionSnapshotFromRanking(poolRows, opts = {}) {
  const itemsPerPlatform = opts.itemsPerPlatform ?? DEFAULT_ITEMS_PER_PLATFORM;
  const nowMs = Date.now();
  const idx = buildHistoryIndex(opts.history, opts.todayKey || '');
  const hasHistory = idx.size > 0;
  const out = [];

  for (const p of PREDICTION_PLATFORMS) {
    const rows = poolRows.filter((r) => r.platform === p).sort((a, b) => a.platform_rank - b.platform_rank);
    if (!rows.length) continue;

    const maxWish = Math.max(0, ...rows.filter(wishIsReal).map((r) => num(r.base_wish)));
    const maxReview = Math.max(0, ...rows.map((r) => num(r.review_count)));
    const ctx = { idx, hasHistory, itemsPerPlatform, nowMs, maxWish, maxReview };
    const scored = rows.map((r) => ({ r, ...scoreRow(r, ctx) }));
    scored.sort((a, b) => b.score - a.score);

    scored.slice(0, itemsPerPlatform).forEach((x) => {
      const { r, score, signals, roem, isNew, velDelta, growthPct } = x;
      const kd = Array.isArray(r.key_details) ? [...r.key_details] : [];
      if (!kd.some((t) => String(t).includes('떡상'))) kd.unshift('[떡상 후보] 순위상승·관심급증·신상침투 조합');
      const hint = signals.length ? signals.slice(0, 2).join(' · ') : '조합 신호 기준';
      out.push({
        ...r,
        source_rank: r.platform_rank, // 다음 날 추세 대조용(실제 순위)
        key_details: kd,
        prediction_momentum_score: score,
        prediction_signals: signals,
        prediction_hint: hint,
        prediction_velocity_delta: velDelta,
        prediction_growth_pct: growthPct == null ? null : Math.round(growthPct * 100),
        prediction_is_new: isNew,
        roem_copy_priority: roem,
      });
    });
  }

  // 플랫폼 교차 글로벌 정렬 — "가장 뜰 아이템"이 위로. platform_rank 는 예측 순위(표시용)로 재부여.
  out.sort((a, b) => b.prediction_momentum_score - a.prediction_momentum_score);
  out.forEach((r, i) => {
    r.platform_rank = i + 1;
  });
  return out;
}
