/**
 * 크롤 공용 HTTP 유틸 — 타임아웃·재시도·공통 UA.
 * 모든 어댑터가 이 래퍼를 쓰면 한 플랫폼이 느리거나 죽어도 전체가 멈추지 않는다.
 */

export const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/** @typedef {{ timeoutMs?: number, retries?: number, retryDelayMs?: number, headers?: Record<string,string>, accept?: string }} FetchOpts */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 타임아웃·재시도가 붙은 fetch. 4xx(429 제외)는 재시도하지 않음(영구 실패로 간주).
 * @param {string} url
 * @param {FetchOpts} [opts]
 * @returns {Promise<Response>}
 */
export async function fetchWithRetry(url, opts = {}) {
  const { timeoutMs = 12000, retries = 2, retryDelayMs = 600, headers = {}, accept, method = 'GET', body } = opts;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const r = await fetch(url, {
        method,
        ...(body != null ? { body } : {}),
        headers: { 'User-Agent': DEFAULT_UA, ...(accept ? { Accept: accept } : {}), ...headers },
        redirect: 'follow',
        signal: ac.signal,
      });
      clearTimeout(timer);
      // 4xx(429 제외)는 재시도 무의미 — 그대로 반환해 호출부가 판단
      if (!r.ok && r.status >= 400 && r.status < 500 && r.status !== 429) return r;
      if (!r.ok) {
        lastErr = new Error(`HTTP ${r.status}`);
        if (attempt < retries) {
          await sleep(retryDelayMs * (attempt + 1));
          continue;
        }
        return r;
      }
      return r;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (attempt < retries) await sleep(retryDelayMs * (attempt + 1));
    }
  }
  throw lastErr || new Error(`fetch failed: ${url}`);
}

/** HTML 텍스트로 받기 */
export async function fetchHtml(url, opts = {}) {
  const r = await fetchWithRetry(url, { accept: 'text/html,application/xhtml+xml', ...opts });
  return { ok: r.ok, status: r.status, text: await r.text() };
}

/** JSON으로 받기 (실패 시 throw) */
export async function fetchJson(url, opts = {}) {
  const r = await fetchWithRetry(url, { accept: 'application/json', ...opts });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);
  return r.json();
}

/**
 * JSON 바디로 POST 후 JSON 응답 (BFF/내부 API용). 실패 시 throw.
 * @param {string} url
 * @param {object} body  JSON 직렬화할 요청 바디
 * @param {FetchOpts & { origin?: string, referer?: string }} [opts]
 */
export async function fetchJsonPost(url, body, opts = {}) {
  const { origin, referer, headers = {}, ...rest } = opts;
  const r = await fetchWithRetry(url, {
    method: 'POST',
    accept: 'application/json',
    headers: {
      'Content-Type': 'application/json',
      ...(origin ? { Origin: origin } : {}),
      ...(referer ? { Referer: referer } : {}),
      ...headers,
    },
    body: JSON.stringify(body),
    ...rest,
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);
  return r.json();
}
