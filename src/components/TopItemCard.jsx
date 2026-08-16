import './compact.css';
import { SEASON } from '../config.js';

export default function TopItemCard({ item, rank, onClick, showPredictionChrome = false }) {
  const { name, brand, platform, img_url, cart_ratio, production_alert, success_prob, prediction_hint, roem_copy_priority, metrics_estimated, data_source, prediction_momentum_score, prediction_velocity_delta, prediction_growth_pct } = item;

  const cardClassName = `top-item-card compact-card ${production_alert ? 'urgent-border' : ''}`;
  const tLabel = `T-${SEASON.tMinusDays}`;
  // 합성 보조지표는 '추정'임을 명시 (실측은 랭킹·이름·이미지·가격)
  const estTitle = metrics_estimated ? '추정 보조지표 (실측 아님)' : undefined;
  // 오늘 실제 랭킹을 실시간 수집했는지(실시간) vs 시드 고정+메타 갱신(참고)
  const isLiveRanking = data_source && data_source !== 'seed_pdp_refresh';

  return (
    <article className={cardClassName} onClick={onClick} style={{ cursor: 'pointer' }}>
      <div className="card-image-wrap">
        <div className="card-platform-badge">{platform}</div>
        <div
          className="card-source-badge"
          title={isLiveRanking ? '오늘 실제 랭킹을 실시간 수집' : '랭킹 미공개(앱전용/차단) — 시드 상품의 메타만 갱신한 참고용'}
          style={{
            position: 'absolute', top: '8px', right: '8px', zIndex: 2,
            padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: 700,
            backgroundColor: isLiveRanking ? 'rgba(22,163,74,0.92)' : 'rgba(120,120,120,0.85)',
            color: '#fff', letterSpacing: '0.2px',
          }}
        >
          {isLiveRanking ? '● 실시간' : '참고'}
        </div>
        {showPredictionChrome && (
          <div className="t45-pill" title={`약 ${SEASON.tMinusDays}일 뒤 시즌 대비 후보`}>
            {tLabel} 예측
          </div>
        )}
        {production_alert && (
          <div className="urgent-badge-compact">🚨 {tLabel}</div>
        )}
        <div className="card-rank compact-rank">{rank}</div>
        <img src={img_url} alt={`${brand} ${name}`} className="card-image" loading="lazy" />
      </div>

      <div className="card-content-compact">
        <div className="card-brand">{brand}</div>
        <h3 className="card-title-compact">{name}</h3>
        {showPredictionChrome && prediction_hint && (
          <p className="prediction-hint">{prediction_hint}</p>
        )}
        {showPredictionChrome && roem_copy_priority && (
          <span className="roem-priority-pill">로엠 카피 우선</span>
        )}
        <div className="compact-stats" title={estTitle}>
          {showPredictionChrome && prediction_momentum_score != null ? (
            <>
              <span className="prob-text" title="순위상승·관심급증·신상침투 조합 점수">🔥 떡상 {prediction_momentum_score}점</span>
              {prediction_velocity_delta > 0 ? (
                <span className="cr-text increase">순위 +{prediction_velocity_delta}↑</span>
              ) : prediction_growth_pct > 0 ? (
                <span className="cr-text increase">관심 +{prediction_growth_pct}%</span>
              ) : (
                <span className="cr-text" style={{ color: '#aaa' }}>추세 집계중</span>
              )}
            </>
          ) : (
            <>
              <span className="prob-text">{Math.round(success_prob)}점{metrics_estimated && <sup style={{ fontSize: '8px', color: '#999' }}>추정</sup>}</span>
              <span className="cr-text increase">CR {cart_ratio}%</span>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
