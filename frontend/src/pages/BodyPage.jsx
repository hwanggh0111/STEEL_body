import { lazy, Suspense, useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useInbodyStore } from '../store/inbodyStore';
import { useToday } from '../data/useToday';
import { daysBetween } from '../data/personalRecord';
import { buildChange } from '../data/bodyChange';
// **「가장 최근」을 제 손으로 집지 않는다** (2026-11-09) — 11/05 에 세운 그 손
import { latestInbody } from '../data/inbodyLatest';
import SegRow from '../components/SegRow';
// 갈래를 주소에 남긴다 — 새로고침·링크·바로가기가 산다 (2026-10-06)
import { useTabParam } from '../data/useTabParam';

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
const ShapePage = lazy(() => import('./ShapePage'));
// 회복은 **따로 받는다.** 이 갈래를 열지 않는 사람에게 마이크 코드까지 내려보낼 이유가 없다
const RecoverPage = lazy(() => import('./RecoverPage'));

// **「몸」은 재고 견주는 자리다** (2026-09-16 에 다시 정했다).
//
// 몸 지도를 하루 이 탭의 첫 갈래로 뒀다가 곧 뺐다. 지도는 **몸 상태가 아니라 오늘
// 할 일**을 말하는 화면이라, 「체지방이 어떻게 됐나」와 같은 방에 있을 것이 아니었다.
// 지금은 「오늘」 탭 첫 카드에서 `/map` 으로 들어간다.
//
// 그래서 여기 남는 것은 셋 — 재고(인바디 · 재는 도구) 견준다(견주기).
//
// **넷째로 「체형」이 붙었다** (2026-09-22, `docs/SHAPE-READ-2026-09-19.md` 의 01 단계).
// 새 탭을 만들지 않고 여기 붙인 것은 9/19 에 「기구」 탭을 걷은 것과 같은 이유다 —
// 탭바는 늘릴 수 있는 자리가 아니고, 체형은 **몸을 읽는 일**이라 이 방이 맞다.
// 갈래가 넷이 되어도 안 잘린다(`SegRow` 는 글자만큼만 차지한다 — 9/16 에 고쳤다).
//
// **다섯째로 「회복」이 붙었다** (2026-09-30, `docs/BREATH-RECOVER-2026-09-30.md`).
// 숨이 가라앉는 데 걸린 초는 붙인 날 **홈트 안에서만** 보였다 — 쉬는 시간 줄과 끝 결산.
// 길찾기에 자리가 없고 쌓인 것을 볼 데가 없었다. **모으는 값을 볼 곳이 없으면 그 값은
// 없는 것과 같다.** 체형과 같은 까닭으로 여기 붙인다 — 이것도 몸을 읽는 일이다.
const TABS = [
  { key: 'inbody', label: '인바디' },
  { key: 'measure', label: '재는 도구' },
  { key: 'compare', label: '견주기' },
  { key: 'shape', label: '체형' },
  { key: 'recover', label: '회복' },
];

// 주소에 적힐 수 있는 갈래 이름. **여기 없는 값은 안 받는다** — 주소는 누가
// 손으로 고칠 수 있는 자리고, 없는 갈래를 받으면 빈 화면이 뜬다
const TAB_KEYS = TABS.map((t) => t.key);

function Panel({ height = 200 }) {
  return (
    <div style={{
      height, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-muted)', fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif",
      fontSize: 16, letterSpacing: 2,
    }}>LOADING...</div>
  );
}


