/**
 * 지그재그 어댑터. 현재: 시드 상품 PDP JSON-LD로 메타 갱신(가격 없으면 기존 유지).
 * Phase 2: api.zigzag.kr/api/store GraphQL 랭킹 쿼리로 진짜 목록 수집 예정.
 */
import { collectViaPdp, ESTIMATED_FIELDS } from './pdpRefresh.mjs';

export const platform = '지그재그';
export { ESTIMATED_FIELDS };

export async function collect({ seedRows }) {
  return collectViaPdp(seedRows, { platform, mode: 'jsonld' });
}
