/**
 * 헤드리스 네트워크 수확(harvest) — Playwright로 페이지를 실제로 띄워,
 * 페이지가 스스로 호출하는 내부 API의 JSON 응답을 가로채 모은다.
 *
 * 내부 API 경로·페이로드(커서·서명 등)를 우리가 재현하지 않아도 되는 게 장점.
 * 앱-게이트/안티봇이 아닌, "그냥 CSR이라 fetch로는 빈 화면"인 사이트(퀸잇 등)에 적합.
 *
 * playwright는 devDependency라 lazy import. 미설치/실패 시 명확히 throw → 어댑터가 폴백 처리.
 */
import { DEFAULT_UA } from './http.mjs';

/**
 * @param {string} pageUrl 띄울 페이지
 * @param {object} opts
 * @param {RegExp} opts.match 가로챌 응답 URL 패턴
 * @param {string} [opts.ua]
 * @param {string} [opts.locale]
 * @param {number} [opts.waitMs] 초기 대기(기본 5000)
 * @param {boolean} [opts.scroll] 스크롤로 지연로딩 유도(기본 true)
 * @param {number} [opts.timeoutMs]
 * @returns {Promise<object[]>} 매칭된 응답들의 파싱된 JSON 배열
 */
export async function harvestJsonResponses(pageUrl, opts = {}) {
  const { match, ua = DEFAULT_UA, locale = 'ko-KR', waitMs = 5000, scroll = true, timeoutMs = 45000 } = opts;
  if (!(match instanceof RegExp)) throw new Error('harvest: opts.match(RegExp) 필요');

  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    throw new Error('playwright 미설치 (npm i -D playwright && npx playwright install chromium)');
  }

  const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
  try {
    const ctx = await browser.newContext({ userAgent: ua, locale, viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const captured = [];
    page.on('response', async (r) => {
      try {
        if (!match.test(r.url())) return;
        const ct = r.headers()['content-type'] || '';
        if (!ct.includes('json')) return;
        captured.push(JSON.parse(await r.text()));
      } catch {
        /* ignore non-JSON / read errors */
      }
    });
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForTimeout(waitMs);
    if (scroll) {
      await page.mouse.wheel(0, 3000);
      await page.waitForTimeout(2500);
    }
    return captured;
  } finally {
    await browser.close();
  }
}
