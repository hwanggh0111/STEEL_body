import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGymStore } from '../store/gymStore';
import { useRefreshTick } from '../store/refreshStore';
import { toast } from '../components/Toast';
import { confirmDialog } from '../components/ConfirmModal';
import NavIcon from '../components/NavIcon';
import { filledSlots, GYM_MAX } from '../data/gymSetting';

// 「기구」 탭.
//
// 기구 세팅은 처음에 「운동」 화면 안에만 뒀다. 그런데 그러면 **운동을 고른 뒤에야
// 보인다** — 「내가 뭘 적어뒀더라」를 보려면 운동을 하나씩 골라봐야 했다.
// 적어둔 것을 한눈에 볼 자리가 없으면 **적어둘 마음도 안 생긴다.**
//
// 그래서 탭을 하나 늘렸다. 탭을 늘리는 것은 이 앱이 계속 거절해 온 일인데
// (길이 여러 벌이 된다), 여기서는 둘이 **같은 것을 다르게 묻는다** —
//   · 「운동」 안의 카드: 지금 이 기구를 어떻게 맞추지?  (하나)
//   · 이 탭:            내가 무엇을 적어뒀지?          (전부)
//
// **여기서는 고치지 않는다.** 고치는 자리는 기구 앞이다 — 목록에서 누르면
// 그 운동을 들고 「운동」으로 데려간다. 두 곳에서 고칠 수 있으면 폼이 두 벌이 되고,
// 두 벌이 되면 한쪽만 고쳐지는 날이 온다. **지우는 것만 여기서 한다** (목록의 일이다).
//
// ── 2026-10-06 에 고친 것 셋 ──
//
// **1. 방금 만든 곳이 목록에서 사라졌다.** 「+ 다른 곳」으로 「강남점」을 적으면
// 그것이 지금 있는 곳이 된다. 그런데 칩 줄은 서버가 주는 `gyms` 를 그리고, 그것은
// **세팅에서 뽑는다**(`db.getGyms` — 목록을 따로 들고 있으면 세팅을 다 지운
// 헬스장이 목록에만 남으니 그 판단은 맞다). 그래서 **세팅이 0개인 「강남점」은
// 칩 줄에 없다** — 아래 설명은 「지금 강남점 기준입니다」라고 하는데 그 이름의
// 칩이 없다. 다른 곳으로 옮기면 **돌아올 길이 없어 똑같이 다시 쳐야 했다.**
// 지금 고른 곳이 `gyms` 에 없으면 **그것도 칩으로 그린다.**
//
// **2. 안 골랐을 때 내 세팅이 전부 흐려졌다.** 흐림은 「지금 있는 곳이 아니다」라는
// 뜻인데, 안 골랐을 때는 **어디가 지금인지 모르는 것**이지 아니라는 뜻이 아니다.
// 안 골랐으면 흐리지 않고, 머리말도 「다른 곳」이 아니라 곳 이름으로 적는다.
//
// **3. 곳을 통째로 지울 길이 없었다.** 옮긴 헬스장을 치우려면 세팅을 하나씩
// 지워야 했다 — 열두 개면 열두 번이고, 하나라도 남기면 그 곳이 칩 줄에 계속 뜬다.

function Empty({ onGo }) {
  return (
    <div className="empty-state" style={{ padding: '44px 16px' }}>
      <div className="empty-state-title" style={{ fontSize: 28, letterSpacing: 3 }}>아직 적어둔 것이 없어요</div>
      <div className="empty-state-desc" style={{ lineHeight: 1.8, maxWidth: 360, margin: '0 auto' }}>
        시트 몇 번, 발판 몇 칸, 그립 어디 — 기구 앞에서 매번 다시 맞추는 그것을 적어둡니다.
        한 번만 적으면 다음부터 그 운동을 고를 때 저절로 뜹니다.
      </div>
      <button className="btn-primary" style={{ marginTop: 20, minWidth: 180 }} onClick={onGo}>
        운동 고르러 가기
      </button>
    </div>
  );
}

