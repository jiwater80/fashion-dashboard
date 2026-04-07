/**
 * 플랫폼별 10행 구성 — product_url(쿼리 제외) 기준 중복 금지.
 * node scripts/extend-seed-live-10.mjs
 * node scripts/extend-seed-live-10.mjs src/today_womens_rankings.json
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = join(__dirname, 'seed-today_womens_rankings.json');
const PRED = join(__dirname, '..', 'src', 'predicted_trends.json');
const TARGET = 10;

const ORDER = ['29CM', '무신사', '지그재그', 'W컨셉'];

function normalizePdpUrl(u) {
  if (!u || typeof u !== 'string') return '';
  return u.split('?')[0].split('#')[0];
}

function normalizeImgKey(u) {
  if (!u || typeof u !== 'string') return '';
  return u.split('?')[0].split('#')[0];
}

function slugFor(platform) {
  if (platform === '29CM') return '29cm';
  if (platform === '무신사') return 'ms';
  if (platform === '지그재그') return 'zz';
  return 'wc';
}

/** 히스토리/수동 정의 → 오늘 랭킹 시드 형태 */
function liveShell(platform, partial, rank) {
  const slug = slugFor(platform);
  const bw = Math.min(12000, Math.max(800, partial.base_wish_hint ?? 4200));
  return {
    id: `rank_today_${slug}_${rank}`,
    platform_rank: rank,
    name: partial.name,
    brand: partial.brand,
    platform,
    price: partial.price ?? 99000,
    img_url: partial.img_url || '',
    product_url: normalizePdpUrl(partial.product_url),
    base_wish: bw,
    brand_pop: partial.brand_pop ?? 85,
    view_count: partial.view_count ?? Math.min(55000, bw * 5),
    cart_count: partial.cart_count ?? Math.max(600, Math.round(bw * 0.35)),
    is_preorder: false,
    seasonality_match: partial.seasonality_match ?? 91,
    competitor_avg_price: partial.competitor_avg_price ?? Math.round((partial.price ?? 99000) * 1.18),
    tags: partial.tags ?? ['#여성의류', `#${platform}`, '#오늘랭킹'],
    key_details: partial.key_details ?? [`${platform} PDP 연동`],
    ai_summary: partial.ai_summary ?? ['fetch:live로 갱신'],
    cart_ratio: Number((partial.cart_ratio ?? 7.2).toFixed(1)),
    success_prob: partial.success_prob ?? 92,
    production_alert: partial.production_alert ?? false,
    gender: 'women',
    audience: 'adult',
  };
}

function predictedToPartial(p) {
  return {
    name: p.name,
    brand: p.brand,
    price: p.price,
    img_url: p.img_url,
    product_url: p.product_url,
    base_wish_hint: Math.min(12000, Math.round((p.base_wish || 200) * 35)),
    brand_pop: p.brand_pop,
    view_count: p.view_count,
    cart_count: p.cart_count,
    seasonality_match: p.seasonality_match,
    competitor_avg_price: p.competitor_avg_price,
    cart_ratio: p.cart_ratio,
    success_prob: p.success_prob,
    tags: ['#여성의류', '#29CM', '#오늘랭킹'],
    key_details: ['29CM PDP 연동'],
  };
}

/** 29CM: 예측 풀 이후 부족분 (히스토리 실제 PDP) */
const EXTRA_29CM = [
  {
    name: 'SATIN DOT SLEEVELESS DRESS_BLACK',
    brand: '튜드먼트',
    price: 143910,
    img_url: 'https://img.29cm.co.kr/item/202602/11f0fff74d29914ca54041fdc3ab4270.jpg',
    product_url: 'https://product.29cm.co.kr/catalog/3730172',
    base_wish_hint: 4980,
    cart_ratio: 7.7,
  },
  {
    name: 'Classic Western Shirt',
    brand: '톨로',
    price: 129000,
    img_url: 'https://img.29cm.co.kr/item/202604/11f12f2627e5a4f89ec5e37115fe5019.jpg',
    product_url: 'https://product.29cm.co.kr/catalog/3904809',
    base_wish_hint: 2100,
    cart_ratio: 6.9,
  },
  {
    name: 'OYO SWEATSHIRTS (NEON GREEN)',
    brand: '컬렉트 피시스',
    price: 139000,
    img_url: 'https://img.29cm.co.kr/item/202604/11f12dba47dae287a4d90774e21fe2eb.jpg',
    product_url: 'https://product.29cm.co.kr/catalog/3901840',
    base_wish_hint: 5050,
    cart_ratio: 7.8,
  },
];

