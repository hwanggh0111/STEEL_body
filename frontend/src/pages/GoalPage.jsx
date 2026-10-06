import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkoutStore } from '../store/workoutStore';
import { useInbodyStore } from '../store/inbodyStore';
import { useGoalStore } from '../store/goalStore';
import { useToday } from '../data/useToday';
import { toast } from '../components/Toast';
import { confirmDialog } from '../components/ConfirmModal';
import GoalRing from '../components/GoalRing';
import {
  MAX_WEEKLY, hasGoal, weekProgress, weekLine, weekStreak, weekHistory,
  measureProgress, weightEta,
} from '../data/goal';

// 목표 화면.
//
// 홈의 카드는 **지금 어디쯤인지**만 말한다. 세우기 · 고치기 · 이어온 주 · 언제
// 닿을지는 여기 있다 — 홈에 다 넣으면 홈이 또 길어지고, 홈은 「오늘 뭘 하면
// 되는가」 하나만 말하는 자리다.
//
// **들어오는 길은 하나다** — 홈의 목표 카드. 탭바에도 서랍에도 안 건다.
// 같은 자리로 가는 길을 두 벌로 두면 쓰는 사람이 어느 쪽이 진짜인지 모른다
// (옛 「운동」 화면 둘로 이미 겪고 있는 것이다).
//
// 목표는 **접을 수 있다.** 접는 길이 없으면 한번 세운 수에 갇힌다 —
// 다치거나 바빠서 주 4회가 무리가 된 사람에게 앱이 매일 3/4 을 들이민다.

const DAY_OPTIONS = Array.from({ length: MAX_WEEKLY }, (_, i) => i + 1);

// ── 쫓을 수 있는 몸의 수 셋 ── (2026-10-06)
//
// 여태 **체중 하나**였다. 그런데 이 앱 홈페이지의 첫 줄이
// **「무게는 늘었는데 무엇이 늘었는지는 아무도 안 알려준다」**다 — 체중은 「몸이
// 변했다」를 가장 못 말하는 수다. 근육이 늘고 지방이 줄면 **체중은 안 움직인다.**
// 목표가 체중뿐이면 그 사람은 **제일 잘한 달에 「아무 일도 없었다」를 본다.**
//
// 즉 홈페이지가 꼬집은 문제를 목표 화면이 그대로 하고 있었다. 인바디에 체지방률과
// 골격근량이 이미 담기는데(`fat_pct` · `muscle_kg`) 목표로는 세울 수가 없었다.
//
// **한 자리에 적는다.** 폼의 칸 · 저장할 때 박는 시작값 · 그려주는 줄이 전부
// 이 목록을 돌린다 — 세 자리에 따로 적으면 넷째 값을 더하는 날 한 곳이 빠진다.
const MEASURES = [
  {
    key: 'weight', label: '체중', unit: 'kg', step: '0.1', min: 20, max: 300,
    field: 'weight', targetKey: 'weightTarget', startKey: 'weightStart',
    hint: '지금 몸무게에서 어디로 갈지',
  },
  {
    key: 'fat', label: '체지방률', unit: '%', step: '0.1', min: 3, max: 60,
    field: 'fat_pct', targetKey: 'fatTarget', startKey: 'fatStart',
    // **이 줄이 이 앱의 자리다.** 체중이 그대로여도 이 수는 움직인다
    hint: '체중이 그대로여도 이 수는 움직입니다',
  },
  {
    key: 'muscle', label: '골격근량', unit: 'kg', step: '0.1', min: 5, max: 100,
    field: 'muscle_kg', targetKey: 'muscleTarget', startKey: 'muscleStart',
    hint: '늘리는 쪽을 쫓는 사람이 많습니다',
  },
];

function SectionTitle({ children }) {
  return (
    <div className="section-title">
      <div className="accent-bar" />
      {children}
    </div>
  );
}

