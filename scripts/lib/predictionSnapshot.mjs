/**
 * 랭킹 풀(+ 향후 신상 전용 크롤)에서 「떡상 후보」 스냅샷을 만든다.
 * fetch-new-arrivals.mjs 가 같은 Row 형태의 배열을 넘기면 mergeRankingPoolWithNewArrivals 로 합친 뒤 이 모듈만 호출하면 된다.
 */

import { parseProductRegistrationStart } from '../../src/utils/itemAnalytics.js';

export const PREDICTION_PLATFORMS = ['29CM', '무신사', '지그재그', 'W컨셉'];

/** 플랫폼별 후보 상한 (fetch-live 와 동기) */
export const DEFAULT_ITEMS_PER_PLATFORM = 10;

/** 등록일(추정) 최대 일수 */
export const RECENT_REG_MAX_DAYS = 56;
export const RANK_EXCLUDE_TOP = 3;

/** 5월(초여름) 대비 계절 키워드 — 모멘텀에 가중 */
const SEASONAL_FOR_MAY = /린넨|반팔|시어|냉감/i;

/** 아우터군 — 카테고리 필드 또는 상품명 */
const OUTERWEAR = /자켓|재킷|점퍼|가디건|블루종|jacket|cardigan|jumper/i;

/** 썸네일·경로 기반 신상 힌트 */
const IMG_NEW_HINT = /summer|26ss|ss26|27ss|ss27/i;

function normUrl(u) {
  return String(u || '')
    .split('?')[0]
    .split('#')[0];
}

export function momentumBase(row) {
  const v = Math.max(0, Number(row.view_count) || 0);
  const c = Math.max(0, Number(row.cart_count) || 0);
  const w = Math.max(50, Number(row.base_wish) || 100);
  return (v * c) / w;
}

function registrationAgeDays(row, nowMs) {
  const reg = parseProductRegistrationStart(row);
  if (!reg) return null;
  return (nowMs - reg.getTime()) / 86400000;
}

function cartViewRatio(row) {
  const v = Math.max(1, Number(row.view_count) || 0);
  const c = Math.max(0, Number(row.cart_count) || 0);
  return c / v;
}

function rowTextForCategory(row) {
  const cat = row.category ?? row.category_name ?? row.goods_category ?? '';
  return `${String(row.name || '')} ${String(cat)}`;
}

function isOuterwearRow(row) {
  return OUTERWEAR.test(rowTextForCategory(row));
}

function hasSeasonalKeyword(row) {
  return SEASONAL_FOR_MAY.test(String(row.name || ''));
}

function hasImgNewHint(row) {
  return IMG_NEW_HINT.test(String(row.img_url || ''));
}

/**
 * @param {object} row
 * @param {{ platformMeanCartView: number }} ctx
 * @returns {{ score: number, signals: string[], roem_copy_priority: boolean, outerwear: boolean, base: number }}
 */
export function scorePredictionRow(row, ctx, nowMs = Date.now()) {
  const base = momentumBase(row);
  let score = base;
  const signals = [];

  if (hasSeasonalKeyword(row)) {
    score *= 1.2;
    signals.push('초여름·쿨소재 키워드(5월 대비)');
  }
  if (hasImgNewHint(row)) {
    score *= 1.15;
    signals.push('썸네일·경로 신상 힌트');
  }

  const age = registrationAgeDays(row, nowMs);
  if (age != null && age >= 0 && age <= RECENT_REG_MAX_DAYS) {
    signals.push('신규 등록 추정');
  }

  const cv = cartViewRatio(row);
  const mean = ctx.platformMeanCartView || 0;
  let roem = false;
  if (mean > 0 && cv >= mean * 2) {
    roem = true;
    signals.push('[로엠 카피 우선] 조회 대비 장바구니 비율 2배+');
  } else if (Number(row.cart_ratio) >= 12) {
    signals.push('장바구니 전환(CR) 강함');
  }

  const outerwear = isOuterwearRow(row);

  return { score, signals, roem_copy_priority: roem, outerwear, base };
}

/**
 * 동일 PDP URL은 newArrivalRows 가 덮어쓴다(신상 소스 우선).
 * @param {object[]} rankingFinal
 * @param {object[]} newArrivalRows
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
    map.set(u, {
      ...prev,
      ...r,
      _prediction_sources: [...new Set([...(prev._prediction_sources || []), 'new_arrivals'])],
    });
  }
  return Array.from(map.values());
}

/**
 * @param {object[]} poolRows merge 후 전체 후보 풀
 * @param {{ itemsPerPlatform?: number }} [opts]
 */
export function buildPredictionSnapshotFromRanking(poolRows, opts = {}) {
  const itemsPerPlatform = opts.itemsPerPlatform ?? DEFAULT_ITEMS_PER_PLATFORM;
  const nowMs = Date.now();
  const out = [];

  for (const p of PREDICTION_PLATFORMS) {
    const rows = poolRows.filter((r) => r.platform === p).sort((a, b) => a.platform_rank - b.platform_rank);
    if (!rows.length) continue;

    const recent = rows.filter((r) => {
      const age = registrationAgeDays(r, nowMs);
      return age != null && age >= 0 && age <= RECENT_REG_MAX_DAYS;
    });

    let pool;
    if (recent.length >= 4) {
      pool = recent;
    } else {
      const topUrls = new Set(
        rows.filter((r) => r.platform_rank <= RANK_EXCLUDE_TOP).map((r) => normUrl(r.product_url)),
      );
      const deeper = rows.filter((r) => !topUrls.has(normUrl(r.product_url)));
      pool = deeper.length >= 4 ? deeper : rows.slice();
    }

    const ratios = pool.map(cartViewRatio);
    const platformMeanCartView = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0;
    const ctx = { platformMeanCartView };

    const scored = pool.map((r) => {
      const meta = scorePredictionRow(r, ctx, nowMs);
      return { r, ...meta };
    });

    scored.sort((a, b) => {
      if (a.outerwear !== b.outerwear) return a.outerwear ? -1 : 1;
      return b.score - a.score;
    });

    scored.slice(0, itemsPerPlatform).forEach((x, i) => {
      const { r, score, signals, roem_copy_priority } = x;
      const kd = Array.isArray(r.key_details) ? [...r.key_details] : [];
      if (!kd.some((t) => String(t).includes('떡상 후보'))) {
        kd.unshift('[떡상 후보] 로엠 디렉터 관점 스코어·필터');
      }
      const hint = signals.length ? signals.slice(0, 2).join(' · ') : '조회×장바구니 모멘텀 기준';

      out.push({
        ...r,
        platform_rank: i + 1,
        key_details: kd,
        prediction_momentum_score: Math.round(score * 100) / 100,
        prediction_signals: signals,
        prediction_hint: hint,
        roem_copy_priority: roem_copy_priority,
      });
    });
  }

  return out;
}
