/**
 * 등록일~오늘 조회·장바구니 (듀얼 Y축 라인)
 */
export default function WeeklyTrendChart({ series }) {
  if (!series?.length) return null;

  const W = 450;
  const H = 150;
  const pad = { t: 12, r: 45, b: 30, l: 51 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;

  const maxV = Math.max(...series.map((s) => s.views), 1);
  const maxC = Math.max(...series.map((s) => s.cart), 1);

  const n = series.length;
  const xAt = (i) => pad.l + (n <= 1 ? innerW / 2 : (innerW * i) / (n - 1));
  const yV = (v) => pad.t + innerH - (v / maxV) * innerH;
  const yC = (c) => pad.t + innerH - (c / maxC) * innerH;

  const ptsV = series.map((s, i) => `${xAt(i)},${yV(s.views)}`).join(' ');
  const ptsC = series.map((s, i) => `${xAt(i)},${yC(s.cart)}`).join(' ');

  const yMidV = Math.round(maxV / 2);
  const yMidC = Math.round(maxC / 2);

  const labelCount = Math.min(6, n);
  const xLabelIdx =
    n <= 8
      ? series.map((_, i) => i)
      : Array.from({ length: labelCount }, (_, k) => Math.round((k * (n - 1)) / Math.max(labelCount - 1, 1)));

  return (
    <div className="trend-chart-inner">
      <svg className="trend-chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-hidden>
        <line x1={pad.l} y1={yV(yMidV)} x2={W - pad.r} y2={yV(yMidV)} stroke="#EEEEF2" strokeWidth="1.5" />
        <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke="#E8E8ED" strokeWidth="1.5" />

        <text x={pad.l - 6} y={pad.t + 15} textAnchor="end" className="trend-chart-axis-tick">
          {maxV >= 10000 ? `${Math.round(maxV / 1000)}k` : maxV}
        </text>
        <text x={pad.l - 6} y={yV(yMidV) + 6} textAnchor="end" className="trend-chart-axis-tick">
          {yMidV >= 10000 ? `${(yMidV / 1000).toFixed(1)}k` : yMidV}
        </text>

        <text x={W - 4} y={pad.t + 15} textAnchor="end" className="trend-chart-axis-tick trend-chart-axis-cart">
          {maxC}
        </text>
        <text x={W - 4} y={yC(yMidC) + 6} textAnchor="end" className="trend-chart-axis-tick trend-chart-axis-cart">
          {yMidC}
        </text>

        <polyline
          fill="none"
          stroke="#5C6BC0"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={ptsV}
        />
        <polyline
          fill="none"
          stroke="#E57373"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={ptsC}
        />

        {xLabelIdx.map((i) => (
          <text
            key={`lx-${i}`}
            x={xAt(i)}
            y={H - 5}
            textAnchor="middle"
            className="trend-chart-x-label"
          >
            {series[i]?.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