// 한 곳을 통째로 치우는 줄 (2026-10-06).
//
// **목록 아래에 작게 둔다.** 「지우기」를 줄마다 두고 이것까지 위에 올리면, 세팅
// 하나를 지우려다 **곳을 통째로** 지우는 일이 생긴다. 하는 일의 크기가 다르면
// 자리도 달라야 한다.
//
// **몇 개가 사라지는지 숫자로 적는다.** 「강남점을 지울까요」만 물으면 그 안에
// 열두 개가 들었는지 알 수 없다 — 되돌릴 수 없는 일에서는 크기가 곧 경고다.
function GymClear({ name, count, onClear }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
      <button
        onClick={() => onClear(name, count)}
        style={{
          background: 'none', border: 'none', padding: '4px 2px', fontFamily: 'inherit',
          fontSize: 11.5, color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline',
        }}
      >{name} 세팅 {count}개 통째로 지우기</button>
    </div>
  );
}

export default function GymPage() {
  const navigate = useNavigate();
  const gym = useGymStore((s) => s.gym);
  const setGym = useGymStore((s) => s.setGym);
  const gyms = useGymStore((s) => s.gyms);
  const all = useGymStore((s) => s.settings);
  const loaded = useGymStore((s) => s.loaded);
  const fetch = useGymStore((s) => s.fetch);
  const failed = useGymStore((s) => s.failed);
  const remove = useGymStore((s) => s.remove);
  const removeGym = useGymStore((s) => s.removeGym);

  const refreshTick = useRefreshTick();
  useEffect(() => { fetch(); }, [refreshTick]);

  const [adding, setAdding] = useState(false);
  const [gymInput, setGymInput] = useState('');

  // 지금 고른 헬스장 것과 나머지를 가른다.
  // **다른 곳 것도 보여준다** — 「저쪽에서는 몇 번이었지」가 실제로 궁금한 순간이 있다
  const here = useMemo(() => all.filter((s) => s.gym === gym), [all, gym]);

  // 칩 줄에 그릴 곳. **지금 고른 곳이 서버 목록에 없으면 더한다** —
  // 방금 만들어 세팅이 0개인 곳이 그렇다(위 머리 주석 1번)
  const chips = useMemo(() => {
    if (!gym || gyms.some((g) => g.name === gym)) return gyms;
    return [{ name: gym, settings: 0, fresh: true }, ...gyms];
  }, [gyms, gym]);
  const elsewhere = useMemo(() => {
    const rest = all.filter((s) => s.gym !== gym);
    const byGym = new Map();
    for (const s of rest) {
      if (!byGym.has(s.gym)) byGym.set(s.gym, []);
      byGym.get(s.gym).push(s);
    }
    return [...byGym.entries()];
  }, [all, gym]);

  const onRemove = async (s) => {
    const yes = await confirmDialog(`${s.gym}의 ${s.exercise} 세팅을 지울까요?`,
      { confirmText: '지웁니다', danger: true });
    if (!yes) return;
    try {
      await remove(s.gym, s.exercise);
      toast('지웠어요');
    } catch (err) {
      toast(err.response?.data?.error || '지우지 못했어요', 'error');
    }
  };

  // 한 곳을 통째로 치운다.
  //
  // **숫자를 물음에 넣는다** — 되돌릴 수 없는 일에서는 크기가 곧 경고다.
  // 그리고 **몇 개가 지워졌는지 서버가 센 수로** 말한다: 화면이 든 수와 서버의
  // 수가 다를 수 있다(다른 기기에서 지웠을 수 있다).
  const onClearGym = async (name, count) => {
    const yes = await confirmDialog(
      `${name}에 적어둔 세팅 ${count}개를 다 지웁니다.\n\n운동 기록은 그대로 남습니다 — 지워지는 것은 「시트 몇 번 · 발판 몇 칸」 같은 기구 세팅뿐입니다.`,
      { title: `${name}을 치울까요`, confirmText: '다 지우기', danger: true },
    );
    if (!yes) return;
    try {
      const removed = await removeGym(name);
      toast(`${name} 세팅 ${removed}개를 지웠어요`);
    } catch (err) {
      toast(err.response?.data?.error || '지우지 못했어요', 'error');
    }
  };

  // 누르면 **그 운동을 들고 「운동」으로** 간다. 고치는 자리는 기구 앞이다.
  // 주소에 실어 보낸다 — `/train?q=` 는 로그인 화면을 거쳐도 남는 길이다
  const openIn = (s) => navigate(`/train?q=${encodeURIComponent(s.exercise)}`);

  const Row = ({ s, dim }) => (
    <div
      className="card clickable"
      role="button"
      tabIndex={0}
      onClick={() => openIn(s)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openIn(s); } }}
      style={{ marginBottom: 9, opacity: dim ? 0.72 : 1 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        {/* **요약 줄을 뺐다** (캡처로 잡았다). 아래 칸 칩이 이미 「시트 3 · 발판 넓게」를
            그리는데 그 위에 같은 말을 한 줄 더 적고 있었다 — 같은 것을 두 번 그리지 않는다.
            칸이 하나도 없고 한마디만 적은 줄은 아래에서 한마디가 그 자리를 대신한다 */}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14.5, color: 'var(--text-primary)' }}>{s.exercise}</div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(s); }}
          aria-label={`${s.exercise} 세팅 지우기`}
          style={{
            flexShrink: 0, background: 'none', border: '1px solid var(--border)',
            color: 'var(--text-muted)', fontSize: 11.5, padding: '6px 10px',
            borderRadius: 'var(--radius)', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >지우기</button>
      </div>
      {s.note && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.7 }}>
          「{s.note}」
        </div>
      )}
      {/* 칸을 숫자로 한 번 더 보여준다 — 목록에서 바로 읽고 갈 수 있게 */}
      {filledSlots(s).length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {filledSlots(s).map((f) => (
            <span key={f.key} style={{
              fontSize: 11.5, color: 'var(--text-secondary)',
              background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '3px 9px',
            }}>{f.label} {f.value}</span>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div className="section-title">
        <div className="accent-bar" />
        기구
      </div>

      {/* **못 불러온 것과 없는 것은 다르다.** 여기가 없으면 화면이 「불러오는 중…」에
          영영 멈춰 선다 — 신호가 끊겼든 서버가 거절했든 사람은 기다리기만 한다.
          캡처를 뽑다가 레이트 리밋(429)에 걸려 실제로 그 화면을 봤다 (2026-09-17) */}
      {!loaded && failed && (
        <div className="card" style={{ borderLeft: '3px solid var(--warning)' }}>
          <div style={{ fontSize: 13.5, color: 'var(--text-primary)', marginBottom: 4 }}>
            적어둔 세팅을 못 불러왔어요
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
            신호가 끊겼거나 서버가 잠깐 바쁜 것일 수 있어요. 적어둔 것은 그대로 있습니다.
          </div>
          <button className="btn-primary" style={{ fontSize: 14 }} onClick={() => fetch(true)}>
            다시 받기
          </button>
        </div>
      )}
      {!loaded && !failed && (
        <div className="card" style={{ color: 'var(--text-muted)', fontSize: 13 }}>불러오는 중…</div>
      )}

      {loaded && (
        <>
          {/* ── 지금 어디인가 ── */}
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="label" style={{ marginBottom: 9 }}>지금 있는 곳</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: gyms.length ? 10 : 0 }}>
              {chips.map((g) => {
                const on = g.name === gym;
                return (
                  <button
                    key={g.name}
                    onClick={() => setGym(on ? '' : g.name)}
                    style={{
                      minHeight: 40, padding: '0 13px', fontFamily: 'inherit', fontSize: 13,
                      background: on ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
                      border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                      color: on ? 'var(--accent)' : 'var(--text-muted)',
                      borderRadius: 'var(--radius)', cursor: 'pointer',
                    }}
                  >
                    {g.name}
                    {/* **0 을 적지 않는다.** 방금 만든 곳에 「0」이 붙으면 뭐가
                        잘못된 것처럼 보인다 — 적어둘 것이 아직 없는 것뿐이다 */}
                    {g.settings > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>{g.settings}</span>
                    )}
                  </button>
                );
              })}
              {!adding && (
                <button
                  onClick={() => setAdding(true)}
                  style={{
                    minHeight: 40, padding: '0 13px', fontFamily: 'inherit', fontSize: 13,
                    background: 'none', border: '1px dashed var(--border-hover)',
                    color: 'var(--text-muted)', borderRadius: 'var(--radius)', cursor: 'pointer',
                  }}
                >+ 다른 곳</button>
              )}
            </div>

            {adding && (
              // `.btn-primary` 는 `width: 100%` 다 — flex 줄 안에서는 되돌려야 넘치지 않는다
              <div style={{ display: 'flex', gap: 7, marginBottom: 10 }}>
                <input
                  className="input"
                  value={gymInput}
                  onChange={(e) => setGymInput(e.target.value)}
                  placeholder="예: 강남점 · 집 앞"
                  maxLength={GYM_MAX}
                  style={{ flexGrow: 1, minWidth: 0 }}
                  autoFocus
                />
                <button
                  className="btn-primary"
                  disabled={!gymInput.trim()}
                  onClick={() => { setGym(gymInput.trim()); setGymInput(''); setAdding(false); }}
                  style={{ flexShrink: 0, width: 'auto', padding: '11px 16px', fontSize: 15, whiteSpace: 'nowrap' }}
                >여기로</button>
              </div>
            )}

            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.7 }}>
              {gym
                ? <>지금 <span style={{ color: 'var(--accent)' }}>{gym}</span> 기준입니다 · 이 기기에만 남습니다</>
                : '고르면 「운동」 화면에서 그곳 세팅이 뜹니다'}
            </div>
          </div>

          {/* ── 여기 세팅 ── */}
          {all.length === 0 ? (
            <Empty onGo={() => navigate('/train')} />
          ) : (
            <>
              {gym && (
                <>
                  <div className="section-title">
                    <div className="accent-bar" />
                    {gym}
                  </div>
                  {here.length === 0 ? (
                    <div className="card" style={{ marginBottom: 18, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.75 }}>
                      여기 적어둔 것이 아직 없어요.
                      「운동」에서 운동을 고르면 그 자리에서 적을 수 있습니다.
                    </div>
                  ) : (
                    <>
                      <div style={{ marginBottom: 10 }}>
                        {here.map((s) => <Row key={`${s.gym}#${s.exercise}`} s={s} />)}
                      </div>
                      <GymClear name={gym} count={here.length} onClear={onClearGym} />
                    </>
                  )}
                </>
              )}

              {/* ── 다른 곳 ──
                  「저쪽에서는 몇 번이었지」가 실제로 궁금한 순간이 있다.
                  흐리게 둔다 — 지금 있는 곳이 아니라는 것이 한눈에 보여야 한다 */}
              {/* 안 골랐으면 **흐리지 않는다.** 흐림은 「지금 있는 곳이 아니다」인데,
                  안 골랐을 때는 어디가 지금인지 **모르는 것**이지 아니라는 뜻이 아니다 */}
              {elsewhere.map(([name, list]) => (
                <div key={name}>
                  <div className="section-title">
                    <div className="accent-bar" style={{ background: gym ? 'var(--border-hover)' : 'var(--accent)' }} />
                    <span style={{ color: gym ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{name}</span>
                    {gym && (
                      <button
                        onClick={() => setGym(name)}
                        style={{
                          marginLeft: 'auto', background: 'none', border: 'none',
                          color: 'var(--accent)', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit', padding: 0,
                        }}
                      >여기로 옮기기</button>
                    )}
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    {list.map((s) => <Row key={`${s.gym}#${s.exercise}`} s={s} dim={!!gym} />)}
                  </div>
                  <GymClear name={name} count={list.length} onClear={onClearGym} />
                </div>
              ))}
            </>
          )}

          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 4,
            fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.75,
          }}>
            <span style={{ flexShrink: 0, marginTop: 2 }}><NavIcon name="wrench" size={14} /></span>
            <span>
              줄을 누르면 그 운동을 들고 「운동」으로 갑니다 — <b style={{ color: 'var(--text-secondary)' }}>고치는 자리는 기구 앞</b>입니다.
              위치는 안 봅니다. 헬스장 이름만 고르면 됩니다.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
