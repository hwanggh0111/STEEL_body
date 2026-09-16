import { lazy, Suspense, useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useInbodyStore } from '../store/inbodyStore';
import { useToday } from '../data/useToday';
import { daysBetween } from '../data/personalRecord';
import { buildChange } from '../data/bodyChange';
import SegRow from '../components/SegRow';

// 몸 — 5차 리모델링(2026-09-04).
//
// **같은 일인데 닿는 깊이가 달랐다.** 인바디는 탭바에 있어 한 번에 닿는데,
// 측정 도구 일곱은 더보기 서랍을 열어야 닿았다. 둘 다 「몸을 재는 일」이다.
// 견주기는 인바디 화면 **안쪽 탭**에 숨어 있어서, 몸이 어떻게 달라졌는지 보려면
// 인바디 → 비교 두 번을 눌러야 했다.
//
// 셋을 한 자리에 놓는다. **화면 안쪽은 안 건드린다** — 인바디 · 측정 · 견주기는
// 각자 잘 하고 있고, 각각 이미 여러 번 다듬었다. 5차가 바꾸는 것은 경계지 안쪽이
// 아니다. 그래서 저 셋을 그대로 불러 쓰고, 자기 제목만 안 그리게 했다(`embedded`).
//
// **머리에 「달라진 것」을 먼저 적는다.** 몸을 보러 오는 이유는 숫자를 읽으러가
// 아니라 「내가 가고 있나」를 알러 오는 것이다.

const InbodyPage = lazy(() => import('./InbodyPage'));
const MeasurePage = lazy(() => import('./MeasurePage'));
const ComparePage = lazy(() => import('./ComparePage'));

// **「몸」은 재고 견주는 자리다** (2026-09-16 에 다시 정했다).
//
// 몸 지도를 하루 이 탭의 첫 갈래로 뒀다가 곧 뺐다. 지도는 **몸 상태가 아니라 오늘
// 할 일**을 말하는 화면이라, 「체지방이 어떻게 됐나」와 같은 방에 있을 것이 아니었다.
// 지금은 「오늘」 탭 첫 카드에서 `/map` 으로 들어간다.
//
// 그래서 여기 남는 것은 셋 — 재고(인바디 · 재는 도구) 견준다(견주기).
const TABS = [
  { key: 'inbody', label: '인바디' },
  { key: 'measure', label: '재는 도구' },
  { key: 'compare', label: '견주기' },
];

function Panel({ height = 200 }) {
  return (
    <div style={{
      height, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-muted)', fontFamily: "'Bebas Neue', sans-serif",
      fontSize: 16, letterSpacing: 2,
    }}>LOADING...</div>
  );
}


export default function BodyPage() {
  const location = useLocation();
  const today = useToday();
  const records = useInbodyStore((s) => s.records);
  const fetchAll = useInbodyStore((s) => s.fetchAll);

  // 「재는 도구」로 바로 들어올 수 있다 (홈 · 검색에서). 안 정해주면 인바디부터
  const [tab, setTab] = useState(
    TABS.some((t) => t.key === location.state?.tab) ? location.state.tab : 'inbody',
  );

  useEffect(() => { fetchAll?.(); }, [fetchAll]);

  // **달라진 것을 세는 일은 이미 `data/bodyChange.js` 가 한다.**
  // 여기서 다시 짰다가 걷었다 — 같은 것을 두 벌로 두면 한쪽만 고치는 날이 온다.
  // 저것은 `npm run check` 가 이미 돌려보고 있고, 「좋다 나쁘다를 안 매긴다」는
  // 규칙도 저기에 적혀 있다. 여기서는 **한 줄만** 꺼내 쓴다
  const change = useMemo(() => buildChange(records, 'last'), [records]);
  const latest = useMemo(() => {
    const sorted = [...(records || [])].filter(r => r && r.date).sort((a, b) => (a.date < b.date ? 1 : -1));
    return sorted[0] || null;
  }, [records]);
  const stale = latest ? daysBetween(latest.date, today) : null;

  return (
    <div>
      <div className="section-title">
        <div className="accent-bar" />
        몸
      </div>

      {/* ── 달라진 것을 먼저 ──
          숫자를 읽으러 오는 것이 아니라 「내가 가고 있나」를 알러 온다.
          잴 것이 하나뿐이면 아무 말도 안 한다 — 점 하나로는 방향이 없다 */}
      {change?.headline && (
        <button
          onClick={() => setTab('compare')}
          className="card clickable"
          style={{
            width: '100%', textAlign: 'left', marginBottom: 14, cursor: 'pointer',
            fontFamily: 'inherit', borderColor: 'var(--accent)', background: 'var(--accent-dim)',
          }}
        >
          <div style={{ fontSize: 11.5, color: 'var(--accent)', letterSpacing: 1, marginBottom: 7 }}>
            {change.days ? `${change.days}일 전과 견주면` : '지난번과 견주면'}
          </div>
          <div style={{ fontSize: 14.5, color: 'var(--text-primary)', lineHeight: 1.75 }}>
            {change.headline.text}
          </div>
          {change.headline.sub && (
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 5 }}>
              {change.headline.sub}
            </div>
          )}
        </button>
      )}

      {/* 오래 안 쟀으면 한 번 짚어준다. **잔소리가 되지 않게 한 줄만** */}
      {stale != null && stale >= 14 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
            마지막으로 잰 지 <span style={{ color: 'var(--warning)' }}>{stale}일</span> 됐어요.
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            체중만 적어도 그래프가 이어집니다.
          </div>
        </div>
      )}

      {/* ── 갈래 셋 ──
          예전에는 인바디(탭바) · 측정(서랍) · 견주기(인바디 안쪽 탭)로 흩어져 있었다 */}
      {/* **칸을 똑같이 나누지 않는다.** 넷으로 나눴더니 「재는 도구」가 잘렸다 —
          갈래 줄은 글자만큼 차지하고 넘치면 옆으로 민다 (`SegRow`) */}
      <SegRow items={TABS} value={tab} onChange={setTab} ariaLabel="몸 갈래" />

      <Suspense fallback={<Panel />}>
        {tab === 'inbody' && <InbodyPage embedded />}
        {tab === 'measure' && <MeasurePage embedded />}
        {tab === 'compare' && <ComparePage embedded />}
      </Suspense>
    </div>
  );
}
