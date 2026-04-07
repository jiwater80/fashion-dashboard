/** 서울(KST) 기준 YYYY.MM.DD — 크롤 스크립트와 UI 라벨이 동일한 키를 쓰도록 맞춤 */
export function seoulDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return `${y}.${m}.${d}`;
}

/** 서울 달력 기준 한 달 전 같은 날(없으면 전월 말일). 예: 4.6 → 3.6, 3.31 → 2.28 */
export function seoulOneMonthAgoDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parseInt(parts.find((p) => p.type === 'year').value, 10);
  const mo = parseInt(parts.find((p) => p.type === 'month').value, 10);
  const d = parseInt(parts.find((p) => p.type === 'day').value, 10);

  let ty = y;
  let tm = mo - 1;
  if (tm < 1) {
    tm = 12;
    ty -= 1;
  }
  const lastDay = new Date(ty, tm, 0).getDate();
  const dd = Math.min(d, lastDay);
  return `${ty}.${String(tm).padStart(2, '0')}.${String(dd).padStart(2, '0')}`;
}
