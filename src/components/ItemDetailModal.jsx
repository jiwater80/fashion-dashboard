import WeeklyTrendChart from './WeeklyTrendChart';
import { getProductRegistrationInfo, getTrendViewCartSeriesWithMeta, TREND_MAX_DAYS } from '../utils/itemAnalytics';

export default function ItemDetailModal({ item, onClose }) {
  if (!item) return null;
  const { name, brand, platform, tags = [], competitor_avg_price = 0, price = 0, ai_summary = [], key_details = [], cart_ratio = 0, view_count = 0, cart_count = 0, seasonality_match = 0, is_preorder = false, production_alert = false } = item;

  const regInfo = getProductRegistrationInfo(item);
  const { series: trendSeries, meta: trendMeta } = getTrendViewCartSeriesWithMeta(item);
  const trendViewsSum = trendSeries.reduce((a, s) => a + s.views, 0);
  const trendCartSum = trendSeries.reduce((a, s) => a + s.cart, 0);

  const priceDiff = competitor_avg_price - price;
  const isCheaper = priceDiff > 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>
        
        <div className="modal-header">
          <p className="modal-brand">{brand}</p>
          <h2 className="modal-title">{name}</h2>
          <p className="modal-meta-row">
            <span className="modal-meta-label">최초 등록일</span>
            <span className="modal-meta-value">
              {regInfo ? regInfo.display : '—'}
            </span>
            {regInfo?.hint && <span className="modal-meta-hint">({regInfo.hint})</span>}
          </p>
          {!regInfo && (
            <p className="modal-meta-fallback">
              JSON에 <code>product_registered_at</code>(YYYY-MM-DD)를 넣거나, 29CM·무신사 등 썸네일 URL에 포함된 날짜로 추정합니다.
            </p>
          )}
          {production_alert && <div className="urgent-badge-inline">🚨 리드타임(T-45) 대응 요망 모델</div>}
        </div>

        <div className="modal-section alert-section">
          <h3 className="section-title">🔍 [잠복기 시그널] 종합 분석</h3>
          <div className="signal-data" style={{display: 'flex', gap: '12px', justifyContent: 'space-between', marginBottom: '12px'}}>
             <div className="signal-item" style={{background: '#F9F9FB', padding: '12px', borderRadius: '8px', flex: 1}}>
               <span style={{fontSize:'11px', color:'#666', display:'block', marginBottom: '4px'}}>장바구니 담기(CR)</span>
               <strong style={{fontSize:'16px', color: '#D32F2F'}}>{cart_ratio}%</strong>
             </div>
             <div className="signal-item" style={{background: '#F9F9FB', padding: '12px', borderRadius: '8px', flex: 1}}>
               <span style={{fontSize:'11px', color:'#666', display:'block', marginBottom: '4px'}}>작년 5월 유사도</span>
               <strong style={{fontSize:'16px'}}>{seasonality_match}%</strong>
             </div>
             <div className="signal-item" style={{background: '#F9F9FB', padding: '12px', borderRadius: '8px', flex: 1}}>
                 <span style={{fontSize:'11px', color:'#666', display:'block', marginBottom: '4px'}}>경쟁사 예약판매</span>
                 <strong style={{fontSize:'14px', color: is_preorder ? '#D32F2F' : '#333'}}>{is_preorder ? "확인됨" : "없음"}</strong>
             </div>
          </div>
          <div className="trend-chart-head">
            <h4 className="trend-chart-title">
              {regInfo ? '등록일 ~ 오늘 조회·장바구니' : `최근 ${trendMeta.dayCount}일 조회·장바구니`}
            </h4>
            <div className="trend-chart-legend" aria-hidden>
              <span className="trend-legend-views">조회</span>
              <span className="trend-legend-cart">장바구니</span>
            </div>
          </div>
          {trendMeta.rangeTruncated && (
            <p className="trend-chart-truncate-note">
              등록 후 {trendMeta.fullSpanDays}일이 지나 <strong>최근 {TREND_MAX_DAYS}일</strong>만 표시합니다.
            </p>
          )}
          <div className="trend-chart-box">
            <WeeklyTrendChart series={trendSeries} />
          </div>
          <p className="trend-chart-foot">
            * 표시 구간 합계: 조회 {trendViewsSum.toLocaleString()}회 · 장바구니 {trendCartSum.toLocaleString()}회
            {trendMeta.usedCustom
              ? ' (JSON trend_stats / weekly_stats)'
              : ' · 일별 값은 조회·장바구니를 각각 다른 패턴으로 나눈 추정치(합계는 카드 메트릭과 동일)'}
            {!trendMeta.usedCustom && !regInfo && ` · 등록일을 알 수 없어 최근 ${trendMeta.dayCount}일 구간을 사용했습니다.`}
          </p>
          <p className="trend-chart-ref-note">
            참고: 카드 상단 메트릭 조회 {view_count.toLocaleString()}회 / 장바구니 {cart_count.toLocaleString()}회
            {view_count > 0 && cart_count >= 0 && (
              <> · 조회 대비 장바구니 약 {(view_count / Math.max(cart_count, 1)).toFixed(1)}배</>
            )}
          </p>
        </div>
        
        <div className="modal-section">
          <h3 className="section-title">✂️ T-45 유사 시즌 핵심 디자인 디테일 추출</h3>
          <div className="tags-container">
            {key_details.map((detail, idx) => (
              <span key={idx} className="tag detail-tag" style={{background: 'rgba(210, 180, 140, 0.2)', color: '#8c6d46', fontWeight: 600}}>{detail}</span>
            ))}
          </div>
        </div>
        
        <div className="modal-section">
          <h3 className="section-title">📊 가격 경쟁력 분석</h3>
          <div className="price-analysis">
            <div className="price-row">
              <span className="price-label">경쟁 브랜드 평균가</span>
              <span className="price-muted">{competitor_avg_price.toLocaleString()}원</span>
            </div>
            <div className="price-row highlight">
              <span className="price-label">이 상품 가격</span>
              <span className="price-main">{price.toLocaleString()}원</span>
            </div>
            <div className="price-bar-wrap">
               <div className="price-bar bg"></div>
               <div className="price-bar fill" style={{ width: `${Math.min(100, (price / (competitor_avg_price||price||1)) * 100)}%` }}></div>
            </div>
            {isCheaper && (
              <p className="price-insight">경쟁사 타겟 상품 대비 <strong>{priceDiff.toLocaleString()}원</strong> 유리!</p>
            )}
          </div>
        </div>
        
        <div className="modal-section ai-section">
          <h3 className="section-title">🤖 AI 생산 기획 조언</h3>
          <ul className="ai-summary">
            {ai_summary.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        </div>
        
        {item.product_url && (
          <div className="modal-section" style={{marginTop: '16px'}}>
            <a 
              href={item.product_url} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="external-link-btn"
              style={{
                display: 'block',
                width: '100%',
                padding: '12px',
                textAlign: 'center',
                backgroundColor: '#111',
                color: '#fff',
                textDecoration: 'none',
                fontWeight: '600',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            >
              해당 상품 실제 상세 판매 페이지로 이동 ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
