import { useEffect, useMemo, useState } from 'react';
import TopItemCard from './components/TopItemCard';
import ItemDetailModal from './components/ItemDetailModal';
import { seoulDateKey, seoulOneMonthAgoDateKey } from './utils/seoulDateKey.js';
// 과거 배열 대신 전체 히스토리 객체를 로드
import historicalData from './historical_trends.json';
import todayWomensRankings from './today_womens_rankings.json';
import './index.css';

const LIVE_TAB = 'live';
const PLATFORM_FILTERS = [
  { key: 'all', label: '전체' },
  { key: '29CM', label: '29CM' },
  { key: '무신사', label: '무신사' },
  { key: '지그재그', label: '지그재그' },
  { key: 'W컨셉', label: 'W컨셉' },
];

function dedupeByProductUrl(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const u = (row.product_url || '').split('?')[0].split('#')[0];
    const key = `${row.platform}|${u}`;
    if (!u || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function App() {
  const [selectedItem, setSelectedItem] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState('');
  const isDevRuntime = import.meta.env.DEV;
  const actionsUrl =
    import.meta.env.VITE_ACTIONS_URL || 'https://github.com/<owner>/<repo>/actions/workflows/daily-fetch.yml';
  const todayKey = seoulDateKey();
  const monthAgoKey = seoulOneMonthAgoDateKey();

  /** 오늘 스냅샷(매일 fetch로 누적) + 한 달 전 같은 날 스냅샷만 — 정확도 피드백용 2탭 */
  const predictionTabs = useMemo(() => {
    const tabs = [{ key: todayKey, label: `${todayKey} 떡상 예측` }];
    if (monthAgoKey !== todayKey) {
      tabs.push({ key: monthAgoKey, label: `한달 전 (${monthAgoKey}) 떡상 예측` });
    }
    return tabs;
  }, [todayKey, monthAgoKey]);

  const [activeTab, setActiveTab] = useState(todayKey);
  const [livePlatform, setLivePlatform] = useState('all');

  const isLiveTab = activeTab === LIVE_TAB;

  useEffect(() => {
    const allowed = new Set([LIVE_TAB, todayKey, monthAgoKey]);
    if (!allowed.has(activeTab)) setActiveTab(todayKey);
  }, [activeTab, todayKey, monthAgoKey]);

  const liveItems = useMemo(() => {
    if (!isLiveTab) return [];
    const raw =
      livePlatform === 'all'
        ? todayWomensRankings
        : todayWomensRankings.filter((row) => row.platform === livePlatform);
    return dedupeByProductUrl(raw);
  }, [isLiveTab, livePlatform]);

  const predictionItems = useMemo(() => {
    if (isLiveTab) return [];
    if (activeTab === todayKey) {
      // 랭킹 JSON과 별개: fetch 시 historical 에만 쓰는 「떡상 후보」 스냅샷
      return historicalData[todayKey] || [];
    }
    if (activeTab === monthAgoKey) {
      return historicalData[monthAgoKey] || [];
    }
    return [];
  }, [isLiveTab, activeTab, todayKey, monthAgoKey, historicalData]);

  const openModal = (item) => {
    setSelectedItem(item);
    document.body.style.overflow = 'hidden'; 
  };

  const closeModal = () => {
    setSelectedItem(null);
    document.body.style.overflow = '';
  };

  const runFetchLive = async () => {
    if (!isDevRuntime) {
      setUpdateMsg('배포 환경은 매일 오전 8시(KST) 자동 갱신됩니다.');
      return;
    }
    if (isUpdating) return;
    setIsUpdating(true);
    setUpdateMsg('크롤링 실행 중...');
    try {
      const r = await fetch('/api/fetch-live', { method: 'POST' });
      const j = await r.json();
      if (!r.ok || !j?.ok) {
        throw new Error(j?.message || '업데이트 실패');
      }
      setUpdateMsg('업데이트 완료. 화면을 새로고칩니다.');
      setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      setUpdateMsg(`업데이트 실패: ${e.message}`);
      setIsUpdating(false);
    }
  };

  const currentTrends = isLiveTab ? liveItems : predictionItems;
  const showTodayPredictionChrome = !isLiveTab && activeTab === todayKey;

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-subtitle">Fashion Intelligence : T-45 Production Dashboard</div>
        <h1 className="header-title"><strong>5월 타겟 (초여름) 예측 히스토리</strong></h1>
        <p style={{fontSize: '11px', color: '#D32F2F', marginTop: '6px', fontWeight: 'bold'}}>F/W 제외 | 코어 카테고리 한정 | 7일 급상승 추적</p>
        <div className="fetch-row">
          <button type="button" className="fetch-btn" onClick={runFetchLive} disabled={isUpdating && isDevRuntime}>
            {isDevRuntime ? (isUpdating ? '업데이트 중...' : '크롤링/업데이트') : '자동 업데이트(매일 08:00 KST)'}
          </button>
          {!isDevRuntime && (
            <a className="fetch-link" href={actionsUrl} target="_blank" rel="noreferrer">
              수동 실행: GitHub Actions
            </a>
          )}
          {updateMsg && <p className="fetch-status">{updateMsg}</p>}
        </div>
      </header>
      
      {/* 오늘 실시간 랭킹 + 날짜별 떡상 예측 탭 */}
      <div className="tabs-container" style={{display: 'flex', gap: '8px', padding: '0 16px 16px', overflowX: 'auto', flexWrap: 'wrap'}}>
        <button
          type="button"
          onClick={() => {
            setActiveTab(LIVE_TAB);
            setLivePlatform('all');
          }}
          style={{
            padding: '8px 16px',
            borderRadius: '20px',
            border: 'none',
            fontWeight: 'bold',
            fontSize: '14px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            backgroundColor: isLiveTab ? '#111' : '#E0E0E0',
            color: isLiveTab ? '#FFF' : '#666',
            transition: 'all 0.2s',
          }}
        >
          오늘 플랫폼 랭킹
        </button>
        {predictionTabs.map(({ key, label }) => (
          <button
            type="button"
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: 'none',
              fontWeight: 'bold',
              fontSize: '14px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              backgroundColor: activeTab === key ? '#111' : '#E0E0E0',
              color: activeTab === key ? '#FFF' : '#666',
              transition: 'all 0.2s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {isLiveTab && (
        <div
          style={{
            display: 'flex',
            gap: '6px',
            padding: '0 16px 12px',
            overflowX: 'auto',
            flexWrap: 'wrap',
          }}
        >
          {PLATFORM_FILTERS.map(({ key, label }) => (
            <button
              type="button"
              key={key}
              onClick={() => setLivePlatform(key)}
              style={{
                padding: '6px 12px',
                borderRadius: '16px',
                border: '1px solid #ccc',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: livePlatform === key ? '#333' : '#fff',
                color: livePlatform === key ? '#fff' : '#555',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <main className="trend-list">
        {currentTrends.length > 0 ? (
          currentTrends.map((item, index) => (
            <TopItemCard 
              key={`${activeTab}-${item.id}-${index}`}
              item={item} 
              rank={isLiveTab ? item.platform_rank : index + 1} 
              onClick={() => openModal(item)}
              showPredictionChrome={showTodayPredictionChrome}
            />
          ))
        ) : (
          <p style={{textAlign:'center', marginTop:'40px', color: '#999'}}>
            {isLiveTab
              ? '선택한 플랫폼에 표시할 랭킹이 없습니다. npm run fetch:live 로 데이터를 갱신해 보세요.'
              : activeTab === monthAgoKey
                ? `한달 전(${monthAgoKey})에 저장된 스냅샷이 없습니다. 그날 npm run fetch:live(또는 자동 스케줄)로 쌓인 뒤 여기에 표시됩니다.`
                : '오늘 떡상 후보 스냅샷이 없습니다. npm run fetch:live 를 실행하면 랭킹과 별도 후보 목록이 historical 에 저장됩니다.'}
          </p>
        )}
      </main>

      {selectedItem && (
        <ItemDetailModal item={selectedItem} onClose={closeModal} />
      )}
    </div>
  );
}

export default App;
