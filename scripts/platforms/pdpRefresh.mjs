/**
 * PDP 메타 갱신 어댑터 공용 로직.
 *
 * ⚠️ 한계: 29CM·지그재그·W컨셉은 아직 "오늘 랭킹 목록"을 실시간으로 못 가져온다.
 *   상품 구성·순위는 시드(seed)에 고정되어 있고, 여기서는 각 시드 상품의
 *   이름·이미지·가격만 PDP에서 새로고침한다. → data_source='seed_pdp_refresh'.
 *   진짜 랭킹 수집은 Phase 2/3에서 어댑터별 collect()를 교체할 예정.
 */

import { fetchHtml } from '../lib/http.mjs';
import { PDP_DELAY_MS } from '../crawlConfig.mjs';
import {
  isNonWomensApparel,
  extractLdJsonBlocks,
  findSchemaProduct,
  firstImageUrl,
  brandName,
  offerPrice,
  metaContent,
  parseWconceptDescription,
} from './shared.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 합성(추정) 보조지표 — 시드 행에 박혀 있던 가짜 수치들 */
export const ESTIMATED_FIELDS = [
  'base_wish',
  'brand_pop',
  'view_count',
  'cart_count',
  'competitor_avg_price',
  'cart_ratio',
  'success_prob',
  'seasonality_match',
];

function withTransparency(row) {
  return {
    ...row,
    data_source: 'seed_pdp_refresh',
    metrics_estimated: true,
    estimated_fields: ESTIMATED_FIELDS,
  };
}

async function refreshViaJsonLd(row, platform) {
  const { ok, text, status } = await fetchHtml(row.product_url);
  if (!ok) {
    console.warn(`[${platform}] PDP HTTP ${status}: ${row.product_url}`);
    return withTransparency(row);
  }
  const ld = findSchemaProduct(extractLdJsonBlocks(text));
  if (!ld) {
    console.warn(`[${platform}] No Product JSON-LD: ${row.product_url}`);
    return withTransparency(row);
  }
  const price = offerPrice(ld.offers);
  const img = firstImageUrl(ld.image);
  const name = ld.name ? String(ld.name) : row.name;
  const brand = brandName(ld.brand) || row.brand;
  const candidate = `${name} ${brand}`;
  if (isNonWomensApparel(candidate)) {
    console.warn(`[${platform}] 여성의류 외 → 메타 반영 생략: ${candidate.slice(0, 60)}`);
    return withTransparency(row);
  }
  return withTransparency({
    ...row,
    name,
    brand,
    price: price ?? row.price,
    img_url: img || row.img_url,
  });
}

async function refreshViaOg(row, platform) {
  const { ok, text, status } = await fetchHtml(row.product_url);
  if (!ok) {
    console.warn(`[${platform}] PDP HTTP ${status}: ${row.product_url}`);
    return withTransparency(row);
  }
  const parsed = parseWconceptDescription(metaContent(text, 'og:description'));
  const ogImg = metaContent(text, 'og:image');
  const name = parsed.name || row.name;
  const brand = parsed.brand || row.brand;
  const candidate = `${name} ${brand}`;
  if (isNonWomensApparel(candidate)) {
    console.warn(`[${platform}] 여성의류 외 → 메타 반영 생략: ${candidate.slice(0, 60)}`);
    return withTransparency(row);
  }
  return withTransparency({ ...row, name, brand, img_url: ogImg || row.img_url });
}

/**
 * 시드 행 배열을 받아 PDP 메타를 순차 갱신.
 * @param {object[]} seedRows  해당 플랫폼 시드 행 (platform_rank 정렬됨)
 * @param {{ platform: string, mode: 'jsonld'|'og' }} cfg
 */
export async function collectViaPdp(seedRows, { platform, mode }) {
  const out = [];
  for (const row of seedRows) {
    if (!row.product_url) {
      out.push(withTransparency(row));
      continue;
    }
    try {
      out.push(mode === 'og' ? await refreshViaOg(row, platform) : await refreshViaJsonLd(row, platform));
    } catch (e) {
      console.warn(`[${platform}] PDP 갱신 실패(시드 유지): ${e.message}`);
      out.push(withTransparency(row));
    }
    await sleep(PDP_DELAY_MS);
  }
  return out;
}