/** 무신사: 랭킹 시드와 겹치지 않는 PDP (히스토리·기존 스냅샷) */
const EXTRA_MUSINSA = [
  {
    name: '아이비리그 홀터넥 슬리브리스 (WHITE)',
    brand: '미학',
    price: 39000,
    img_url: 'https://image.msscdn.net/images/goods_img/20260313/6127828/6127828_17733667592778_500.jpg',
    product_url: 'https://www.musinsa.com/products/6127828',
    base_wish_hint: 8600,
    key_details: ['무신사 여성 랭킹 보조 풀', '실제 PDP'],
  },
  {
    name: '우먼즈 폴카 도트 슬리브리스 탑 [아이보리]',
    brand: '무신사 스탠다드 우먼',
    price: 18910,
    img_url: 'https://image.msscdn.net/images/goods_img/20251106/5695806/5695806_17726067213455_500.jpg',
    product_url: 'https://www.musinsa.com/products/5695806',
    base_wish_hint: 6200,
  },
  {
    name: '송이송이X탄산 로고 베이직 슬리브리스 (스트라이프 그레이)',
    brand: '탄산마그네슘',
    price: 29640,
    img_url: 'https://image.msscdn.net/images/goods_img/20260310/6110832/6110832_17739042207931_500.jpg',
    product_url: 'https://www.musinsa.com/products/6110832',
    base_wish_hint: 3200,
  },
  {
    name: 'CS TOP LACE BRA TOP-005 (BLACK)',
    brand: '쿨시스',
    price: 49000,
    img_url: 'https://image.msscdn.net/images/goods_img/20260316/6136770/6136770_17739201106712_500.jpg',
    product_url: 'https://www.musinsa.com/products/6136770',
    base_wish_hint: 11100,
    key_details: ['무신사 여성 랭킹(민소매 티·실시간) 시드', 'api.musinsa.com 스냅샷'],
  },
  {
    name: '[2 PACK] 백 디테일 시그니처 슬리브리스 나시 (6컬러)',
    brand: '무센트',
    price: 35910,
    img_url: 'https://image.msscdn.net/images/goods_img/20260323/6174653/6174653_17742380161161_500.jpg',
    product_url: 'https://www.musinsa.com/products/6174653',
    base_wish_hint: 10200,
  },
  {
    name: '베이직 2WAY 나시 블라우스 RMBNG24R02',
    brand: '로엠',
    price: 26910,
    img_url: 'https://image.msscdn.net/images/goods_img/20260309/6100044/6100044_17737957437676_500.jpg',
    product_url: 'https://www.musinsa.com/products/6100044',
    base_wish_hint: 9300,
  },
  {
    name: '스터드 언발란스 스트랩 소프트 나시 레이어드 슬리브리스_3COLOR',
    brand: '플레이스 스튜디오',
    price: 21400,
    img_url: 'https://image.msscdn.net/images/goods_img/20260219/6028336/6028336_17714635489413_500.jpg',
    product_url: 'https://www.musinsa.com/products/6028336',
    base_wish_hint: 4000,
  },
  {
    name: 'LOGO CROSS SLEEVELESS TOP / BLACK',
    brand: '셋업이엑스이',
    price: 52000,
    img_url: 'https://image.msscdn.net/images/goods_img/20260122/5927025/5927025_17707819952333_500.jpg',
    product_url: 'https://www.musinsa.com/products/5927025',
    base_wish_hint: 4000,
  },
  {
    name: 'Lace Layered Cami Set (BLACK)',
    brand: '낫노잉',
    price: 72000,
    img_url: 'https://image.msscdn.net/images/goods_img/20260220/6034632/6034632_17715573735035_500.jpeg',
    product_url: 'https://www.musinsa.com/products/6034632',
    base_wish_hint: 10200,
  },
  {
    name: 'Lace Layered Cami Set (CHACOAL)',
    brand: '낫노잉',
    price: 72000,
    img_url: 'https://image.msscdn.net/images/goods_img/20260220/6034622/6034622_17715572596690_500.jpeg',
    product_url: 'https://www.musinsa.com/products/6034622',
    base_wish_hint: 9300,
  },
  {
    name: 'Nessa Lace Top Gray',
    brand: '카시코',
    price: 61000,
    img_url: 'https://image.msscdn.net/images/goods_img/20260305/6084268/6084268_17737938408722_500.jpg',
    product_url: 'https://www.musinsa.com/products/6084268',
    base_wish_hint: 3200,
  },
  {
    name: 'Lua Garter Lace Halter Sleeveless Top (White)',
    brand: '플리즈노팔로우',
    price: 52000,
    img_url: 'https://image.msscdn.net/images/goods_img/20260227/6067804/6067804_17734053586948_500.jpg',
    product_url: 'https://www.musinsa.com/products/6067804',
    base_wish_hint: 3600,
  },
];

