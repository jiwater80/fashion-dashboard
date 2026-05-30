/**
 * W컨셉 어댑터. 현재: 시드 상품 PDP og:description/og:image로 메타 갱신(가격은 기존 유지).
 * Phase 3: W컨셉 랭킹 목록 API 재탐색 후 진짜 수집으로 교체 예정(/best 구조 변경됨).
 */
import { collectViaPdp, ESTIMATED_FIELDS } from './pdpRefresh.mjs';

export const platform = 'W컨셉';
export { ESTIMATED_FIELDS };

export async function collect({ seedRows }) {
  return collectViaPdp(seedRows, { platform, mode: 'og' });
}
