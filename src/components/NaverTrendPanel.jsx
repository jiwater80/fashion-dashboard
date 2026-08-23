/**
 * 네이버 데이터랩 여성의류 인기 검색어 패널.
 * historical_trends.json['naver_trends'] 데이터를 받아 순위·전일대비 변화(▲▼/NEW)와 함께 표시.
 * 검색어 클릭 시 네이버쇼핑 검색으로 이동(디렉터가 실제 상품 확인).
 */
export default function NaverTrendPanel({ data }) {
  if (!data || !Array.isArray(data.keywords) || data.keywords.length === 0) {
    return (
      <p style={{ textAlign: 'center', marginTop: '40px', color: '#999' }}>
        네이버 트렌드 데이터가 아직 없습니다. 다음 자동 갱신(매일 08:00 KST) 후 표시됩니다.
      </p>
    );
  }

  const { keywords, period, category, updated } = data;
  const coldStart = keywords.every((k) => k.prevRank == null);

  const deltaBadge = (k) => {
    if (coldStart) return null;
    if (k.prevRank == null) return <span style={{ color: '#1565C0', fontWeight: 800 }}>NEW</span>;
    if (k.delta > 0) return <span style={{ color: '#16a34a', fontWeight: 700 }}>▲{k.delta}</span>;
    if (k.delta < 0) return <span style={{ color: '#D32F2F', fontWeight: 700 }}>▼{-k.delta}</span>;
    return <span style={{ color: '#bbb' }}>–</span>;
  };

  return (
    <div style={{ padding: '4px 16px 24px' }}>
      <div style={{ marginBottom: '12px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 4px' }}>
          🔎 네이버 {category} 인기 검색어
        </h2>
        <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>
          네이버 데이터랩 쇼핑인사이트 · {period?.start}~{period?.end} 기준 · 갱신 {updated}
          {!coldStart && <span> · ▲▼는 전일 대비</span>}
        </p>
      </div>

      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '6px' }}>
        {keywords.map((k) => (
          <li key={k.rank}>
            <a
              href={`https://search.shopping.naver.com/search/all?query=${encodeURIComponent(k.keyword)}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 12px', borderRadius: '10px', border: '1px solid #eee',
                background: '#fff', textDecoration: 'none', color: '#222',
              }}
            >
              <span style={{ minWidth: '22px', textAlign: 'center', fontWeight: 800, color: k.rank <= 3 ? '#D32F2F' : '#999', fontSize: '14px' }}>
                {k.rank}
              </span>
              <span style={{ flex: 1, fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {k.keyword}
              </span>
              <span style={{ fontSize: '12px', minWidth: '34px', textAlign: 'right' }}>{deltaBadge(k)}</span>
            </a>
          </li>
        ))}
      </ol>

      <p style={{ fontSize: '11px', color: '#aaa', marginTop: '14px' }}>
        * 상품 랭킹이 아니라 <strong>검색 트렌드</strong>입니다. 검색어를 누르면 네이버쇼핑 검색결과로 이동합니다.
      </p>
    </div>
  );
}