/** 지그재그: 기존 5종 외 여성의류 PDP (공개 카탈로그 URL) */
const EXTRA_ZIGZAG = [
  {
    name: '옷자락 여자 체크치마 키작녀 슬렌더 스판 가을하객 스커트',
    brand: '옷자락',
    price: 34500,
    img_url:
      'https://cf.product-image.s.zigzag.kr/original/d/2024/10/14/13470_202410141800050653_24742.jpeg?width=720&height=720&quality=80&format=jpeg',
    product_url: 'https://zigzag.kr/catalog/products/128956240',
    base_wish_hint: 5200,
  },
  {
    name: '모드밍코 망고 반팔 A라인 허리묶음 롱 원피스 (2-color)',
    brand: '모드밍코',
    price: 35800,
    img_url:
      'https://cf.product-image.s.zigzag.kr/original/c/11/158/359/111583599-7447708450844753712.jpeg?width=720&height=720&quality=80&format=jpeg',
    product_url: 'https://zigzag.kr/catalog/products/111583599',
    base_wish_hint: 4800,
  },
  {
    name: '시크온미 여자 검정 크롭티 크롭탑 슬림핏',
    brand: '시크온미',
    price: 20900,
    img_url:
      'https://cf.product-image.s.zigzag.kr/original/d/2024/7/12/27110_202407121812070734_35049.jpeg?width=720&height=720&quality=80&format=jpeg',
    product_url: 'https://zigzag.kr/catalog/products/125388889',
    base_wish_hint: 4100,
  },
  {
    name: 'OOOO 데일리 롱 원피스',
    brand: 'OOOO',
    price: 52420,
    img_url:
      'https://cf.product-image.s.zigzag.kr/original/c/13/947/114/139471140-9134547007039826318.jpeg?width=720&height=720&quality=80&format=jpeg',
    product_url: 'https://zigzag.kr/catalog/products/139471140',
    base_wish_hint: 5500,
  },
  {
    name: '월드패왕 목폴라 슬림 골지 롱 원피스',
    brand: '월드패왕',
    price: 36400,
    img_url:
      'https://cf.product-image.s.zigzag.kr/original/d/2023/5/5/28623_202305052358110968_26959.jpeg?width=720&height=720&quality=80&format=jpeg',
    product_url: 'https://zigzag.kr/catalog/products/123492136',
    base_wish_hint: 4900,
  },
];

/** W컨셉: 기존 5종 외 여성의류 PDP */
const EXTRA_WCONCEPT = [
  {
    name: '여성 셔츠 (시드 확장)',
    brand: 'W컨셉',
    price: 150000,
    img_url: 'https://product-image.wconcept.co.kr/productimg/image/img2/10/301840410_GL13634.jpg',
    product_url: 'https://www.wconcept.co.kr/Product/300950849',
    base_wish_hint: 4200,
  },
  {
    name: '트렌치 코트 (시드 확장)',
    brand: 'W컨셉',
    price: 290000,
    img_url: 'https://product-image.wconcept.co.kr/productimg/image/img2/08/302745408_DJ17536.jpg',
    product_url: 'https://www.wconcept.co.kr/Product/300732155',
    base_wish_hint: 3800,
  },
  {
    name: '원피스 (시드 확장)',
    brand: 'W컨셉',
    price: 205000,
    img_url: 'https://product-image.wconcept.co.kr/productimg/image/img2/34/300479334.jpg',
    product_url: 'https://www.wconcept.co.kr/Product/303001269',
    base_wish_hint: 4500,
  },
  {
    name: '아우터 (시드 확장)',
    brand: 'W컨셉',
    price: 178000,
    img_url: 'https://product-image.wconcept.co.kr/productimg/image/img2/53/303813953_HA71709.jpg',
    product_url: 'https://www.wconcept.co.kr/Product/305810748',
    base_wish_hint: 3600,
  },
  {
    name: '니트 (시드 확장)',
    brand: 'W컨셉',
    price: 89000,
    img_url: 'https://product-image.wconcept.co.kr/productimg/image/img2/52/306131252_SV60837.jpg',
    product_url: 'https://www.wconcept.co.kr/Product/306143637',
    base_wish_hint: 3400,
  },
];

