# Fashion Dashboard — 로엠 T-45 생산 예측 대시보드

여성의류(로엠) 책임자용 대시보드. 매일 오전 8시(KST) 주요 온라인 플랫폼의 여성의류 랭킹을 수집하고,
시즌 리드타임(T-45) 관점의 **「떡상 후보」 예측 스냅샷**을 누적·비교한다.

## 데이터 파이프라인

매일 08:00 KST (`.github/workflows/daily-fetch.yml`, UTC 23:00 cron)에 `npm run fetch:live` 실행:

1. **플랫폼별 어댑터**(`scripts/platforms/<name>.mjs`)로 오늘 랭킹 수집
   - **무신사**: 공개 랭킹 API로 상품 목록 자체를 실시간 수집(진짜 랭킹).
   - **29CM**: display-bff-api 베스트 API(POST)로 여성의류 실시간 베스트 수집(진짜 랭킹, `data_source='29cm_best_api'`).
   - **지그재그·W컨셉**: 현재는 시드 고정 + PDP 메타(이름·이미지·가격) 갱신
     (`data_source='seed_pdp_refresh'`). 지그재그는 웹이 앱-게이트라 헤드리스/앱 GraphQL 필요(Phase 3).
2. `src/today_womens_rankings.json` ← 플랫폼별 오늘 랭킹
3. `src/historical_trends.json[오늘]` ← `scripts/lib/predictionSnapshot.mjs` 가 산출한 떡상 후보 스냅샷
4. 변경분을 봇이 커밋·푸시. 수집 실패/부분 실패 시 GitHub 이슈로 알림(`crawl-failure` 라벨).

## 데이터 투명성 (실측 vs 추정)

각 상품 행에는 데이터 출처 메타가 붙는다:

- `data_source` — `musinsa_ranking_api` | `seed_pdp_refresh`
- `metrics_estimated` — `true`면 보조지표가 합성(추정)값
- `estimated_fields` — 추정 필드 목록(`view_count`, `cart_count`, `cart_ratio`, `success_prob` 등)

**실측**: 랭킹 순위·상품명·브랜드·이미지·가격(무신사는 리뷰수 추가).
**추정**: 조회·장바구니·찜·성공확률·유사도 등 — UI에 "추정" 배지로 표기된다.

## 설정 한 곳에서

- `src/config.js` — **시즌**(헤더 문구·T-N·계절 키워드·가중)과 **플랫폼 목록**(활성/순서/어댑터).
  시즌이 바뀌면 `SEASON` 한 곳만 수정하면 화면·예측 가중·필터가 모두 따라간다.
- `scripts/crawlConfig.mjs` — 크롤 전용(무신사 카테고리 코드, PDP 지연 등). 프론트 번들에 포함 안 됨.

새 플랫폼 추가: `scripts/platforms/<name>.mjs` 작성 → `scripts/platforms/index.mjs` 등록 →
`src/config.js` `PLATFORMS` 에 `{ adapter, enabled: true }` 추가.

## 개발

```bash
npm install
npm run dev          # 로컬 개발 서버 (개발 모드에선 '크롤링/업데이트' 버튼이 fetch:live 실행)
npm run fetch:live   # 랭킹·히스토리 JSON 수동 갱신
npm run build        # 프로덕션 빌드
npm run lint
```

배포는 Vercel. 운영 환경에선 매일 자동 갱신되며, 화면의 "수동 실행: GitHub Actions" 링크로 즉시 갱신 가능.
`VITE_ACTIONS_URL` 로 Actions 링크를 덮어쓸 수 있다.

## 로드맵

- **Phase 1 (완료)**: 설정 중앙화·시즌 파라미터화, 실측/추정 분리 표기, fetch 견고화(타임아웃·재시도·격리·실패알림), 플랫폼 어댑터 구조화.
- **Phase 2**: 무신사 카테고리 확장(여성 핵심 카테고리), 지그재그 GraphQL 실연동.
- **Phase 3**: 29CM·W컨셉 랭킹 API 재탐색, 신규 플랫폼(에이블리·브랜디·퀸잇) 어댑터.

> 참고: `scripts/extend-seed-live-10.mjs`, `scripts/patch-historical-10-per-platform.mjs` 와
> `src/predicted_trends.json` 은 시드/히스토리 최초 구성용 **일회성 부트스트랩** 도구다(앱 런타임은 미사용).
