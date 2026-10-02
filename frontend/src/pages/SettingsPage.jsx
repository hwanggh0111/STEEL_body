import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRestTimerStore, PRESETS } from '../store/restTimerStore';
import { useSettingsStore, BREATH_WHERE, BREATH_MAX, BREATH_SENSE } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { VOLUMES, previewTone, allTones, setExtraTones } from '../data/alertSound';
import { loadTones, saveTones } from '../data/customTones';
import ToneMaker from '../components/ToneMaker';
import { micSupported } from '../data/useBreath';
import { speechSupported } from '../data/voiceLog';
import { canLock, isLockSet } from '../data/appLock';
import { reminderRow } from '../data/reminderLabel';
import { canNotify, notifyPermission } from '../data/pushSupport';
import { useGymStore } from '../store/gymStore';
import { confirmDialog } from '../components/ConfirmModal';
import { removeLS, readLS } from '../data/safeStorage';
import { SHAPE_LOG_KEY, SHAPE_RATIOS_KEY } from '../data/localKeys';
import pkg from '../../package.json';
// 셋 다 **열 때 받는다.** 설정을 보러 온 사람이 다 누르는 것이 아니다 —
// 비밀번호를 바꾸거나 계정을 지우는 일은 몇 달에 한 번이다
const LockSetup = lazy(() => import('../components/LockSetup'));
const PasswordChangeModal = lazy(() => import('../components/PasswordChangeModal'));
const AccountDeleteModal = lazy(() => import('../components/AccountDeleteModal'));
import { leaveApp } from '../data/leaveApp';
import client from '../api/client';
import BreathCheck from '../components/BreathCheck';
import NavIcon from '../components/NavIcon';
import { toast } from '../components/Toast';

// 설정함 (2026-09-22).
//
// ── 왜 만들었나 ──
//
// 설정이 **일곱 군데에 흩어져 있었다.** 휴식 타이머 소리를 바꾸려면 운동을 시작해
// 타이머를 띄워야 했고, 「숨 보고 쉬기」는 홈트에서 기능성을 고른 뒤에만 있었다.
// 화면 켜두기와 목소리로 적기는 **끌 길이 아예 없었고**, 성별은 인바디에서 한 번 묻고
// 나면 다시 바꿀 수 없었다.
//
// ── 기어 하나에 전부 ──
//
// 설정인 것은 **하나도 밖에 안 남긴다** — 앱 잠금 · 운동 알림 · 기록 챙기기까지
// 여기 들어온다. 「그건 저기 있어요」로 미루면 사람은 **그 기능이 없다고** 생각한다.
//
// **옛 자리도 살려둔다.** 계정 시트의 앱 잠금, 고객센터의 내려받기는 그대로 둔다 —
// 쓰던 사람이 다시 찾게 만들 이유가 없다. **같은 값을 두 자리에서 보여줄 뿐,
// 두 벌로 만들지는 않는다** (값은 늘 한 스토어에만 있다).
//
// ── 안 되는 것은 안 그린다 ──
//
// 목소리로 적기는 크롬 계열에서만 되고, 숨은 마이크가 있어야 한다.
// **눌러도 아무 일이 안 일어나는 스위치를 두지 않는다** — 안 되는 자리에서는
// 까닭을 적거나 아예 안 그린다.

/** 켜고 끄는 한 줄. */
function Toggle({ title, desc, on, onChange, disabled, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '11px 0', borderTop: '1px solid var(--border)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: disabled ? 'var(--text-muted)' : 'var(--text-primary)' }}>{title}</div>
        {desc && (
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 2 }}>{desc}</div>
        )}
        {children}
      </div>
      <button
        onClick={() => !disabled && onChange(!on)}
        disabled={disabled}
        role="switch"
        aria-checked={!!on}
        aria-label={title}
        style={{
          flexShrink: 0, width: 44, height: 25, borderRadius: 13, marginTop: 2,
          position: 'relative', cursor: disabled ? 'default' : 'pointer',
          border: `1px solid ${on ? 'var(--accent)' : 'var(--border-hover)'}`,
          background: on ? 'var(--accent-dim)' : 'var(--bg-primary)',
          opacity: disabled ? 0.45 : 1,
          transition: 'border-color 0.15s, background-color 0.15s',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: on ? 21 : 2,
          width: 19, height: 19, borderRadius: '50%',
          background: on ? 'var(--accent)' : 'var(--text-muted)',
          transition: 'left 0.15s',
        }} />
      </button>
    </div>
  );
}

/** 몇 개 중 하나 고르기. */
function Pick({ items, value, onPick, idOf = (x) => x.id, nameOf = (x) => x.name }) {
  return (
    <div className="filter-row" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
      {items.map((it) => {
        const id = idOf(it);
        const on = String(id) === String(value);
        return (
          <button
            key={id}
            onClick={() => onPick(id)}
            aria-pressed={on}
            style={{
              minHeight: 34, padding: '6px 12px', borderRadius: 6, fontSize: 12,
              fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
              border: `1px solid ${on ? 'var(--accent)' : 'var(--border-hover)'}`,
              background: on ? 'var(--accent-dim)' : 'none',
              color: on ? 'var(--accent)' : 'var(--text-secondary)',
            }}
          >{nameOf(it)}</button>
        );
      })}
    </div>
  );
}