function buildCandidateQueue(platform, predicted) {
  if (platform === '29CM') {
    const q = [];
    for (const p of predicted) {
      if (p.platform === '29CM') q.push(predictedToPartial(p));
    }
    for (const e of EXTRA_29CM) q.push({ ...e, tags: ['#여성의류', '#29CM', '#오늘랭킹'], key_details: ['29CM PDP 연동'] });
    return q;
  }
  if (platform === '무신사') {
    return EXTRA_MUSINSA.map((e) => ({
      ...e,
      tags: ['#여성의류', '#무신사', '#오늘랭킹'],
      key_details: e.key_details ?? ['무신사 PDP 연동'],
      ai_summary: ['공개 랭킹 API 기준 스냅샷입니다.', '찜·조회·장바구니 수치는 보조 지표입니다.'],
    }));
  }
  if (platform === '지그재그') {
    return EXTRA_ZIGZAG.map((e) => ({
      ...e,
      tags: ['#여성의류', '#지그재그', '#오늘랭킹'],
      key_details: ['지그재그 PDP 연동'],
    }));
  }
  return EXTRA_WCONCEPT.map((e) => ({
    ...e,
    tags: ['#여성의류', '#W컨셉', '#오늘랭킹'],
    key_details: ['W컨셉 PDP 연동'],
    ai_summary: ['fetch:live로 og 메타 갱신'],
  }));
}

function scaleRowForRank(row, rank) {
  const copy = JSON.parse(JSON.stringify(row));
  const decay = (rank - 1) * 0.055;
  copy.base_wish = Math.max(800, Math.round(copy.base_wish * (1 - decay)));
  copy.view_count = Math.max(12000, Math.round(copy.view_count * (1 - decay * 1.1)));
  copy.cart_count = Math.max(600, Math.round(copy.cart_count * (1 - decay * 1.05)));
  copy.brand_pop = Math.max(72, Math.min(94, copy.brand_pop - Math.floor((rank - 1) * 0.65)));
  copy.cart_ratio = Number(Math.max(5.8, (copy.cart_ratio ?? 7.2) - (rank - 1) * 0.07).toFixed(1));
  copy.success_prob = Math.max(82, Math.min(97, (copy.success_prob ?? 90) - (rank - 1)));
  if (copy.platform === '무신사' && copy.key_details?.[0]?.includes('위')) {
    copy.key_details = [`무신사 여성 랭킹(민소매 티·실시간) ${rank}위`, 'api.musinsa.com 스냅샷'];
  }
  return copy;
}

function buildPlatformRows(platform, initialRows, predicted) {
  const sorted = [...initialRows].sort((a, b) => a.platform_rank - b.platform_rank);
  const used = new Set();
  const picked = [];
  const usedImg = platform === '지그재그' ? new Set() : null;

  for (const r of sorted) {
    const k = normalizePdpUrl(r.product_url);
    if (!k || used.has(k)) continue;
    if (usedImg) {
      const ik = normalizeImgKey(r.img_url);
      if (ik && usedImg.has(ik)) continue;
    }
    used.add(k);
    if (usedImg && r.img_url) usedImg.add(normalizeImgKey(r.img_url));
    picked.push(JSON.parse(JSON.stringify(r)));
  }

  const queue = buildCandidateQueue(platform, predicted);
  for (const partial of queue) {
    if (picked.length >= TARGET) break;
    const k = normalizePdpUrl(partial.product_url);
    if (!k || used.has(k)) continue;
    if (usedImg) {
      const ik = normalizeImgKey(partial.img_url);
      if (ik && usedImg.has(ik)) continue;
    }
    used.add(k);
    if (usedImg && partial.img_url) usedImg.add(normalizeImgKey(partial.img_url));
    picked.push(liveShell(platform, partial, picked.length + 1));
  }

  if (picked.length < TARGET) {
    throw new Error(
      `[extend-seed-live-10] ${platform}: unique PDP ${picked.length}개뿐입니다 (목표 ${TARGET}). 후보 풀을 늘려 주세요.`,
    );
  }

  const out = picked.slice(0, TARGET).map((row, i) => {
    const rank = i + 1;
    const slug = slugFor(platform);
    const scaled = scaleRowForRank(row, rank);
    scaled.id = `rank_today_${slug}_${rank}`;
    scaled.platform_rank = rank;
    return scaled;
  });

  return out;
}

function main() {
  const outPath = process.argv[2] ? join(__dirname, '..', process.argv[2]) : DEFAULT_OUT;
  const data = JSON.parse(readFileSync(outPath, 'utf8'));
  const predicted = JSON.parse(readFileSync(PRED, 'utf8'));

  const out = [];
  for (const p of ORDER) {
    const rows = data.filter((x) => x.platform === p);
    out.push(...buildPlatformRows(p, rows, predicted));
  }

  writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log('Wrote', out.length, 'rows (deduped URLs) →', outPath);
}

main();