export default function BodyPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const today = useToday();
  const records = useInbodyStore((s) => s.records);
  const fetchAll = useInbodyStore((s) => s.fetchAll);

  // ── 갈래는 **주소가 들고 있다** ── (2026-10-06)
  //
  // 여태 `useState` 였다. 그래서 **당겨서 새로고침하면 인바디로 돌아갔고**
  // (폰에서 흔히 하는 동작이다) 「몸 → 체형」 같은 링크를 만들 수가 없었다.
  // 다른 화면이 들려 보내는 길(`location.state.tab`)은 그대로 받는다 — 홈 검색이
  // 「1RM」을 그 길로 보낸다. 까닭은 `data/useTabParam.js` 에 적어뒀다.
  //
  // 「들고 온 갈래가 바뀌면 따라간다」(2026-09-18 에 고친 것)도 그 고리가 맡는다 —
  // `useState` 의 첫 값은 처음 한 번만 읽히는데, 이제 주소에서 읽으므로 같은
  // 주소로 다시 와도 따라간다.
  const [tab, setTab] = useTabParam(TAB_KEYS, 'inbody', location.state?.tab, location.key);

  // 「재는 도구」 안의 어느 칸까지 들고 왔을 수 있다 (「1RM」 · 「어깨 측정」…).
  // **그 값을 그대로 넘긴다** — 갈래를 고르고 또 한 번 고르게 하지 않는다
  const sub = location.state?.sub || null;

  useEffect(() => { fetchAll?.(); }, [fetchAll]);

  // **달라진 것을 세는 일은 이미 `data/bodyChange.js` 가 한다.**
  // 여기서 다시 짰다가 걷었다 — 같은 것을 두 벌로 두면 한쪽만 고치는 날이 온다.
  // 저것은 `npm run check` 가 이미 돌려보고 있고, 「좋다 나쁘다를 안 매긴다」는
  // 규칙도 저기에 적혀 있다. 여기서는 **한 줄만** 꺼내 쓴다
  const change = useMemo(() => buildChange(records, 'last', today), [records, today]);
  // ── **「가장 최근」을 여기서 또 집고 있었다** ── (2026-11-09)
  //
  // 제 손으로 날짜 내림차순으로 세워 `sorted[0]` 을 집었다. 서버는 인바디 날짜를
  // **하루 넉넉하게** 받으므로(시차 · 자정 무렵) 그것이 **앞날 줄**일 수 있고,
  // 그러면 아래 `stale` 이 **음수**가 된다 — `stale >= 14` 로 거르니까
  // **「마지막으로 잰 지 N일 됐어요」가 영영 안 뜬다.** 넉 달을 안 재도 조용하다.
  //
  // 11/05 에 홈 · 인바디 화면에서 같은 것을 고치고 손을 하나 세웠다
  // (`inbodyLatest.js` 의 `latestInbody`). **이 자리만 그 손을 안 거치고 있었다** —
  // 손을 세운 날 고친 것은 그때 `records[0]` 을 집던 자리들뿐이었고, 여기는
  // 제 손으로 **정렬까지 해서** 집고 있어서 그 그물에 안 걸렸다
  const latest = useMemo(() => latestInbody(records, today).latest, [records, today]);
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

      {/* ── **몸 지도 · 아픈 곳도 여기서 간다** ── (2026-11-12, 맵시)
          둘 다 몸 이야기인데 이 탭에 길이 없었다. 몸 지도는 홈의 「오늘 할 곳」 하나로만
          들어갔고 그 카드는 **최근 기록이 있어야** 뜬다 — 새로 온 사람은 찾기에 이름을
          치지 않으면 못 갔다. 아픈 곳(`/parts`)은 내 계정 서랍 안에만 있었다.
          **달라진 것을 먼저** 말하는 위 띠는 그대로 두고, 갈래 줄 바로 위에 둔다 —
          아래 갈래는 이 화면 안의 것이고, 이 두 칸은 옆 화면으로 가는 길이다 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[
          ['/map', '몸 지도', '최근에 자극한 곳'],
          ['/parts', '아픈 곳', '몸 그림에 짚어두기'],
        ].map(([to, name, sub]) => (
          <button
            key={to}
            type="button"
            onClick={() => navigate(to)}
            className="card clickable"
            style={{
              flex: 1, minWidth: 0, minHeight: 44, margin: 0, padding: '9px 12px', textAlign: 'left',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <span style={{ display: 'block', fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 600 }}>{name} ›</span>
            <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</span>
          </button>
        ))}
      </div>

      {/* ── 갈래 셋 ──
          예전에는 인바디(탭바) · 측정(서랍) · 견주기(인바디 안쪽 탭)로 흩어져 있었다 */}
      {/* **칸을 똑같이 나누지 않는다.** 넷으로 나눴더니 「재는 도구」가 잘렸다 —
          갈래 줄은 글자만큼 차지하고 넘치면 옆으로 민다 (`SegRow`) */}
      <SegRow items={TABS} value={tab} onChange={setTab} ariaLabel="몸 갈래" />

      <Suspense fallback={<Panel />}>
        {tab === 'inbody' && <InbodyPage embedded />}
        {tab === 'measure' && <MeasurePage embedded subTab={sub} />}
        {tab === 'compare' && <ComparePage embedded />}
        {tab === 'shape' && <ShapePage embedded />}
        {tab === 'recover' && <RecoverPage embedded />}
      </Suspense>
    </div>
  );
}