// 세우기 · 고치기 폼.
//
// **비워둘 수 있다.** 넷 중 하나만 쫓는 사람이 있다 (주 횟수만, 또는 체지방률만).
// 다 비우면 목표를 접는 것과 같아서, 그때는 접겠느냐고 묻는다.
function GoalForm({ goal, latest, onSave, onCancel, saving }) {
  const [weekly, setWeekly] = useState(goal?.weeklyTarget ?? null);
  // 재는 값 셋을 한 덩이로 들고 있는다. `useState` 를 셋 두면 아래 `MEASURES`
  // 순회와 짝이 안 맞아, 넷째 값을 더하는 날 상태 하나를 빼먹는다
  const [vals, setVals] = useState(() => {
    const out = {};
    for (const m of MEASURES) {
      out[m.key] = goal?.[m.targetKey] != null ? String(goal[m.targetKey]) : '';
    }
    return out;
  });
  const setVal = (key, v) => setVals((o) => ({ ...o, [key]: v }));

  const submit = (e) => {
    e.preventDefault();
    const patch = { weeklyTarget: weekly };
    for (const m of MEASURES) {
      const raw = String(vals[m.key] ?? '').trim();
      if (raw === '') { patch[m.targetKey] = null; continue; }
      const num = Number(raw);
      if (!Number.isFinite(num) || num < m.min || num > m.max) {
        toast(`${m.label} 목표는 ${m.min}~${m.max}${m.unit} 사이로 적어주세요`, 'error');
        return;
      }
      patch[m.targetKey] = Math.round(num * 10) / 10;
    }
    onSave(patch);
  };

  return (
    <form onSubmit={submit} className="card" style={{ marginBottom: 20 }}>
      <div className="label" style={{ marginBottom: 9 }}>주 몇 번</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        {DAY_OPTIONS.map((n) => {
          const on = weekly === n;
          return (
            <button
              key={n}
              type="button"
              // 누른 것을 다시 누르면 꺼진다 — 주 횟수 목표를 안 쓰는 길이다
              onClick={() => setWeekly(on ? null : n)}
              style={{
                flex: '1 0 38px', padding: '9px 0', fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif",
                fontSize: 17, letterSpacing: 1,
                background: on ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
                border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                color: on ? 'var(--accent)' : 'var(--text-muted)',
                borderRadius: 'var(--radius)', cursor: 'pointer',
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 18 }}>
        {weekly ? `한 주에 ${weekly}번 나가는 것을 목표로 합니다` : '안 쓰려면 비워두세요'}
      </div>

      {/* 재는 값 셋. **다 비워둬도 된다** — 주 횟수만 쫓는 사람이 있다 */}
      {MEASURES.map((m) => {
        const now = latest?.[m.key];
        return (
          <div key={m.key}>
            <div className="label" style={{ marginBottom: 9 }}>{m.label} 목표</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                step={m.step}
                min={m.min}
                max={m.max}
                value={vals[m.key]}
                onChange={(e) => setVal(m.key, e.target.value)}
                placeholder={now != null ? String(now) : ''}
                aria-label={`${m.label} 목표 (${m.unit})`}
                style={{ flexGrow: 1 }}
              />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', flexShrink: 0, minWidth: 22 }}>{m.unit}</span>
            </div>
            {/* **지금 값이 있으면 그것을 말한다** — 없으면 어디서 적는지 말한다.
                「진행률이 안 그려진다」로 끝내면 어디로 가야 하는지를 또 찾아야 한다 */}
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.6 }}>
              {now != null
                ? `지금 ${now}${m.unit} 에서 시작합니다 · ${m.hint}`
                : `「몸 → 인바디」에 ${m.label}을 한 번 적으면 진행률이 그려집니다`}
            </div>
          </div>
        );
      })}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn-primary" style={{ flexGrow: 1 }} disabled={saving}>
          {saving ? '저장 중…' : goal ? '고치기' : '목표 세우기'}
        </button>
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
            그만두기
          </button>
        )}
      </div>
    </form>
  );
}

