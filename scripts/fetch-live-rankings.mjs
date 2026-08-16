/**
 * 매일 오전 8시(KST) 여성의류 플랫폼 랭킹 스냅샷 갱신 오케스트레이터.
 *
 * 구조: src/config.js(PLATFORMS) → scripts/platforms/<adapter>.mjs(어댑터) 순회.
 *  - today_womens_rankings.json = 플랫폼별 오늘 랭킹.
 *      · 무신사: 공개 랭킹 API로 목록 자체를 실시간 수집(진짜 랭킹).
 *      · 29CM/지그재그/W컨셉: 아직 시드 고정 + PDP 메타 갱신(data_source='seed_pdp_refresh').
 *  - historical_trends.json[오늘] = predictionSnapshot 으로 「떡상 후보」 산출.
 *
 * 견고화: 플랫폼별 try/catch 격리(한 곳 실패가 전체를 막지 않음), fetch 타임아웃·재시도(lib/http),
 *        실행 끝에 성공/실패 요약 출력. 실패 플랫폼은 직전 JSON 값을 유지한다.
 */

import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { seoulDateKey } from '../src/utils/seoulDateKey.js';
import { PLATFORMS, ITEMS_PER_PLATFORM } from '../src/config.js';
import { MAX_HISTORY_SNAPSHOTS } from './crawlConfig.mjs';
import { getAdapter } from './platforms/index.mjs';
import { fetchNewArrivalRows } from './fetch-new-arrivals.mjs';
import {
  buildPredictionSnapshotFromRanking,
  mergeRankingPoolWithNewArrivals,
} from './lib/predictionSnapshot.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'src', 'today_womens_rankings.json');
const HISTORICAL = join(ROOT, 'src', 'historical_trends.json');
const SEED = join(__dirname, 'seed-today_womens_rankings.json');

const activePlatforms = PLATFORMS.filter((p) => p.enabled).sort((a, b) => a.order - b.order);

function ensureRankingFile() {
  if (existsSync(OUT)) return;
  if (existsSync(SEED)) {
    copyFileSync(SEED, OUT);
    console.error(`today_womens_rankings.json 이 없어 시드로 복사 후 갱신합니다.\n  → ${OUT}`);
  } else {
    console.error(`파일이 없습니다: ${OUT}\nscripts/seed-today_womens_rankings.json 을 복구하세요.`);
    process.exit(1);
  }
}

async function collectPlatform(p, prevData) {
  const adapter = getAdapter(p.adapter);
  if (!adapter || typeof adapter.collect !== 'function') {
    throw new Error(`어댑터 없음: ${p.adapter}`);
  }
  const seedRows = prevData
    .filter((r) => r.platform === p.key)
    .sort((a, b) => a.platform_rank - b.platform_rank);
  const rows = await adapter.collect({ seedRows, itemsPerPlatform: ITEMS_PER_PLATFORM });
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('수집 결과 0건');
  }
  return rows.sort((a, b) => a.platform_rank - b.platform_rank);
}

async function main() {
  ensureRankingFile();
  const prevData = JSON.parse(readFileSync(OUT, 'utf8'));

  const final = [];
  const summary = [];
  for (const p of activePlatforms) {
    try {
      const rows = await collectPlatform(p, prevData);
      final.push(...rows);
      summary.push({ platform: p.key, ok: true, count: rows.length });
    } catch (e) {
      // 실패 시 직전 JSON 값 유지 (조용히 비우지 않음)
      const kept = prevData
        .filter((r) => r.platform === p.key)
        .sort((a, b) => a.platform_rank - b.platform_rank);
      final.push(...kept);
      summary.push({ platform: p.key, ok: false, count: kept.length, error: e.message });
      console.warn(`⚠️  [${p.key}] 수집 실패 → 직전 데이터 ${kept.length}건 유지: ${e.message}`);
    }
  }

  writeFileSync(OUT, JSON.stringify(final, null, 2) + '\n', 'utf8');
  console.log('Updated', OUT);

  // ---- 떡상 후보 예측 스냅샷 (historical) ----
  const dayKey = seoulDateKey();
  let historical = {};
  if (existsSync(HISTORICAL)) {
    try {
      const parsed = JSON.parse(readFileSync(HISTORICAL, 'utf8'));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) historical = parsed;
    } catch (e) {
      console.warn('historical_trends.json 파싱 실패, 새로 만듭니다.', e.message);
    }
  }

  let newArrivalRows = [];
  try {
    newArrivalRows = await fetchNewArrivalRows();
  } catch (e) {
    console.warn('fetch-new-arrivals 실패(무시하고 랭킹 풀만 사용):', e.message);
  }
  const mergedPool = mergeRankingPoolWithNewArrivals(final, newArrivalRows);
  historical[dayKey] = buildPredictionSnapshotFromRanking(mergedPool, {
    itemsPerPlatform: ITEMS_PER_PLATFORM,
    history: historical, // 과거 스냅샷 대조 → 순위 상승속도·관심 급증 계산
    todayKey: dayKey,
  });

  const sortedKeys = Object.keys(historical)
    .sort((a, b) => new Date(b.replace(/\./g, '-')) - new Date(a.replace(/\./g, '-')))
    .slice(0, MAX_HISTORY_SNAPSHOTS); // 오래된 스냅샷은 보존 한도까지만 유지
  const ordered = {};
  for (const k of sortedKeys) ordered[k] = historical[k];
  writeFileSync(HISTORICAL, JSON.stringify(ordered, null, 2) + '\n', 'utf8');
  console.log('Historical snapshot:', dayKey, '→', HISTORICAL);

  // ---- 실행 요약 ----
  console.log('\n=== 수집 요약 ===');
  for (const s of summary) {
    console.log(`  ${s.ok ? '✅' : '❌'} ${s.platform}: ${s.count}건${s.error ? ` (${s.error})` : ''}`);
  }
  const failed = summary.filter((s) => !s.ok);
  if (failed.length) {
    console.error(`\n${failed.length}개 플랫폼 수집 실패: ${failed.map((s) => s.platform).join(', ')}`);
    process.exitCode = 2; // CI가 부분 실패를 감지하도록(파일은 이미 저장됨)
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
