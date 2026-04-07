/** @typedef {{ label: string, views: number, cart: number }} TrendPoint */

/** 등록 후 기간이 길 때 일별 포인트 상한 (가독성) */
export const TREND_MAX_DAYS = 90;

/** 등록일 불명 시 기본 최근 일수 */
export const TREND_FALLBACK_DAYS = 30;

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function seededRandom(seed) {
  return function next() {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return seed / 0xffffffff;
  };
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return startOfDay(x);
}

function formatDisplay(d) {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * @returns {{ date: Date, hint: string } | null}
 */
function parseRegistrationInternal(item) {
  if (item?.product_registered_at) {
    const raw = String(item.product_registered_at).trim();
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      return { date: startOfDay(d), hint: '데이터 필드 기준' };
    }
  }

  const img = item?.img_url || '';

  const m29 = img.match(/\/item\/(\d{4})(\d{2})\//);
  if (m29) {
    const y = parseInt(m29[1], 10);
    const m = parseInt(m29[2], 10) - 1;
    return { date: startOfDay(new Date(y, m, 1)), hint: '29CM 이미지 경로(년월) 기준 추정' };
  }

  const mMs = img.match(/goods_img\/(\d{4})(\d{2})(\d{2})\//);
  if (mMs) {
    return {
      date: startOfDay(new Date(parseInt(mMs[1], 10), parseInt(mMs[2], 10) - 1, parseInt(mMs[3], 10))),
      hint: '무신사 이미지 경로 기준 추정',
    };
  }

  const mZz = img.match(/\/(\d{4})\/(\d{1,2})\/(\d{1,2})\//);
  if (mZz && item?.platform === '지그재그') {
    return {
      date: startOfDay(new Date(parseInt(mZz[1], 10), parseInt(mZz[2], 10) - 1, parseInt(mZz[3], 10))),
      hint: '지그재그 이미지 경로 기준 추정',
    };
  }

  return null;
}

/** 등록일 0시 (로컬). 없으면 null. */
export function parseProductRegistrationStart(item) {
  return parseRegistrationInternal(item)?.date ?? null;
}

/**
 * JSON `product_registered_at` (YYYY-MM-DD) 또는 썸네일 URL 내 날짜 힌트.
 * @returns {{ display: string, hint?: string } | null}
 */
export function getProductRegistrationInfo(item) {
  const r = parseRegistrationInternal(item);
  if (!r) return null;
  return { display: formatDisplay(r.date), hint: r.hint };
}

function isAfter(a, b) {
  return startOfDay(a).getTime() > startOfDay(b).getTime();
}

function daysInclusive(from, to) {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.floor(ms / 86400000) + 1;
}

/**
 * 일별 합이 정확히 total이 되도록 마지막 칸 보정
 */
function fixSum(arr, total) {
  const a = arr.map((x) => Math.max(0, Math.round(x)));
  let s = a.reduce((x, y) => x + y, 0);
  const diff = total - s;
  if (diff !== 0 && a.length) {
    a[a.length - 1] = Math.max(0, a[a.length - 1] + diff);
  }
  return a;
}

/** 조회·장바구니 각각 독립된 일별 패턴 (곡선 형태가 달라짐) */
function syntheticViewsAndCarts(n, viewTotal, cartTotal, seed) {
  const randV = seededRandom(seed);
  const randC = seededRandom(seed + 9773);

  const weightsV = Array.from({ length: n }, (_, i) => {
    const base = 0.4 + randV() * 1.4;
    const wave = 1 + 0.35 * Math.sin((i / Math.max(n, 1)) * Math.PI * 2 + randV());
    const bump = i > n * 0.65 ? 1.12 + randV() * 0.2 : 1;
    return base * wave * bump;
  });

  const weightsC = Array.from({ length: n }, (_, i) => {
    const base = 0.35 + randC() * 1.45;
    const wave = 1 + 0.45 * Math.sin((i / Math.max(n, 1)) * Math.PI * 3.1 + randC() * 2);
    const weekendish = (i + Math.floor(randC() * 5)) % 6 < 2 ? 1.18 : 0.92;
    return base * wave * weekendish;
  });

  const sumV = weightsV.reduce((a, b) => a + b, 0);
  const sumC = weightsC.reduce((a, b) => a + b, 0);

  let views = weightsV.map((w) => (viewTotal > 0 ? (viewTotal * w) / sumV : 0));
  let carts = weightsC.map((w) => (cartTotal > 0 ? (cartTotal * w) / sumC : 0));

  views = fixSum(views, viewTotal);
  carts = fixSum(carts, cartTotal);

  return { views, carts };
}

function labelsFromRange(start, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = addDays(start, i);
    out.push(`${d.getMonth() + 1}/${d.getDate()}`);
  }
  return out;
}

/**
 * 등록일(또는 추정) ~ 오늘까지 일별 조회·장바구니.
 * `trend_stats` / `weekly_stats` 배열이 있으면 그 길이·값 사용.
 * 추정 시 조회·장바구니는 **별도** 랜덤 가중 패턴으로 생성해 선이 겹치지 않음.
 *
 * @returns {{ series: TrendPoint[], meta: { dayCount: number, rangeTruncated: boolean, fullSpanDays: number, usedCustom: boolean } }}
 */
export function getTrendViewCartSeriesWithMeta(item) {
  const today = startOfDay(new Date());
  const reg = parseProductRegistrationStart(item);
  const raw = item?.trend_stats ?? item?.weekly_stats;

  if (Array.isArray(raw) && raw.length > 0) {
    const n = raw.length;
    const start = reg && !isAfter(reg, today) ? reg : addDays(today, -(n - 1));
    const defaultLabels = labelsFromRange(start, n);
    const series = raw.map((row, i) => ({
      label: row.label || defaultLabels[i],
      views: Math.max(0, Number(row.views) || 0),
      cart: Math.max(0, Number(row.cart) || 0),
    }));
    const fullSpan = reg ? daysInclusive(reg, today) : n;
    return {
      series,
      meta: {
        dayCount: n,
        rangeTruncated: false,
        fullSpanDays: fullSpan,
        usedCustom: true,
      },
    };
  }

  const viewTotal = Math.max(0, Number(item?.view_count) || 0);
  const cartTotal = Math.max(0, Number(item?.cart_count) || 0);
  const seed = hashString(String(item?.id || item?.product_url || 'x'));

  let startDate;
  let n;
  let fullSpanDays;
  let rangeTruncated = false;

  if (reg && !isAfter(reg, today)) {
    fullSpanDays = daysInclusive(reg, today);
    if (fullSpanDays > TREND_MAX_DAYS) {
      startDate = addDays(today, -(TREND_MAX_DAYS - 1));
      n = TREND_MAX_DAYS;
      rangeTruncated = true;
    } else {
      startDate = reg;
      n = Math.max(1, fullSpanDays);
    }
  } else {
    fullSpanDays = TREND_FALLBACK_DAYS;
    startDate = addDays(today, -(TREND_FALLBACK_DAYS - 1));
    n = TREND_FALLBACK_DAYS;
  }

  const labels = labelsFromRange(startDate, n);
  const { views, carts } = syntheticViewsAndCarts(n, viewTotal, cartTotal, seed);
  const series = labels.map((label, i) => ({ label, views: views[i], cart: carts[i] }));

  return {
    series,
    meta: {
      dayCount: n,
      rangeTruncated,
      fullSpanDays,
      usedCustom: false,
    },
  };
}

export function getTrendViewCartSeries(item) {
  return getTrendViewCartSeriesWithMeta(item).series;
}

/** @deprecated */
export function getWeeklyViewCartSeries(item) {
  return getTrendViewCartSeries(item);
}

/** @deprecated */
export const TREND_DAY_COUNT = TREND_MAX_DAYS;
