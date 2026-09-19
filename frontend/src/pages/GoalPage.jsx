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
  weightProgress, weightEta,
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
// **비워둘 수 있다.** 둘 중 하나만 쫓는 사람이 있다 (주 횟수만, 또는 체중만).
// 둘 다 비우면 목표를 접는 것과 같아서, 그때는 접겠느냐고 묻는다.
function GoalForm({ goal, latestWeight, onSave, onCancel, saving }) {
  const [weekly, setWeekly] = useState(goal?.weeklyTarget ?? null);
  const [weight, setWeight] = useState(goal?.weightTarget != null ? String(goal.weightTarget) : '');

  const submit = (e) => {
    e.preventDefault();
    const w = weight.trim();
    const num = w === '' ? null : Number(w);
    if (num !== null && (!Number.isFinite(num) || num < 20 || num > 300)) {
      toast('체중 목표는 20~300kg 사이로 적어주세요', 'error');
      return;
    }
    onSave({ weeklyTarget: weekly, weightTarget: num === null ? null : Math.round(num * 10) / 10 });
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
                flex: '1 0 38px', padding: '9px 0', fontFamily: "'Bebas Neue', sans-serif",
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

      <div className="label" style={{ marginBottom: 9 }}>체중 목표</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
        <input
          className="input"
          type="number"
          inputMode="decimal"
          step="0.1"
          min="20"
          max="300"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder={latestWeight != null ? String(latestWeight) : '75'}
          style={{ flexGrow: 1 }}
        />
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', flexShrink: 0 }}>kg</span>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 18 }}>
        {latestWeight != null
          ? `지금 ${latestWeight}kg 에서 시작합니다`
          : '몸 → 인바디에 체중을 한 번 적으면 진행률이 그려집니다'}
      </div>

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

  // 목표를 세울 때 박아둘 시작 체중. **지금 값이다** —
  // 진행률을 「시작에서 얼마나 왔나」로 재는데, 시작점이 매번 바뀌면 진행률이 흔들린다
  const latestWeight = useMemo(() => {
    const rows = (records || []).filter(r => Number(r?.weight) > 0);
    if (rows.length === 0) return null;
    // 인바디 목록은 최신이 앞이다 (다른 화면들과 같은 가정)
    return Math.round(Number(rows[0].weight) * 10) / 10;
  }, [records]);

  const week = useMemo(() => weekProgress(workouts, goal, today), [workouts, goal, today]);
  const streak = useMemo(() => weekStreak(workouts, goal, today), [workouts, goal, today]);
  const history = useMemo(() => weekHistory(workouts, goal, today, 5), [workouts, goal, today]);
  const body = useMemo(() => weightProgress(records, goal), [records, goal]);
  const eta = useMemo(() => weightEta(records, goal, today), [records, goal, today]);

  const onSave = async (patch) => {
    if (patch.weeklyTarget == null && patch.weightTarget == null) {
      // 둘 다 비운 것은 접겠다는 뜻이다. 조용히 지우지 않고 한 번 묻는다
      if (!goal) { toast('둘 중 하나는 정해주세요', 'error'); return; }
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
      // 체중 목표를 **처음 세울 때만** 시작 체중을 박는다. 이미 쫓고 있으면
      // 안 건드린다 — 목표를 75에서 74로 낮췄다고 그동안 내려온 것이 없던 일이 되면 안 된다
      if (patch.weightTarget != null && (goal?.weightStart == null || goal?.weightTarget == null)) {
        if (latestWeight != null) payload.weightStart = latestWeight;
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
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: 2, color: 'var(--accent)', margin: 0 }}>
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
            latestWeight={latestWeight}
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
                    <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: 1.5, color: 'var(--accent)' }}>
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
                          fontFamily: w.before ? 'inherit' : "'Bebas Neue', sans-serif",
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

          {body && (
            <>
              <SectionTitle>체중</SectionTitle>
              <div className="card" style={{ marginBottom: 20 }}>
                {body.now == null ? (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                    목표는 {body.target}kg 입니다. 「몸 → 인바디」에 체중을 한 번 적으면
                    여기에 진행률이 그려집니다.
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 9 }}>
                      <span style={{ fontSize: 14 }}>
                        {body.now} <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>→</span>{' '}
                        <span style={{ color: 'var(--accent)' }}>{body.target}kg</span>
                      </span>
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        {body.reached ? '닿았습니다' : `${body.left}kg 남음`}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div className="progress-bg" style={{ flexGrow: 1 }}>
                        <div className="progress-fill" style={{
                          width: `${Math.round(body.ratio * 100)}%`,
                          background: body.reached ? 'var(--success)' : 'var(--accent)',
                        }} />
                      </div>
                      <span style={{ width: 32, textAlign: 'right', fontSize: 11.5, color: 'var(--text-muted)' }}>
                        {Math.round(body.ratio * 100)}%
                      </span>
                    </div>
                    {/* **모르면 말하지 않는다.** 흐름이 목표와 반대거나 너무 멀면
                        `weightEta` 가 null 을 준다 — 지어낸 수를 한 번 보여주면
                        그 뒤의 모든 수를 못 믿게 된다 */}
                    {eta && (
                      <div style={{ fontSize: 11.5, color: 'var(--success)', marginTop: 9 }}>
                        이대로면 {eta.label}에 닿습니다 (요즘 주 {Math.abs(eta.perWeek)}kg)
                      </div>
                    )}
                    {!eta && body.away && (
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 9 }}>
                        시작했을 때보다 목표에서 멀어져 있습니다
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 9 }}>
                      시작 {body.start}kg · 마지막 기록 {body.lastDate}
                    </div>
                  </>
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
