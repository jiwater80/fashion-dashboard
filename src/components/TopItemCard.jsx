import './compact.css';
import { SEASON } from '../config.js';

export default function TopItemCard({ item, rank, onClick, showPredictionChrome = false }) {
  const { name, brand, platform, img_url, cart_ratio, production_alert, success_prob, prediction_hint, roem_copy_priority, metrics_estimated } = item;

  const cardClassName = `top-item-card compact-card ${production_alert ? 'urgent-border' : ''}`;
  const tLabel = `T-${SEASON.tMinusDays}`;
  // 합성 보조지표는 '추정'임을 명시 (실측은 랭킹·이름·이미지·가격)
  const estTitle = metrics_estimated ? '추정 보조지표 (실측 아님)' : undefined;

  return (
    <article className={cardClassName} onClick={onClick} style={{ cursor: 'pointer' }}>
      <div className="card-image-wrap">
        <div className="card-platform-badge">{platform}</div>
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
          <span className="prob-text">{Math.round(success_prob)}점{metrics_estimated && <sup style={{ fontSize: '8px', color: '#999' }}>추정</sup>}</span>
          <span className="cr-text increase">CR {cart_ratio}%</span>
        </div>
      </div>
    </article>
  );
}
