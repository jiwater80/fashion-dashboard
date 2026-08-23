/**
 * 네이버 데이터랩 쇼핑인사이트 — 여성의류 인기 검색어 Top 수집.
 * fetch-live 가 결과를 historical_trends.json['naver_trends'] 예약키에 저장(별도 파일/워크플로 불필요).
 * 전일 대비 순위 변화(▲▼)는 과거 저장분과 대조해 프론트에서 표시.
 */
import { fetchWithRetry } from './lib/http.mjs';
import { NAVER_TRENDS } from './crawlConfig.mjs';
import { seoulDateKey } from '../src/utils/seoulDateKey.js';

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

/**
 * @returns {Promise<{updated:string, category:string, period:{start:string,end:string}, keywords:{rank:number,keyword:string}[]}>}
 */
export async function fetchNaverTrends() {
  const end = new Date();
  end.setDate(end.getDate() - 1); // 데이터 지연 감안, 어제까지
  const start = new Date();
  start.setDate(start.getDate() - NAVER_TRENDS.lookbackDays);

  // 데이터랩은 페이지당 20개 → 목표(count)까지 페이지 순회
  const pages = Math.max(1, Math.ceil(NAVER_TRENDS.count / 20));
  const keywords = [];
  for (let page = 1; page <= pages; page++) {
    const body = new URLSearchParams({
      cid: String(NAVER_TRENDS.cid),
      timeUnit: 'date',
      startDate: ymd(start),
      endDate: ymd(end),
      age: '',
      gender: '',
      device: '',
      page: String(page),
      count: '20',
    });
    const r = await fetchWithRetry(NAVER_TRENDS.url, {
      method: 'POST',
      accept: 'application/json',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: NAVER_TRENDS.referer,
        Origin: NAVER_TRENDS.origin,
      },
      body: body.toString(),
    });
    if (!r.ok) throw new Error(`네이버 데이터랩 ${r.status}`);
    const j = await r.json();
    const rows = (Array.isArray(j?.ranks) ? j.ranks : [])
      .map((x) => ({ rank: Number(x.rank), keyword: String(x.keyword || '').trim() }))
      .filter((x) => x.keyword && Number.isFinite(x.rank));
    if (!rows.length) break;
    keywords.push(...rows);
    await new Promise((res) => setTimeout(res, 250));
  }
  if (!keywords.length) throw new Error('검색어 0건');

  return {
    updated: seoulDateKey(),
    category: NAVER_TRENDS.category,
    period: { start: ymd(start), end: ymd(end) },
    keywords,
  };
}
