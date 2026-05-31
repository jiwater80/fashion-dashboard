/**
 * 어댑터 레지스트리 — src/config.js PLATFORMS[].adapter 값으로 모듈을 찾는다.
 * 새 플랫폼 추가: (1) 이 폴더에 <name>.mjs 어댑터 작성 → (2) 여기 등록 →
 *               (3) src/config.js PLATFORMS 에 { adapter:'<name>', enabled:true } 추가. 끝.
 */
import * as musinsa from './musinsa.mjs';
import * as cm29 from './29cm.mjs';
import * as zigzag from './zigzag.mjs';
import * as wconcept from './wconcept.mjs';
import * as queenit from './queenit.mjs';

const REGISTRY = {
  musinsa,
  '29cm': cm29,
  zigzag,
  wconcept,
  queenit,
  // 향후: ably, brandi
};

export function getAdapter(name) {
  return REGISTRY[name] || null;
}
