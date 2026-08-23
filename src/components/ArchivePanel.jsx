/**
 * 누적 상품 아카이브 — 일별 스냅샷(historical_trends.json)에서 관측된 모든 상품을 상품 단위로 누적.
 * 상품별 첫 관측일·관측일수·최고순위·최근 관측일을 표시. 오늘 랭킹에 있으면 배지.
 */
const SORTS = [
  { key: 'recent', label: '최근 관측순' },
  { key: 'persistent', label: '관측일수순' },
  { key: 'first', label: '오래 추적순' },
];

export default function ArchivePanel({ items, totalCount, sort, onSort, todayUrls, onOpen, periodStart, periodEnd }) {
  if (!items || items.length === 0) {
    return (
      <p style={{ textAlign: 'center', marginTop: '40px', color: '#999' }}>
        누적된 상품이 없습니다. 매일 자동 수집이 쌓이면 여기에 누적 표시됩니다.
      </p>
    );
  }

  const norm = (u) => String(u || '').split('?')[0].split('#')[0];
  const CAP = 400;
  const shown = items.slice(0, CAP);

  return (
    <div style={{ padding: '4px 16px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 4px' }}>🗂️ 누적 상품 아카이브</h2>
          <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>
            누적 <strong>{totalCount.toLocaleString()}</strong>개 · {periodStart}~{periodEnd} 관측
            {items.length !== totalCount && <span> · 필터 {items.length.toLocaleString()}개</span>}
            {shown.length < items.length && <span> (상위 {CAP}개 표시)</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => onSort(s.key)}
              style={{
                padding: '5px 10px', borderRadius: '14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                border: sort === s.key ? '1px solid #111' : '1px solid #ddd',
                background: sort === s.key ? '#111' : '#fff', color: sort === s.key ? '#fff' : '#555',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '8px' }}>
        {shown.map((c) => {
          const r = c.row;
          const isToday = todayUrls.has(`${r.platform}|${norm(r.product_url)}`);
          return (
            <li key={`${r.platform}|${norm(r.product_url)}`}>
              <button
                type="button"
                onClick={() => onOpen(r)}
                style={{
                  display: 'flex', gap: '10px', width: '100%', textAlign: 'left', cursor: 'pointer',
                  padding: '8px', borderRadius: '10px', border: '1px solid #eee', background: '#fff', alignItems: 'center',
                }}
              >
                <img src={r.img_url} alt={r.name} loading="lazy" style={{ width: '52px', height: '68px', objectFit: 'cover', borderRadius: '6px', flex: '0 0 auto', background: '#f2f2f2' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#fff', background: '#555', padding: '1px 5px', borderRadius: '4px' }}>{r.platform}</span>
                    {isToday && <span style={{ fontSize: '10px', fontWeight: 800, color: '#16a34a' }}>● 오늘 랭킹중</span>}
                  </div>
                  <div style={{ fontSize: '11px', color: '#888', fontWeight: 600 }}>{r.brand}</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                  <div style={{ fontSize: '11px', color: '#999', marginTop: '3px' }}>
                    첫 관측 {c.firstSeen.slice(5)} · <strong style={{ color: '#333' }}>{c.daysSeen}일</strong> 관측 · 최고 <strong style={{ color: '#D32F2F' }}>{c.bestRank}위</strong>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