export default function GoalPage() {
  const navigate = useNavigate();
  const { workouts, fetchAll: fetchWorkouts } = useWorkoutStore();
  const { records, fetchAll: fetchInbody } = useInbodyStore();
  const { goal, loaded, fetch: fetchGoal, save, clear } = useGoalStore();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchWorkouts();
    fetchInbody();
    fetchGoal();
  }, []);

  const today = useToday();

  // 목표를 세울 때 박아둘 시작값 셋. **지금 값이다** —
  // 진행률을 「시작에서 얼마나 왔나」로 재는데, 시작점이 매번 바뀌면 진행률이 흔들린다.
  //
  // **값마다 따로 찾는다.** 체중은 인바디의 필수 칸이지만 체지방률과 골격근량은
  // 비워둘 수 있다 — 가장 최근 줄에 체지방률이 없고 그 앞 줄에는 있을 수 있다.
  // 「가장 최근 줄」 하나에서 셋을 다 꺼내면 그런 사람은 시작값을 못 받는다.
  const latest = useMemo(() => {
    const out = {};
    for (const m of MEASURES) {
      const row = (records || []).find(r => Number(r?.[m.field]) > 0);
      out[m.key] = row ? Math.round(Number(row[m.field]) * 10) / 10 : null;
    }
    return out;
  }, [records]);

  const week = useMemo(() => weekProgress(workouts, goal, today), [workouts, goal, today]);
  const streak = useMemo(() => weekStreak(workouts, goal, today), [workouts, goal, today]);
  const history = useMemo(() => weekHistory(workouts, goal, today, 5), [workouts, goal, today]);
  // 재는 값 셋의 진행률. **쫓지 않는 값은 `null`** 이라 그 줄을 안 그린다
  const measures = useMemo(() => MEASURES.map((m) => ({
    m,
    p: measureProgress(records, {
      field: m.field,
      target: goal?.[m.targetKey],
      start: goal?.[m.startKey],
    }),
  })).filter(({ p }) => p), [records, goal]);
  // 「이대로면 언제」는 **체중만** 말한다. 체지방률·골격근량은 물 마신 것에도
  // 흔들려서, 4주 흐름으로 날을 집으면 지어낸 수가 된다 —
  // 「모르면 말하지 않는다」가 이 화면의 규칙이다
  const eta = useMemo(() => weightEta(records, goal, today), [records, goal, today]);

  const onSave = async (patch) => {
    // **넷을 다 봐야 한다** (2026-10-06). 둘만 보면 체지방률만 정한 사람의
    // 저장이 「접겠다」로 읽힌다
    const nothing = patch.weeklyTarget == null
      && MEASURES.every((m) => patch[m.targetKey] == null);
    if (nothing) {
      // 다 비운 것은 접겠다는 뜻이다. 조용히 지우지 않고 한 번 묻는다
      if (!goal) { toast('하나는 정해주세요', 'error'); return; }
      const yes = await confirmDialog('목표를 접을까요?', { confirmText: '접기', danger: true });
      if (!yes) return;
      setSaving(true);
      try {
        await clear();
        setEditing(false);
        toast('목표를 접었어요');
      } catch (err) {
        toast(err.response?.data?.error || '목표를 접지 못했어요', 'error');
      } finally { setSaving(false); }
      return;
    }

    setSaving(true);
    try {
      // **시작한 날은 처음 세울 때만 보낸다** (2026-09-18 에 고쳤다).
      //
      // 여태 고칠 때도 `startedAt: today` 를 같이 보냈다. 서버는 「이미 있으면
      // 안 건드린다」로 돼 있는데(`routes/goals.js`), 그건 **화면이 안 보낼 때**의
      // 이야기다 — 보내면 그 값으로 덮인다. 그래서 주 4회를 3회로 낮추기만 해도
      // 「언제부터 쫓고 있는가」가 오늘로 밀렸다.
      //
      // 아직 어느 화면도 이 값을 안 적는다. 그래서 눈에 안 보이는데, **눈에 안 보이는
      // 채로 계속 덮어쓰이면 그 값을 쓰기 시작하는 날 이미 다 틀려 있다.**
      // 처음 세우는 날짜를 화면이 보내는 이유는 그대로다 — 사람의 오늘과 서버의
      // 오늘이 다를 수 있다(시차)
      const payload = { ...patch };
      if (!goal?.startedAt) payload.startedAt = today;
      // **처음 세울 때만** 시작값을 박는다. 이미 쫓고 있으면 안 건드린다 —
      // 목표를 75에서 74로 낮췄다고 그동안 내려온 것이 없던 일이 되면 안 된다.
      // 셋을 같은 규칙으로 돈다 (`MEASURES`)
      for (const m of MEASURES) {
        const fresh = goal?.[m.startKey] == null || goal?.[m.targetKey] == null;
        if (patch[m.targetKey] != null && fresh && latest[m.key] != null) {
          payload[m.startKey] = latest[m.key];
        }
      }
      await save(payload);
      setEditing(false);
      toast(goal ? '목표를 고쳤어요' : '목표를 세웠어요');
    } catch (err) {
      toast(err.response?.data?.error || '목표를 저장하지 못했어요', 'error');
    } finally {
      setSaving(false);
    }
  };

  const onClear = async () => {
    const yes = await confirmDialog('목표를 접을까요? 지금까지 이어온 주는 기록에 그대로 남습니다.',
      { confirmText: '접기', danger: true });
    if (!yes) return;
    try {
      await clear();
      toast('목표를 접었어요');
    } catch (err) {
      toast(err.response?.data?.error || '목표를 접지 못했어요', 'error');
    }
  };

  const showForm = editing || (loaded && !hasGoal(goal));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
        <h1 style={{ fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif", fontSize: 26, letterSpacing: 2, color: 'var(--accent)', margin: 0 }}>
          내 목표
        </h1>
        {hasGoal(goal) && !editing && (
          <button
            onClick={() => setEditing(true)}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
          >
            고치기
          </button>
        )}
      </div>

      {!loaded && (
        <div className="card" style={{ color: 'var(--text-muted)', fontSize: 13 }}>불러오는 중…</div>
      )}

      {showForm && (
        <>
          {!hasGoal(goal) && !editing && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 14 }}>
              이 앱은 여태 <b style={{ color: 'var(--text-primary)' }}>한 것</b>만 보여줬습니다.
              목표를 하나 정해두면 「이번 주 3일」이 잘한 것인지 모자란 것인지를 앱이 말할 수 있습니다.
              <br />남과 겨루지 않습니다 — 겨루는 상대는 지난주의 나입니다.
            </p>
          )}
          <GoalForm
            goal={goal}
            latest={latest}
            onSave={onSave}
            onCancel={editing ? () => setEditing(false) : null}
            saving={saving}
          />
        </>
      )}

      {!editing && hasGoal(goal) && (
        <>
          {week && (
            <>
              <SectionTitle>이번 주</SectionTitle>
              <div className="card" style={{ marginBottom: 20, textAlign: 'center', padding: '18px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <GoalRing
                    size={112}
                    stroke={9}
                    ratio={week.ratio}
                    done={week.met}
                    main={`${week.done}/${week.target}`}
                    sub={`주 ${week.target}회`}
                  />
                </div>
                <div className="serif-display" style={{ fontSize: 16, marginTop: 13 }}>{weekLine(week)}</div>
              </div>

              <SectionTitle>이어온 주</SectionTitle>
              <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                  <span>
                    <span style={{ fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif", fontSize: 26, letterSpacing: 1.5, color: 'var(--accent)' }}>
                      {streak?.current ?? 0}
                    </span>
                    <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}> 주 연속</span>
                  </span>
                  {streak?.best > 0 && (
                    <span className="badge badge-success">가장 길게는 {streak.best}주</span>
                  )}
                </div>

                {/* ── 최근 다섯 주 ── (2026-09-19 에 다시 그렸다)
                    여태 **세 가지가 다 비슷하게 보였다.** 채운 주는 밝은 금, 못 채운 주는
                    어두운 금 — 어두운 바탕에서 이 둘은 거의 안 갈린다. 그래서 0주 연속인데
                    막대는 채워진 것처럼 보였다(9/19 에 그 화면을 보고 찾았다).

                    이제 **모양**으로 가른다 — 색은 눈이 속지만 모양은 안 속는다:
                      · 채운 주       꽉 찬 금 + 윗변에 마감 한 줄
                      · 못 채운 주    **속을 비우고 테두리만** (윤곽은 있는데 안 찼다)
                      · 목표 전       바닥에 낮은 선 (평가하지 않는 주다)
                      · 이번 주       막대 **아래 금색 2px 밑줄** + 「이번 주」

                    이번 주에 점선을 안 쓴 이유 — 46px 짜리 막대에서 점선은 흐려 보이고,
                    이 앱은 「지금 여기」를 **탭바의 2px 금 바**로 말해 왔다. 같은 말을 쓴다.

                    **숫자를 아래에 적는다.** 여태 몇 일 했는지는 마우스를 올려야 떴는데,
                    폰에는 올릴 마우스가 없다 */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                  {history.map((w) => {
                    const pct = Math.max(12, Math.round(w.ratio * 100));
                    const shape = w.before
                      ? { height: 4, background: 'var(--bg-tertiary)' }
                      : w.met
                        ? { height: `${pct}%`, background: 'var(--accent)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.35)' }
                        : { height: `${pct}%`, background: 'var(--accent-dim)', border: '1px solid var(--accent-low)' };
                    return (
                      <div
                        key={w.monday}
                        style={{ flex: 1, textAlign: 'center', minWidth: 0 }}
                        title={w.before
                          ? `${w.monday} 주 · 목표를 세우기 전이에요`
                          : `${w.monday} 주 · ${w.done}일${w.met ? ' · 채웠어요' : ''}`}
                      >
                        <div style={{ height: 46, display: 'flex', alignItems: 'flex-end' }}>
                          <div style={{ width: '100%', borderRadius: 'var(--radius)', ...shape }} />
                        </div>
                        {/* 이번 주 밑줄 — 탭바의 활성 표시와 같은 말이다 */}
                        <div style={{
                          height: 2, marginTop: 4, borderRadius: 1,
                          background: w.current ? 'var(--accent)' : 'transparent',
                        }} />
                        <div style={{
                          fontSize: 10.5, marginTop: 3,
                          color: w.met ? 'var(--accent)' : 'var(--text-muted)',
                          fontFamily: w.before ? 'inherit' : "'Bebas Neue', 'IBM Plex Sans KR', sans-serif",
                          letterSpacing: w.before ? 0 : 0.5,
                        }}>{w.before ? '·' : w.done}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.6 }}>
                  최근 {history.length}주 · 맨 오른쪽(<span style={{ color: 'var(--accent)' }}>밑줄</span>)이 이번 주
                  <br />
                  꽉 찬 금은 채운 주 · 테두리만 있는 것은 못 채운 주
                  {history.some((w) => w.before) && ' · 낮은 선은 목표를 세우기 전'}
                </div>
              </div>
            </>
          )}

          {/* ── 몸 ── (2026-10-06 에 체중 하나에서 셋으로)
              **카드를 셋 더하지 않는다.** 같은 이야기(몸이 어떻게 변했나)라
              한 카드 안에 줄로 쌓는다 — 카드가 셋이면 화면이 또 길어지고,
              셋이 서로 상관없는 것처럼 보인다 */}
          {measures.length > 0 && (
            <>
              <SectionTitle>몸</SectionTitle>
              <div className="card" style={{ marginBottom: 20 }}>
                {measures.map(({ m, p }, i) => (
                  <div key={m.key} style={{
                    paddingTop: i === 0 ? 0 : 13,
                    marginTop: i === 0 ? 0 : 13,
                    borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                  }}>
                    <div className="label" style={{ marginBottom: 7 }}>{m.label}</div>
                    {p.now == null ? (
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                        목표는 {p.target}{m.unit} 입니다. 「몸 → 인바디」에 {m.label}을 한 번 적으면
                        여기에 진행률이 그려집니다.
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 9 }}>
                          <span style={{ fontSize: 14 }}>
                            {p.now} <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>→</span>{' '}
                            <span style={{ color: 'var(--accent)' }}>{p.target}{m.unit}</span>
                          </span>
                          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                            {p.reached ? '닿았습니다' : `${p.left}${m.unit} 남음`}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div className="progress-bg" style={{ flexGrow: 1 }}>
                            <div className="progress-fill" style={{
                              width: `${Math.round(p.ratio * 100)}%`,
                              background: p.reached ? 'var(--success)' : 'var(--accent)',
                            }} />
                          </div>
                          <span style={{ width: 32, textAlign: 'right', fontSize: 11.5, color: 'var(--text-muted)' }}>
                            {Math.round(p.ratio * 100)}%
                          </span>
                        </div>
                        {/* **모르면 말하지 않는다.** 흐름이 목표와 반대거나 너무 멀면
                            `weightEta` 가 null 을 준다 — 지어낸 수를 한 번 보여주면
                            그 뒤의 모든 수를 못 믿게 된다.
                            **체중만 말한다** — 체지방률·골격근량은 물 마신 것에도
                            흔들려서 4주 흐름으로 날을 집으면 그게 지어낸 수다 */}
                        {m.key === 'weight' && eta && (
                          <div style={{ fontSize: 11.5, color: 'var(--success)', marginTop: 9 }}>
                            이대로면 {eta.label}에 닿습니다 (요즘 주 {Math.abs(eta.perWeek)}kg)
                          </div>
                        )}
                        {!(m.key === 'weight' && eta) && p.away && (
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 9 }}>
                            시작했을 때보다 목표에서 멀어져 있습니다
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 9 }}>
                          시작 {p.start}{m.unit} · 마지막 기록 {p.lastDate}
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {/* **체중이 그대로여도 몸은 변한다** — 이 앱이 하려는 말이고,
                    셋을 나란히 놓으면 그 말이 수로 보인다. 둘 이상 쫓는 사람에게만
                    적는다 (하나만 쫓는 사람에게는 견줄 것이 없다) */}
                {measures.length > 1 && (
                  <div style={{
                    fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.75,
                    marginTop: 13, paddingTop: 12, borderTop: '1px solid var(--border)',
                  }}>
                    체중이 그대로여도 체지방률과 골격근량은 움직입니다 —
                    그게 <span style={{ color: 'var(--accent-low)' }}>무엇이 늘었는지</span>입니다.
                  </div>
                )}
              </div>
            </>
          )}

          <button
            onClick={onClear}
            style={{
              width: '100%', padding: 12, background: 'none', border: '1px solid var(--border)',
              color: 'var(--text-muted)', fontSize: 12.5, borderRadius: 'var(--radius)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            목표 접기
          </button>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
            접어도 기록은 그대로 남습니다
          </div>
        </>
      )}

      <button
        onClick={() => navigate('/home')}
        style={{
          width: '100%', marginTop: 20, padding: 12, background: 'none', border: 'none',
          color: 'var(--text-muted)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        ‹ 오늘로
      </button>
    </div>
  );
}
