import { useState } from 'react';
import { toast } from '../Toast';
import { dateKey } from '../../data/dateKey';
import { changeOf, bestOf, diffLabel, sinceLabel, mmss, toSeconds } from '../../data/measureChange';

// 체력 테스트.
//
// **적기만 하고 달라진 것을 안 말했다** (2026-09-02 에 고쳤다). 푸시업 30개를 적으면
// 목록에 「푸시업 30개」로 쌓일 뿐, 지난번보다 늘었는지 줄었는지는 **위아래를 번갈아
// 보며 직접 빼야** 알 수 있었다. **체력 테스트는 원래 늘려고 재는 것이다.**
//
// 그래서 두 가지를 적는다 — 적는 칸 밑에 **지난번 값과 내 최고**, 목록 위에
// **지난번과 견주면 얼마나 달라졌나**.
//
// **여기서는 최고 기록을 말해도 된다.** 8/25 에 「몸에 등급을 매기지 않는다」고 정한 것은
// 몸(인바디 · 사이즈 · 유연성) 이야기다. 푸시업 34개는 30개보다 잘한 것이 맞다 —
// 기록 화면의 「최고기록」과 같은 결이다.
//
// 날짜와 지우기는 8/27 에 넣었다. 그 전에는 어제 잰 것을 오늘 적으면 오늘 날짜로
// 들어갔고, 한 번 잘못 적으면 영영 남았다.
const FITNESS_TESTS = [
  { key: 'pushup', label: '푸시업 최대', unit: '개', placeholder: '30', better: 'up' },
  { key: 'pullup', label: '풀업 최대', unit: '개', placeholder: '10', better: 'up' },
  { key: 'plank', label: '플랭크 최대', unit: '초', placeholder: '120', better: 'up' },
  // **1km 만 시간이다.** 초로만 받으면 사람이 머리로 나눠야 한다 — 분 · 초로 받는다.
  // 저장은 그대로 초다 (이미 쌓인 기록이 초라서 바꾸면 옛 기록이 이상해진다)
  { key: 'run_1km', label: '1km 달리기', unit: '초', better: 'down', time: true },
  { key: 'situp', label: '윗몸일으키기 1분', unit: '개', placeholder: '40', better: 'up' },
  { key: 'squat_max', label: '스쿼트 최대', unit: '개', placeholder: '50', better: 'up' },
];

/** 그 항목의 값을 사람이 읽는 말로. 1km 만 분:초다 */
const show = (f, v) => (f.time ? mmss(v) : `${v}${f.unit}`);

export default function FitnessTestSection({ records, onSave, onDelete }) {
  const [values, setValues] = useState({});
  // 1km 는 분 · 초 두 칸으로 받는다
  const [runMin, setRunMin] = useState('');
  const [runSec, setRunSec] = useState('');
  const [date, setDate] = useState(dateKey());
  const [all, setAll] = useState(false);

  const handleSave = () => {
    const next = { ...values };
    const runTotal = toSeconds(runMin, runSec);
    if (runTotal !== null) next.run_1km = String(runTotal);
    const filled = Object.entries(next).filter(([, v]) => v);
    if (filled.length === 0) { toast('최소 1개 항목을 입력해주세요'); return; }
    onSave({ ...next, date });
    setValues({});
    setRunMin('');
    setRunSec('');
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="section-title"><div className="accent-bar" />체력 테스트</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.7 }}>
        적으면 지난번과 견줘서 얼마나 달라졌는지 같이 보여드려요.
      </div>
      <label className="label">날짜</label>
      <input className="input" type="date" value={date} max={dateKey()} onChange={(e) => setDate(e.target.value)} style={{ marginBottom: 12 }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        {FITNESS_TESTS.map(f => {
          const ch = changeOf(records, f.key);
          const best = bestOf(records, f.key, f.better);
          return (
            <div key={f.key}>
              <label className="label">{f.label}{f.time ? '' : ` (${f.unit})`}</label>
              {f.time ? (
                // 분 · 초 두 칸. 「5분 12초」로 적고, 저장은 312초로 한다
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input className="input" type="number" inputMode="numeric" min="0" max="99" placeholder="5"
                    value={runMin} onChange={e => setRunMin(e.target.value)} style={{ fontSize: 13 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>분</span>
                  <input className="input" type="number" inputMode="numeric" min="0" max="59" placeholder="12"
                    value={runSec} onChange={e => setRunSec(e.target.value)} style={{ fontSize: 13 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>초</span>
                </div>
              ) : (
                <input className="input" type="number" placeholder={f.placeholder}
                  value={values[f.key] || ''} onChange={e => setValues({ ...values, [f.key]: e.target.value })}
                  style={{ fontSize: 13 }} />
              )}
              {/* **적는 자리에서 지난 값을 보여준다.** 저장하고 나서야 견줄 수 있으면
                  적는 동안에는 이번이 잘한 것인지 모른다 */}
              {ch && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.6 }}>
                  지난번 {show(f, ch.last)}
                  {best && best.value !== ch.last && ` · 최고 ${show(f, best.value)}`}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button className="btn-primary" onClick={handleSave} style={{ marginBottom: 12 }}>기록 저장</button>

      {/* ── 지난번과 견주면 ──
          목록만 있으면 사람이 위아래를 번갈아 보며 직접 빼야 한다.
          **늘고 줆에 좋고 나쁨을 매기지는 않는다** — 다만 이건 기록이라 최고는 말한다 */}
      {records.length >= 2 && (
        <div className="card" style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 8 }}>
            지난번과 견주면
          </div>
          {FITNESS_TESTS.map(f => {
            const ch = changeOf(records, f.key);
            if (!ch || ch.prev === null) return null;
            // 좋아진 쪽은 금색, 나빠진 쪽은 파랑. **빨강을 안 쓴다** —
            // 체력이 준 날에 경고색을 주면 다음에 안 적게 된다
            const better = f.better === 'down' ? ch.diff < 0 : ch.diff > 0;
            const color = ch.diff === 0 ? 'var(--text-muted)' : better ? 'var(--accent)' : 'var(--info)';
            return (
              <div key={f.key} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{f.label}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {show(f, ch.prev)} &#8594; <b style={{ color: 'var(--text-primary)' }}>{show(f, ch.last)}</b>
                  <b style={{ color, marginLeft: 8 }}>
                    {f.time ? diffLabel(ch.diff, '초') : diffLabel(ch.diff, f.unit)}
                  </b>
                  {ch.days ? <span style={{ marginLeft: 6 }}>{sinceLabel(ch.days)}</span> : null}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {(all ? records : records.slice(0, 3)).map(r => (
        <div key={r.id} className="card" style={{ marginBottom: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.date}</span>
            {onDelete && <button className="delete-btn" onClick={() => onDelete(r.id)}>&#10005;</button>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {FITNESS_TESTS.map(f => r.data?.[f.key] && (
              <span key={f.key} style={{ fontSize: 12 }}>
                {f.label} <strong style={{ color: 'var(--accent)' }}>{show(f, r.data[f.key])}</strong>
              </span>
            ))}
          </div>
        </div>
      ))}
      {/* 세 개만 보여주고 끝이었다 — 넷째부터는 볼 수도 지울 수도 없었다 */}
      {records.length > 3 && (
        <button className="btn-secondary" onClick={() => setAll(v => !v)} style={{ marginTop: 4 }}>
          {all ? '접기' : `지난 기록 ${records.length - 3}건 더 보기`}
        </button>
      )}
    </div>
  );
}