/** 무리 하나. */
function Group({ title, children }) {
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif", fontSize: 11.5, letterSpacing: 1.8,
        color: 'var(--accent)', marginBottom: 10,
      }}>{title}</div>
      {children}
    </div>
  );
}

/** 다른 화면으로 보내는 한 줄. 지금 값을 같이 적는다. */
function GoRow({ title, sub, warn, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '11px 0',
        // `border: 'none'` 을 뒤에 두면 위 줄을 지운다 — 테두리는 **위쪽만** 두른다
        background: 'none', border: 'none', borderTop: '1px solid var(--border)',
        fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
      }}
    >
      <span style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>{title}</span>
      {sub && (
        <span style={{ fontSize: 11.5, color: warn ? 'var(--warning)' : 'var(--text-muted)' }}>· {sub}</span>
      )}
      <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 13 }}>›</span>
    </button>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  // ── 운동 알림 줄에 사실을 적는다 (2026-09-30) ──
  //
  // 그 줄은 「시간 정하기」로 박혀 있었다 — 켜졌는지 · 막혔는지 · 서버가 보낼 수 있는지를
  // 하나도 안 알려줬다. 바로 옆 「앱 잠금」은 켜짐/꺼짐을 말하고, 그 칸 머리에는
  // 「알림은 왜 안 되는지 적는다」고 적혀 있었다 — **적고 있지 않았다.**
  //
  // 판단은 `data/reminderLabel.js` 의 `reminderRow` 가 한다(검사가 값으로 본다).
  // 여기는 **사실 셋을 모아 넘기는 일**만 한다.
  const [rem, setRem] = useState({ loaded: false, settings: null, serverReady: null });
  const [lockOpen, setLockOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [nickEdit, setNickEdit] = useState(false);
  const [nickDraft, setNickDraft] = useState('');
  const [savingNick, setSavingNick] = useState(false);
  // ── 아이디 (2026-10-02) ──
  //
  // 아이디는 **서버에만 있다** — 이름처럼 스토어에 들고 다니지 않는다. 그래서
  // 이 화면이 열릴 때 한 번 물어본다(`/auth/me`). 못 받아오면 줄을 안 그린다 —
  // 모르는 값을 빈칸으로 그려놓으면 「아이디가 없는 계정」처럼 보인다.
  const [acct, setAcct] = useState({ loaded: false, username: '', changedAt: null });
  const [idEdit, setIdEdit] = useState(false);
  const [idDraft, setIdDraft] = useState('');
  const [idMsg, setIdMsg] = useState(null);     // { ok, text }
  const [idChecking, setIdChecking] = useState(false);
  const [savingId, setSavingId] = useState(false);
  const idTimer = useRef(null);
  useEffect(() => () => { if (idTimer.current) clearTimeout(idTimer.current); }, []);
  // 만든 소리는 브라우저에서 읽는다. **읽자마자 재생 쪽에 얹는다** —
  // 안 얹으면 고른 소리가 목록에는 있는데 안 울린다
  const [myTones, setMyTones] = useState(() => {
    const list = loadTones();
    setExtraTones(list);
    return list;
  });

  // ── 필요한 것만 구독한다 (2026-09-22) ──
  //
  // 처음에는 `useRestTimerStore()` 를 통째로 구독했다. 그런데 그 스토어는 휴식이
  // 도는 동안 **250ms 마다 `leftMs` 를 바꾼다** — 설정 화면이 열려 있으면
  // 초당 네 번씩 통째로 다시 그려진다. 스위치 열일곱과 고르개 스물이 전부.
  //
  // 값 하나씩 고른다. 그러면 남은 초가 바뀌어도 여기는 안 움직인다.
  const sound = useRestTimerStore((st) => st.sound);
  const vibrate = useRestTimerStore((st) => st.vibrate);
  const autoStart = useRestTimerStore((st) => st.autoStart);
  // 되돌리기가 부른다. 스토어를 통째로 구독하면 휴식이 돌 때마다 이 화면이 다시 그려진다
  const resetRestPrefs = useRestTimerStore((st) => st.resetPrefs);
  const duration = useRestTimerStore((st) => st.duration);
  const toneId = useRestTimerStore((st) => st.tone);
  const volume = useRestTimerStore((st) => st.volume);
  // 값을 바꾸는 함수들은 **한 번 만들어지고 안 바뀐다**(zustand 가 그렇게 둔다).
  // 그래서 통째로 집어와도 다시 그려지지 않는다
  const setSound = useRestTimerStore((st) => st.setSound);
  const setVibrate = useRestTimerStore((st) => st.setVibrate);
  const setAutoStart = useRestTimerStore((st) => st.setAutoStart);
  const setDuration = useRestTimerStore((st) => st.setDuration);
  const setTone = useRestTimerStore((st) => st.setTone);
  const setVolume = useRestTimerStore((st) => st.setVolume);

  const s = useSettingsStore();
  const sex = useAuthStore((st) => st.sex);
  const setSex = useAuthStore((st) => st.setSex);
  // 알림 설정을 한 번 불러온다. **조용히 실패한다** — 못 불러오면 단정하지 않고
  // 여태 문구(「시간 정하기」)를 그대로 둔다(`reminderRow` 의 `loaded`)
  useEffect(() => {
    let alive = true;
    client.get('/reminders')
      .then(({ data }) => {
        if (!alive) return;
        setRem({ loaded: true, settings: data?.settings || null, serverReady: !!data?.vapidPublicKey });
      })
      .catch(() => { /* 설정함은 이것 없이도 다 돌아간다 */ });
    return () => { alive = false; };
  }, []);

  const nickname = useAuthStore((st) => st.nickname);

  // 아이디를 한 번 받아온다. 알림 설정과 같은 길 — **조용히 실패한다**
  useEffect(() => {
    let alive = true;
    client.get('/auth/me')
      .then(({ data }) => {
        if (!alive) return;
        setAcct({ loaded: true, username: data?.username || '', changedAt: data?.usernameChangedAt || null });
      })
      .catch(() => { /* 아이디 줄만 안 보인다. 설정함은 그대로 돌아간다 */ });
    return () => { alive = false; };
  }, []);

  // 이름 바꾸기. 계정 시트가 하던 것과 **같은 길**을 쓴다 (`PUT /auth/nickname`) —
  // 화면이 둘이어도 서버로 가는 길은 하나다
  const saveNick = () => {
    const trimmed = String(nickDraft || '').trim();
    if (!trimmed || savingNick) return;
    setSavingNick(true);
    client.put('/auth/nickname', { nickname: trimmed })
      .then(() => {
        useAuthStore.setState({ nickname: trimmed });
        try { localStorage.setItem('nickname', trimmed); } catch { /* 막아둔 브라우저 */ }
        setNickEdit(false);
        toast('이름이 바뀌었어요');
      })
      .catch((err) => toast(err.response?.data?.error || '이름을 바꾸지 못했어요', 'error'))
      .finally(() => setSavingNick(false));
  };

  // 아이디를 치는 대로 확인한다. **가입 화면과 같은 길**(`/auth/check-username`) 이고,
  // 거기서 쓰는 규칙도 그대로다 — 한쪽만 느슨하면 통과했다가 저장에서 막힌다.
  //
  // **지금 쓰는 아이디는 「이미 사용 중」이 아니다.** 내 것을 내가 치는 것이라,
  // 그대로 물어보면 중복이라고 답한다 — 먼저 걸러낸다.
  const typeId = (raw) => {
    const next = String(raw || '').toLowerCase();
    setIdDraft(next);
    setIdMsg(null);
    setIdChecking(false);
    if (idTimer.current) clearTimeout(idTimer.current);

    if (!next) return;
    if (next.length < 4) { setIdMsg({ ok: false, text: '4자 이상 입력해주세요' }); return; }
    if (next.length > 20) { setIdMsg({ ok: false, text: '20자 이하로 입력해주세요' }); return; }
    if (!/^[a-zA-Z0-9!@#$%^&*._-]+$/.test(next)) {
      setIdMsg({ ok: false, text: '영문, 숫자, 특수문자(!@#$%^&*._-)만 가능' });
      return;
    }
    if (next === String(acct.username || '').toLowerCase()) {
      setIdMsg({ ok: false, text: '지금 쓰는 아이디예요' });
      return;
    }

    idTimer.current = setTimeout(() => {
      setIdChecking(true);
      client.post('/auth/check-username', { username: next })
        .then(({ data }) => setIdMsg({ ok: !!data?.available, text: data?.message || '' }))
        .catch((err) => setIdMsg({ ok: false, text: err.response?.data?.error || '확인 실패' }))
        .finally(() => setIdChecking(false));
    }, 600);
  };

  const saveId = () => {
    if (savingId || !idMsg?.ok) return;
    setSavingId(true);
    client.put('/auth/username', { username: idDraft })
      .then(({ data }) => {
        setAcct((a) => ({ ...a, username: data.username, changedAt: new Date().toISOString() }));
        setIdEdit(false);
        setIdDraft('');
        setIdMsg(null);
        toast('아이디가 바뀌었어요');
      })
      // 30일이 안 지났거나 그 사이에 남이 집어간 경우가 여기로 온다 —
      // 서버가 **까닭을 적어 보내므로** 그대로 띄운다
      .catch((err) => toast(err.response?.data?.error || '아이디를 바꾸지 못했어요', 'error'))
      .finally(() => setSavingId(false));
  };

  // ── 앱 잠금이 걸려 있나 (2026-09-22 에 고쳤다) ──
  //
  // 처음에 `canLock()` 을 썼는데 그것은 **「이 브라우저에서 쓸 수 있나」**지
  // 「지금 켜져 있나」가 아니다 — 잠금을 안 걸었는데도 「켜짐」이라고 적혀 있었다.
  //
  // 그리고 **잠금 창을 닫을 때 다시 본다.** 거기서 걸거나 풀었는데 이 줄이 그대로면,
  // 사람은 걸린 줄 알고(또는 안 걸린 줄 알고) 나간다
  const [locked, setLocked] = useState(isLockSet);

  // 다니는 곳. **기기에 남는 값**이라 스토어가 이미 들고 있다 — 여기서 새로 읽지 않는다
  const gym = useGymStore((st) => st.gym);

  // 체형에서 잰 것이 몇 개인가. **세는 것뿐**이라 스토어를 만들지 않는다 —
  // 이력을 쓰는 화면은 체형 하나고, 거기가 늘 이 열쇠를 다시 읽는다
  const [shapeCount, setShapeCount] = useState(() => {
    try {
      const list = JSON.parse(readLS(SHAPE_LOG_KEY) || 'null');
      if (Array.isArray(list)) return list.length;
    } catch { /* 깨진 것은 없는 것으로 본다 */ }
    // 9/22 에 쓰던 한 칸이 아직 남아 있을 수 있다 — 그것도 지울 것이 있다는 뜻이다
    return readLS(SHAPE_RATIOS_KEY) ? 1 : 0;
  });
  // 알림 줄에 적을 것. **브라우저가 아는 사실과 서버가 아는 사실을 함께** 넘긴다
  const remRow = reminderRow({
    canNotify: canNotify(),
    permission: notifyPermission(),
    serverReady: rem.serverReady,
    settings: rem.settings,
    loaded: rem.loaded,
  });

  const tones = allTones();
  const tone = tones.find((t) => t.id === toneId) || tones[0];
  return (
    <div>
      <div className="section-title">
        <div className="accent-bar" />
        설정
      </div>

      {/* ── 소리 ── */}
      <Group title="소리">
        <Toggle
          title="끝나면 소리로 알리기"
          desc="폰이 무음이면 소리가 안 나요 — 진동도 같이 켜두세요"
          on={sound}
          onChange={setSound}
        />

        {/* 소리를 끈 사람에게는 고를 것을 안 보여준다 — 눌러도 아무 일이 안 일어난다 */}
        {sound && (
          <>
            <div style={{ padding: '11px 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>어떤 소리로</div>
              {/* **고르면 그 자리에서 들려준다.** 이름(「종」·「나무」)만으로는 아무도 모른다 */}
              <Pick items={tones} value={toneId} onPick={(id) => { setTone(id); previewTone(id, volume); }} />
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 7 }}>
                {tone.name} — {tone.desc}
              </div>

              {/* **소리를 더 만들 수 있다** (2026-09-22). 파일은 안 받는다 —
                  재료(높이 · 몇 번 · 빠르기 · 결)를 주고 그 자리에서 만들게 한다 */}
              <ToneMaker
                tones={myTones}
                volume={volume}
                onSave={(next) => {
                  const saved = saveTones(next);
                  setExtraTones(saved);
                  setMyTones(saved);
                  // **지운 소리를 고른 채로 두지 않는다** — 그러면 아무 소리도 안 난다
                  if (!allTones().some((t) => t.id === toneId)) setTone('ding');
                }}
                onPicked={(id) => { setTone(id); previewTone(id, volume); }}
              />
            </div>

            <div style={{ padding: '11px 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>소리 크기</div>
              <Pick items={VOLUMES} value={volume} onPick={(id) => { setVolume(id); previewTone(toneId, id); }} />
            </div>
          </>
        )}

        <Toggle
          title="진동"
          desc="아이폰 사파리는 진동이 없어요"
          on={vibrate}
          onChange={setVibrate}
        />
      </Group>

      {/* ── 쉴 때 ── */}
      <Group title="쉴 때">
        <Toggle
          title="세트를 적으면 타이머가 저절로"
          on={autoStart}
          onChange={setAutoStart}
        />
        <div style={{ padding: '11px 0', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>기본 휴식 시간</div>
          <Pick
            items={PRESETS.map((n) => ({ id: n, name: `${n}초` }))}
            value={duration}
            onPick={setDuration}
          />
        </div>
      </Group>

      {/* ── 마이크 ──
          **되는 곳에서만 그린다.** 마이크가 없는 브라우저에 스위치만 띄워두면
          눌러보고 아무 일도 안 일어난다 */}
      {(micSupported() || speechSupported()) && (
        <Group title="마이크">
          {micSupported() && (
            <>
              <Toggle
                title="숨 보고 쉬기"
                desc="숨이 아직 올라있으면 쉬는 시간을 몇 초 더 드리고, 숨이 가라앉는 데 걸린 초를 적어 지난 번과 견줘 드려요. 소리 크기만 재고 녹음하지 않아요 — 어디로도 안 보냅니다."
                on={s.breath}
                onChange={s.setBreath}
              />

              {s.breath && (
                <>
                  <div style={{ padding: '11px 0', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>어디서 쓸까요</div>
                    <Pick items={BREATH_WHERE} value={s.breathWhere} onPick={s.setBreathWhere} />
                    {/* 9/29 에는 「홈트에서만 / 운동할 때도」라고 적어놓고 헬스장에는
                        숨이 아예 없었다 — 고른 사람이 아무 일도 안 일어나는 것을 골랐다.
                        10/1 에 **헬스장 세트 사이 휴식에 진짜로 붙이고** 갈래를 하나 늘렸다 */}
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 7 }}>
                      <b>헬스장 휴식까지</b>를 고르면 세트 사이 쉬는 자리에도 한 줄이 생겨요 —
                      거기서 <b>「숨 듣기」를 눌러야</b> 마이크가 돌고, 휴식이 끝나면 꺼집니다.
                      헬스장은 시끄러워서 못 들을 때가 많아요. 그때는 <b>그 줄만 조용히 사라집니다.</b>
                    </div>
                  </div>

                  <div style={{ padding: '11px 0', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>얼마나 더 줄까요</div>
                    <Pick items={BREATH_MAX} value={s.breathMax} onPick={s.setBreathMax} />
                  </div>

                  <div style={{ padding: '11px 0', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>얼마나 예민하게</div>
                    <Pick items={BREATH_SENSE} value={s.breathSense} onPick={s.setBreathSense} />
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 7 }}>
                      예민할수록 자주 늘려줘요. 옷 스치는 소리에도 반응할 수 있어요
                    </div>
                  </div>

                  {/* **여기가 이 화면의 핵심이다.** 마이크는 켜봐야 되는지 아는데,
                      여태 판을 시작해 45초를 버텨야 확인이 됐다 */}
                  <BreathCheck sense={s.breathSense} />
                </>
              )}
            </>
          )}

          {speechSupported() && (
            <Toggle
              title="목소리로 세트 적기"
              desc="「팔십 여덟개」 한마디로 칸을 채워요"
              on={s.voiceLog}
              onChange={s.setVoiceLog}
            />
          )}
        </Group>
      )}

      {/* ── 운동할 때 ── */}
      <Group title="운동할 때">
        <Toggle
          title="화면 켜두기"
          desc="40초 플랭크 중에 화면이 꺼지면 남은 시간을 못 봐요. 배터리를 더 씁니다."
          on={s.keepAwake}
          onChange={s.setKeepAwake}
        />
        <Toggle
          title="최고 기록이면 알려주기"
          desc="그 종목에서 제일 무거운 것을 들면 그 자리에서 띄워요"
          on={s.prBanner}
          onChange={s.setPrBanner}
        />
        <Toggle
          title="끝나면 오늘 한 것 보여주기"
          desc="루틴을 다 돌면 한 장으로 정리해줘요"
          on={s.finishCard}
          onChange={s.setFinishCard}
        />
      </Group>

      {/* ── 몸 ── */}
      <Group title="몸">
        <div style={{ padding: '11px 0 0' }}>
          <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>성별</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 2 }}>
            인바디 참고 범위를 그리는 데만 써요. 안 밝히면 숫자만 보여드려요.
          </div>
          <Pick
            items={[{ id: 'male', name: '남' }, { id: 'female', name: '여' }, { id: '', name: '안 밝힘' }]}
            value={sex || ''}
            onPick={(id) => {
              setSex(id || null)
                .then(() => toast('바꿨어요'))
                .catch(() => toast('못 바꿨어요. 잠시 뒤 다시 해주세요'));
            }}
          />
        </div>

        {/* ── 인바디 점수 (2026-09-29) ──
            **기본은 꺼짐이다.** 8/25 에 「몸에 등급을 안 매긴다」고 정하고 9/2 에
            비교 화면의 「종합 평가」를 걷어냈다 — 그 규칙을 되돌리는 것이 아니라,
            **보고 싶은 사람이 켜는 자리**를 둔 것이다.
            켜도 등급(「72점 · 보통」)은 안 붙이고, 무엇으로 낸 숫자인지 같이 적는다 */}
        <Toggle
          title="인바디 점수 보기"
          desc="인바디 화면에 점수를 한 숫자로 보여줘요. 새로 재는 게 아니라 이미 그려둔 참고 범위를 접은 거예요 — 등급은 안 매기고, 성별을 밝혀야 낼 수 있어요."
          on={s.inbodyScore}
          onChange={s.setInbodyScore}
        />

        {/* ── 체형에서 잰 것 (2026-09-29) ──
            9/29 에 체형이 **잰 비율을 이력으로 쌓기** 시작했다(`shapeHistory`).
            그런데 **지울 길이 없었다** — 로그아웃 말고는. 몸에 대한 값이라
            「쌓아두기만 하고 못 지우는 자리」로 둘 수 없다.
            사진은 여기 없다(체형은 사진을 안 들고 있는다) — 비율 숫자와 날짜뿐이다 */}
        {shapeCount > 0 && (
          <div style={{ padding: '11px 0 0', borderTop: '1px solid var(--border)', marginTop: 11 }}>
            <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>체형에서 잰 비율</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 2 }}>
              {shapeCount}번 잰 것이 이 기기에 있어요 (사진은 없어요 — 비율 숫자와 날짜뿐이에요).
              지우면 <b>견줄 상대가 없어져요.</b>
            </div>
            <button
              onClick={async () => {
                if (!await confirmDialog(`체형에서 잰 ${shapeCount}번을 지울까요? 다음 사진은 견줄 것이 없는 첫 장이 돼요.`, { danger: true })) return;
                // 옛 한 칸(9/22 것)도 같이 지운다 — 하나만 지우면 그것이 되살아난다
                removeLS(SHAPE_LOG_KEY);
                removeLS(SHAPE_RATIOS_KEY);
                setShapeCount(0);
                toast('지웠어요');
              }}
              className="btn-secondary"
              style={{ width: 'auto', marginTop: 9, padding: '6px 13px', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}
            >잰 것 지우기</button>
          </div>
        )}
      </Group>

      {/* ── 헬스장 (2026-09-29) ──
          기구마다 꽂아둔 핀 · 앉는 높이를 적어두는 자리가 따로 있는데
          (`/gym`), 설정함에서 갈 길이 없었다. **「그건 저기 있어요」로 미루면 사람은
          그 기능이 없다고 생각한다** — 이 화면을 만든 까닭이 그것이다.
          어디 다니는지는 **기기에 남는다**(`GYM_KEY`) — 폰에서 고른 곳이 집 PC 까지
          바뀌면 안 되기 때문이다. 그래서 여기가 맞는 자리다 */}
      <Group title="헬스장">
        <GoRow
          title="다니는 곳 · 기구 세팅"
          sub={gym || '아직 안 골랐어요'}
          onClick={() => navigate('/gym')}
        />
      </Group>

      {/* ── 계정 (2026-09-22) ──
          계정 시트에만 있던 것들을 여기서도 한다. **길은 하나다** — 이름은 같은
          서버 길로 가고, 비밀번호와 삭제는 계정 시트가 쓰는 그 모달을 그대로 연다 */}
      <Group title="계정">
        <div style={{ padding: '11px 0 0' }}>
          <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>이름</div>
          {nickEdit ? (
            <div style={{ display: 'flex', gap: 7, marginTop: 8 }}>
              <input
                value={nickDraft}
                onChange={(e) => setNickDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveNick(); }}
                maxLength={20}
                autoFocus
                style={{
                  flex: 1, minWidth: 0, minHeight: 38, padding: '8px 11px',
                  background: 'var(--bg-primary)', border: '1px solid var(--border-hover)',
                  borderRadius: 6, color: 'var(--text-primary)', fontSize: 13.5, fontFamily: 'inherit',
                }}
              />
              <button
                onClick={saveNick}
                disabled={savingNick}
                className="btn-primary"
                style={{ width: 'auto', padding: '0 14px', fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer' }}
              >저장</button>
              <button
                onClick={() => setNickEdit(false)}
                className="btn-secondary"
                style={{ width: 'auto', padding: '0 12px', fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer' }}
              >취소</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{nickname || '이름 없음'}</span>
              <button
                onClick={() => { setNickDraft(nickname || ''); setNickEdit(true); }}
                className="btn-secondary"
                style={{ width: 'auto', marginLeft: 'auto', padding: '5px 12px', fontSize: 11.5, fontFamily: 'inherit', cursor: 'pointer' }}
              >바꾸기</button>
            </div>
          )}
        </div>

        {/* ── 아이디 ── (2026-10-02)
            이름 바로 아래에 둔다. 둘 다 「나를 부르는 말」인데 쓰임이 다르다 —
            이름은 화면에 나오는 것이고 **아이디는 로그인에 치는 것**이라, 그 차이를
            줄 밑에 한 줄로 적는다.

            소셜로 들어온 사람에게는 `google_ff791abd` 처럼 **자기가 고른 적 없는
            이름**이 붙어 있다. 그 사람이 이 줄을 찾을 수 있어야 한다. */}
        {acct.loaded && acct.username && (
          <div style={{ padding: '11px 0 0', borderTop: '1px solid var(--border)', marginTop: 11 }}>
            <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>아이디</div>
            {idEdit ? (
              <>
                <div style={{ display: 'flex', gap: 7, marginTop: 8 }}>
                  <input
                    value={idDraft}
                    onChange={(e) => typeId(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveId(); }}
                    maxLength={20}
                    autoFocus
                    autoComplete="username"
                    placeholder="영문+숫자 4~20자"
                    style={{ flex: 1, minWidth: 0, minHeight: 38, padding: '8px 11px', background: 'var(--bg-primary)', border: '1px solid var(--border-hover)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 13.5, fontFamily: 'inherit',
                      borderColor: idDraft
                        ? (idMsg ? (idMsg.ok ? 'var(--success)' : 'var(--danger)') : 'var(--border-hover)')
                        : 'var(--border-hover)',
                    }}
                  />
                  <button
                    onClick={saveId}
                    disabled={savingId || !idMsg?.ok}
                    className="btn-primary"
                    style={{ width: 'auto', padding: '0 14px', fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer' }}
                  >저장</button>
                  <button
                    onClick={() => { setIdEdit(false); setIdDraft(''); setIdMsg(null); }}
                    className="btn-secondary"
                    style={{ width: 'auto', padding: '0 12px', fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer' }}
                  >취소</button>
                </div>
                {/* 왜 저장이 안 눌리는지 적는다. 회색으로 죽어 있기만 하면 아무도 모른다 */}
                <div style={{
                  fontSize: 11.5, marginTop: 6, lineHeight: 1.6,
                  color: idChecking ? 'var(--text-muted)'
                    : idMsg ? (idMsg.ok ? 'var(--success)' : 'var(--danger)')
                      : 'var(--text-muted)',
                }}>
                  {idChecking ? '중복 확인 중...'
                    : idMsg ? idMsg.text
                      : '바꿀 아이디를 입력하면 쓸 수 있는지 바로 확인해요'}
                </div>
                {/* 누르기 전에 말한다 — 한 번 바꾸면 30일간 못 바꾸고, 옛 아이디로는
                    로그인이 안 된다. 바꾼 뒤에 알면 늦는 종류의 사실이다 */}
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.6 }}>
                  바꾸면 <b style={{ color: 'var(--text-secondary)' }}>옛 아이디로는 로그인되지 않아요.</b>
                  다음 변경은 30일 뒤에 할 수 있어요. 이메일로도 로그인할 수 있습니다.
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                  <span style={{
                    fontSize: 13.5, color: 'var(--text-secondary)', minWidth: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{acct.username}</span>
                  <button
                    onClick={() => { setIdDraft(''); setIdMsg(null); setIdEdit(true); }}
                    className="btn-secondary"
                    style={{ width: 'auto', marginLeft: 'auto', padding: '5px 12px', fontSize: 11.5, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}
                  >바꾸기</button>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.6 }}>
                  {/* 자기가 고른 적 없는 이름이면 그렇다고 말해준다 — 「이게 왜 내 아이디지」로
                      두면 바꿀 수 있다는 것도 모른다 */}
                  {/^(google|naver|facebook|instagram)_[0-9a-f]{8}$/.test(acct.username)
                    ? '소셜 로그인으로 가입해서 저절로 지어진 아이디예요. 원하는 것으로 바꿀 수 있어요'
                    : '로그인할 때 치는 이름이에요 (이메일로도 됩니다)'}
                </div>
              </>
            )}
          </div>
        )}

        <GoRow title="비밀번호 바꾸기" onClick={() => setPwOpen(true)} />
        {/* **계정 삭제도 여기 둔다.** 계정에 대한 일이라 계정 무리가 맞다 —
            다만 30일 유예가 있다는 것을 옆에 적어, 누르기 전에 알게 한다
            (되돌릴 수 있다는 것을 모르면 아무도 안 누르고, 그게 더 나쁘다) */}
        <GoRow title="계정 삭제" sub="30일 안에 다시 로그인하면 되살아나요" onClick={() => setDelOpen(true)} />
        {/* 프로필 사진은 **계정 시트에 그대로 둔다.** 거기서 아바타를 누르면 바로
            고르는 자리가 열린다 — 사진을 바꾸는 사람은 제 얼굴을 보면서 바꾼다.
            여기서는 **어디로 가면 되는지**만 적는다 (길을 두 벌로 만들지 않는다) */}
        <div style={{
          padding: '11px 0 0', borderTop: '1px solid var(--border)', marginTop: 11,
          fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6,
        }}>
          프로필 사진은 머리 오른쪽의 <b style={{ color: 'var(--text-secondary)' }}>내 이름</b>을
          누르면 바꿀 수 있어요.
        </div>
      </Group>

      {/* ── 잠금과 알림 ──
          **길만 내지 않는다.** 앱 잠금은 여기서 바로 열고, 알림은 왜 안 되는지 적는다 */}
      <Group title="잠금과 알림">
        {/* 잠금을 못 쓰는 브라우저에서는 **아예 안 그린다** — 눌러도 아무 일이
            안 일어나는 줄을 두지 않는다 (`canLock` 은 쓸 수 있나를 본다) */}
        {canLock() && (
          <GoRow
            title="앱 잠금"
            sub={locked ? '켜짐' : '꺼짐'}
            onClick={() => setLockOpen(true)}
          />
        )}
        {/* **사실을 적는다.** 못 오게 막는 것이 있으면 그것을 먼저 말하고, 다 되면
            언제 오는지 적는다 (`reminderRow` — 검사가 값으로 본다) */}
        <GoRow
          title="운동 알림"
          sub={remRow.text}
          warn={remRow.warn}
          onClick={() => navigate('/reminders')}
        />
      </Group>

      {/* ── 기록 챙기기 ──
          **길이 틀려 있었다** (9/29 에 찾았다). 「내려받기 · 가져오기」가 고객센터로
          (`/support`) 보내면서 있지도 않은 갈래(`tab: 'data'`)를 넘겼다 — 고객센터는
          그 값을 안 읽고, 내려받기는 애초에 거기 없다. 누른 사람은 **FAQ 맨 위**에
          떨어져서, 내려받기가 없는 줄 알게 된다.
          실제 자리는 둘이다 — 운동 · 인바디는 기록 화면, 측정은 몸의 측정 갈래.
          **두 자리를 하나로 적지 않는다**: 없는 한 곳으로 보내는 것보다 두 줄이 낫다 */}
      <Group title="기록 챙기기">
        <GoRow
          title="운동 · 인바디 내려받기"
          sub="가져오기도 같은 자리"
          onClick={() => navigate('/history')}
        />
        <GoRow
          title="측정 내려받기"
          sub="줄자로 잰 것"
          onClick={() => navigate('/body', { state: { tab: 'measure' } })}
        />
      </Group>

      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.75, marginTop: 4, marginBottom: 18 }}>
        여기 있는 것은 <b>이 기기에서 어떻게 쓸지</b>예요 — 로그아웃해도 남습니다.
        이름 · 성별만 서버에 있어서 기기를 바꿔도 따라갑니다.<br />
        {/* 판 번호는 **제보할 때 필요한 것**이다. 고객센터가 자동으로 붙여 보내지만,
            「지금 무슨 판을 쓰고 있나」를 눈으로 볼 자리가 아무 데도 없었다 */}
        BLACK IRON v{pkg.version}
      </div>

      {/* ── 기본값으로 되돌리기 ── (2026-10-01)
          **무엇이 돌아가고 무엇이 안 돌아가는지 눌러보기 전에 말한다.**
          설정이 열몇 개가 되니 「뭘 건드렸는지 모르겠다」가 생긴다. 그런데
          되돌리기가 **기록이나 잠금까지 지우는 줄 알면 아무도 못 누른다** —
          그래서 안 건드리는 것을 먼저 적는다 */}
      <button
        onClick={async () => {
          const ok = await confirmDialog(
            '이 기기의 설정을 처음 상태로 돌립니다.\n\n' +
            '· 운동할 때 · 마이크 · 숨 · 알림 소리 · 휴식 길이가 처음 값으로 돌아가요\n\n' +
            '안 건드리는 것:\n' +
            '· 기록 · 사진 · 인바디 — 서버에 있는 것은 그대로예요\n' +
            '· 로그인 — 안 풀립니다\n' +
            '· 앱 잠금 네 자리 — 그대로 걸려 있어요\n' +
            '· 내가 만든 알림 소리 — 만든 것은 설정이 아니라 지우지 않아요',
            { title: '기본값으로 되돌릴까요', confirmText: '되돌리기' },
          );
          if (!ok) return;
          s.resetAll();
          resetRestPrefs();
          toast('설정을 처음 상태로 돌렸어요');
        }}
        className="btn-secondary"
        style={{ width: '100%', minHeight: 44, fontFamily: 'inherit', cursor: 'pointer', marginBottom: 10 }}
      >기본값으로 되돌리기</button>

      {/* ── 나가기 ──
          **맨 아래에 둔다.** 설정을 보다가 잘못 누를 자리가 아니다.
          나가기 전에 줄에 남은 기록을 올린다 — 그 일은 `data/leaveApp.js` 가 한다 */}
      <button
        onClick={async () => { if (await leaveApp()) navigate('/login'); }}
        className="btn-secondary"
        style={{ width: '100%', minHeight: 44, fontFamily: 'inherit', cursor: 'pointer' }}
      >로그아웃</button>

      {/* 떨어지는 화면은 안 그린다 — 모달이 뜨기 전 한 프레임 빈 판이 번쩍이면
          그게 더 거슬린다 */}
      <Suspense fallback={null}>
        {lockOpen && <LockSetup onClose={() => { setLockOpen(false); setLocked(isLockSet()); }} />}
        {pwOpen && <PasswordChangeModal onClose={() => setPwOpen(false)} onChanged={() => setPwOpen(false)} />}
        {delOpen && (
          <AccountDeleteModal
            onClose={() => setDelOpen(false)}
            onDeleted={() => { setDelOpen(false); navigate('/login'); }}
          />
        )}
      </Suspense>
    </div>
  );
}
