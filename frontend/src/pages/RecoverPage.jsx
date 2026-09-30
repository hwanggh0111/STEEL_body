import { useMemo, useState } from 'react';
import { readLS } from '../data/safeStorage';
import { BREATH_LOG_KEY } from '../data/localKeys';
import { recoverGroups, groupLine, RECOVER_MAX, SAME_SEC } from '../data/breathRecover';
import { useBreath, micSupported } from '../data/useBreath';
import { useSettingsStore, senseOf } from '../store/settingsStore';
import RecoverTry from '../components/RecoverTry';

// 회복 — **숨이 가라앉는 데 걸린 초를 모아 보는 자리** (2026-09-30).
//
// 계획은 `docs/BREATH-RECOVER-2026-09-30.md`. 붙인 날에는 이 값이 **홈트 안에서만**
// 보였다 — 쉬는 시간 줄과 끝 결산. 그래서 길찾기에 자리가 없고, 쌓인 것을 볼 데가
// 아무 데도 없었다. **모으는 값을 볼 곳이 없으면 그 값은 없는 것과 같다.**
//
// **새 탭을 만들지 않는다.** 「몸」 탭의 다섯째 갈래다 — 체형을 붙일 때와 같은 자리이고
// 같은 까닭이다(탭바는 늘릴 수 있는 곳이 아니고, 이것도 **몸을 읽는 일**이다).
//
// ── 여기서 안 하는 것 ──
//
// 평균 · 최고 기록 · 그래프. 회복은 그날 잠 · 물 · 방 온도에 흔들린다. 평균은 없는
// 정확함을 만들고 「최고 기록」은 몸에 등급을 매기는 쪽으로 간다(8/25 에 정한 선).
// 말하는 것은 **마지막 것과 그 앞의 것** 둘뿐이다 — 계산은 `breathRecover.js` 가 한다.

function loadLog() {
  try {
    const raw = readLS(BREATH_LOG_KEY);
    const list = raw ? JSON.parse(raw) : null;
    return Array.isArray(list) ? list.slice(-RECOVER_MAX) : [];
  } catch { return []; }
}

/** 'YYYY-MM-DD' → '9월 30일'. 못 읽으면 그대로 보여준다 */
function shortDay(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key || '');
  return m ? `${Number(m[2])}월 ${Number(m[3])}일` : (key || '');
}

export default function RecoverPage({ embedded = false }) {
  const [log] = useState(loadLog);
  const groups = useMemo(() => recoverGroups(log), [log]);

  const breathOn = useSettingsStore((st) => st.breath);
  const breathSense = useSettingsStore((st) => st.breathSense);
  // **이 화면 자기 것**이다. 홈트의 마이크와 섞이지 않는다 (한 화면에 하나씩)
  const breath = useBreath(senseOf(breathSense));
  const canTry = micSupported() && breathOn;

  return (
    <div>
      {!embedded && (
        <div className="section-title">
          <div className="accent-bar" />
          회복
        </div>
      )}

      {/* ── 무엇을 보는 자리인지 먼저 ──
          숫자만 놓으면 「이게 뭔가」가 된다. 인바디 · 체형이 못 하는 말이라는 것을
          여기서 적어야 사람이 이 칸을 왜 보는지 안다 */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7 }}>
          동작이 끝나고 <b>숨이 가라앉는 데 걸린 초</b>예요.
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7, marginTop: 6 }}>
          같은 동작 뒤에 이 초가 줄면 <b>전보다 덜 힘들어진 것</b>이에요 — 인바디도 체형도
          못 하는 말이라 따로 둡니다. <b>점수가 아니라 초</b>고, 견주는 상대는
          <b> 같은 동작을 한 지난 번의 나</b>예요.
        </div>
      </div>

      {/* ── 지금 재보기 ──
          **판을 안 돌려도 한 번 재볼 수 있다.** 이력이 비었을 때 이 단추가 없으면
          이 화면은 「언젠가 쌓이면 보여드려요」만 적혀 있는 빈 칸이 된다 */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.7 }}>
          여기서 <b>한 번 재볼</b> 수 있어요.
        </div>
        <RecoverTry breath={breath} enabled={canTry} />
      </div>

      {groups.length === 0 ? (
        <div className="card">
          <div style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.7 }}>
            아직 쌓인 것이 없어요.
          </div>
          {/* **어떻게 하면 쌓이는지** 적는다. 조건을 안 적으면 켜둔 사람이 고장으로 읽는다 */}
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.75, marginTop: 8 }}>
            설정함에서 <b>숨 보고 쉬기</b>를 켜고 <b>홈트(기능성)</b>를 한 판 돌리면,
            쉬는 시간마다 한 칸씩 쌓여요. 위의 <b>재보기</b>로 잰 것은
            <b> 안 쌓습니다</b> — 동작 뒤에 잰 것이 아니라서 견줄 상대가 없어요.
          </div>
        </div>
      ) : (
        <div className="card">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            동작별 — 최근에 잰 것부터
          </div>
          {groups.map((g) => (
            <div
              key={g.key}
              style={{
                paddingBottom: 11, marginBottom: 11,
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 13.5, color: 'var(--text-primary)', minWidth: 0 }}>
                  {g.exercise || '(이름 없음)'}
                  {g.duration ? <span style={{ color: 'var(--text-muted)', fontSize: 11.5 }}> · {g.duration}초</span> : null}
                </span>
                {/* 빨라진 것과 더 걸린 것을 색으로만 가른다. **좋고 나쁨을 매기지
                    않는다** — 느려진 날은 잠이나 감기가 그렇게 만든다 */}
                <span style={{
                  fontSize: 12, flexShrink: 0,
                  color: g.delta === null || Math.abs(g.delta) <= SAME_SEC
                    ? 'var(--text-muted)'
                    : (g.delta < 0 ? 'var(--accent)' : 'var(--info)'),
                }}>
                  {g.delta === null || Math.abs(g.delta) <= SAME_SEC
                    ? `${g.last.seconds}초`
                    : `${g.last.seconds}초 (${g.delta < 0 ? '−' : '+'}${Math.abs(g.delta)})`}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.65, marginTop: 4 }}>
                {groupLine(g)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                마지막은 {shortDay(g.last.date)} · 여태 {g.count}번 쟀어요
              </div>
            </div>
          ))}
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {RECOVER_MAX}칸까지 들고 있어요.
          </div>
        </div>
      )}

      {/* ── 꼭 적는 것 ── */}
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.75, marginTop: 14 }}>
        <b>소리는 아무 데도 안 남아요.</b> 마이크로 크기만 재고 버립니다 — 녹음하지 않고,
        어디로도 안 보내요. 남는 것은 <b>초 · 날짜 · 어느 동작이었나</b>뿐이에요.<br />
        <b>진단이 아니에요.</b> 잠 · 물 · 방 온도 · 감기에도 흔들려요 — {SAME_SEC}초 안쪽
        차이는 「거의 같다」고 봅니다.<br />
        주변이 시끄러우면 숨이 묻혀서 <b>못 재요</b>. 그때는 못 쟀다고 적고,
        <b> 0초로 적지 않아요.</b>
      </div>
    </div>
  );
}
