import { useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import { toast } from '../components/Toast';
import { AM, PM, HOURS12, parse24, to24, label24, minuteOptions } from '../data/timeOfDay';

// 운동 알림.
//
// 연속 기록이 있는데 앱을 열어야만 알 수 있었다. 안 열면 그냥 끊겼다.
//
// **못 하는 것을 누를 수 있게 두지 않는다.** 서버에 키가 없으면 켜기 단추를 아예 안 그리고,
// 브라우저가 알림을 아예 못 하면 그렇다고 적는다 — 눌러보고 안 되는 것보다 낫다.

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

// 흔한 조합. 일곱 개를 하나씩 누르게 두지 않는다
const DAY_PRESETS = [
  { label: '매일', days: [0, 1, 2, 3, 4, 5, 6] },
  { label: '평일', days: [1, 2, 3, 4, 5] },
  { label: '월·수·금', days: [1, 3, 5] },
  { label: '주말', days: [0, 6] },
];

const sameDays = (a, b) => Array.isArray(a) && a.length === b.length && b.every(d => a.includes(d));

// 서버가 준 base64url 공개키를 브라우저가 요구하는 바이트 배열로.
// atob 는 표준 base64 만 받는다 — '-' 와 '_' 를 되돌리고 '=' 를 채워야 한다
function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normal = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normal);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

const canNotify = typeof Notification !== 'undefined'
  && 'serviceWorker' in navigator
  && 'PushManager' in window;

// ── 서비스 워커를 기다린다. 단, 영영은 아니다 ──
//
// **`navigator.serviceWorker.ready` 는 등록이 없으면 끝나지 않는다.** 거절도 안 한다 —
// 그냥 멈춘다. 그것을 그대로 `await` 하면 `finally` 도 안 돌아서 `busy` 가 영영
// 안 풀리고, **화면의 단추가 전부 잠긴 채 아무 말도 안 한다.**
//
// 이건 개발 중에 늘 일어나는 일이다 — `main.jsx` 가 **개발에서는 서비스 워커를
// 일부러 안 붙인다**(캐시 먼저 주는 성질 때문에 고친 화면이 안 보여서). 운영에서도
// 등록이 실패하면(`register(...).catch(() => {})`) 똑같이 멈춘다.
//
// 그래서 시간 제한을 둔다. 못 기다리면 **없다고 답한다** — 부른 쪽이 사람에게
// 무슨 일인지 말할 수 있어야 한다.
const SW_WAIT_MS = 5000;

function swReady(ms = SW_WAIT_MS) {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null);
  let timer;
  const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve(null), ms); });
  return Promise.race([navigator.serviceWorker.ready, timeout])
    .then((reg) => reg || null)
    .catch(() => null)
    .finally(() => clearTimeout(timer));
}

// 홈 화면에 추가해서 연 앱인가 (아이폰은 이때만 알림이 온다)
const isStandalone = typeof window !== 'undefined'
  && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);

const isIOS = typeof navigator !== 'undefined'
  && /iPad|iPhone|iPod/.test(navigator.userAgent);

function Toggle({ on, onClick, label, desc, disabled }) {
  return (
    <div
      role="switch"
      aria-checked={on}
      aria-label={label}
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onClick}
      onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); } }}
      className="card"
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{ flexGrow: 1 }}>
        <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{desc}</div>}
      </div>
      <div style={{
        width: 40, height: 22, borderRadius: 11, padding: 3, flexShrink: 0,
        background: on ? 'var(--accent)' : 'var(--bg-tertiary)',
        border: on ? 'none' : '1px solid var(--border-hover)',
        display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start',
        transition: 'background 0.15s',
      }}>
        <div style={{
          width: on ? 16 : 14, height: on ? 16 : 14, borderRadius: 8,
          background: on ? 'var(--on-accent)' : 'var(--text-muted)',
        }} />
      </div>
    </div>
  );
}

export default function RemindersPage() {
  const [settings, setSettings] = useState(null);
  const [vapid, setVapid] = useState(null);
  const [devices, setDevices] = useState(0);
  // **이 기기가 받는가**는 계정의 기기 수로 알 수 없다. 폰에서 켜두고 PC 에서 열면
  // `devices` 는 1 이지만 이 PC 는 안 받는다 — 그런데 화면은 「이 기기는 알림을
  // 받습니다」라고 했다. 브라우저에 실제로 구독이 있는지를 본다
  const [thisDevice, setThisDevice] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [permission, setPermission] = useState(canNotify ? Notification.permission : 'unsupported');

  useEffect(() => {
    client.get('/reminders')
      .then(({ data }) => {
        setSettings(data.settings);
        setVapid(data.vapidPublicKey);
        setDevices(data.devices || 0);
      })
      .catch(() => setError('설정을 불러오지 못했어요'))
      .finally(() => setLoading(false));
  }, []);

  // 이 브라우저에 구독이 있는지. **`getRegistration()` 을 쓴다** — `ready` 와 달리
  // 등록이 없으면 곧바로 `undefined` 로 끝난다
  useEffect(() => {
    if (!canNotify) return undefined;
    let dropped = false;
    navigator.serviceWorker.getRegistration()
      .then((reg) => (reg ? reg.pushManager.getSubscription() : null))
      .then((sub) => { if (!dropped) setThisDevice(!!sub); })
      .catch(() => {});
    return () => { dropped = true; };
  }, []);

  // 바뀐 것만 보낸다. 서버가 나머지는 그대로 둔다
  const patch = useCallback(async (next) => {
    setBusy(true);
    const prev = settings;
    setSettings(s => ({ ...s, ...next }));
    try {
      const { data } = await client.put('/reminders', {
        ...next,
        tzOffset: new Date().getTimezoneOffset(),
      });
      setSettings(s => ({ ...s, ...data }));
    } catch (err) {
      setSettings(prev);   // 저장 못 했으면 화면도 되돌린다
      toast(err.response?.data?.error || '저장하지 못했어요', 'error');
    } finally {
      setBusy(false);
    }
  }, [settings]);

  // 이 기기를 등록한다. 권한 → 구독 → 서버 저장 순서다
  const enableHere = async () => {
    if (!canNotify || !vapid) return;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        toast('알림을 허락하지 않으셨어요', 'error');
        return;
      }
      const reg = await swReady();
      if (!reg) {
        toast('알림을 켤 준비가 안 됐어요. 새로고침한 뒤 다시 눌러주세요', 'error');
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      });
      const { data } = await client.post('/reminders/subscribe', { subscription: sub.toJSON() });
      setDevices(data.devices);
      setThisDevice(true);
      toast('이 기기에 알림을 켰어요');
    } catch (err) {
      toast('알림을 켜지 못했어요', 'error');
    } finally {
      setBusy(false);
    }
  };

  // 이 기기를 뺀다.
  //
  // 서버에는 `DELETE /reminders/subscribe` 가 처음부터 있었는데 **화면이 한 번도
  // 부르지 않았다.** 켤 수는 있고 끌 수는 없는 상태였다 — 기기를 바꾸거나 잘못 켠
  // 사람은 브라우저 설정까지 들어가서 권한을 막는 수밖에 없었다.
  const disableHere = async () => {
    if (!canNotify) return;
    setBusy(true);
    try {
      const reg = await swReady();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (!sub) { setThisDevice(false); toast('이 기기는 이미 꺼져 있어요'); return; }
      const endpoint = sub.endpoint;
      // 브라우저에서 먼저 끊고 서버에 알린다. 순서가 반대면 서버에서 지운 뒤
      // 브라우저 구독이 남아 「알 수 없는 기기」로 계속 붙어 있는다
      await sub.unsubscribe();
      const { data } = await client.delete('/reminders/subscribe', { data: { endpoint } });
      setDevices(data.devices);
      setThisDevice(false);
      toast('이 기기의 알림을 껐어요');
    } catch {
      toast('끄지 못했어요', 'error');
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    try {
      await client.post('/reminders/test');
      toast('보냈어요. 잠시 뒤에 옵니다');
    } catch (err) {
      toast(err.response?.data?.error || '보내지 못했어요', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>불러오는 중…</div>;
  }
  if (error || !settings) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">불러오지 못함</div>
        <div className="empty-state-desc">{error}</div>
      </div>
    );
  }

  const toggleDay = (d) => {
    const days = settings.days.includes(d)
      ? settings.days.filter(x => x !== d)
      : [...settings.days, d].sort((a, b) => a - b);
    patch({ days });
  };

  const serverReady = !!vapid;
  // **이 기기**에 구독이 있고, 이 브라우저가 알림을 허락했을 때만 「받습니다」다
  const registered = thisDevice && permission === 'granted';
  // 켜져 있는데 고른 요일이 하나도 없으면 **정한 요일 알림은 영영 안 온다.**
  // 서버는 이 상태를 막지 않는다(오래 쉴 때 알림만으로도 쓸 수 있어서) —
  // 대신 화면이 그렇다고 말해야 한다
  const noDays = settings.enabled && settings.days.length === 0;

  // 담긴 값(24시간)을 고르는 모양으로 편다. 못 읽는 값이 담겨 있어도 화면은 돌아야
  // 한다 — 그때는 저녁 7시를 보여주고, 사람이 만지면 그때 제대로 저장된다
  const clock = parse24(settings.time) || { ampm: PM, hour12: 7, minute: 0 };

  const setTime = (ampm, hour12, minute) => {
    const next = to24(ampm, hour12, minute);
    // 만들 수 없는 시각이면 보내지 않는다. 서버가 거절해봐야 사람은 이유를 모른다
    if (!next || next === settings.time) return;
    patch({ time: next });
  };

  return (
    <div>
      <div className="section-title">
        <div className="accent-bar" />
        운동 알림
      </div>

      {/* 이렇게 옵니다 — 켜기 전에 무엇이 오는지 먼저 보여준다 */}
      <div className="card" style={{ marginBottom: 18, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{
          width: 34, height: 34, flexShrink: 0, borderRadius: 'var(--radius)',
          background: 'var(--accent-dim)', border: '1px solid var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6.5 9.5h11M4 9.5v5M20 9.5v5M2 12h2M20 12h2M6.5 7v10M17.5 7v10" />
          </svg>
        </div>
        <div style={{ flexGrow: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1.5 }}>BLACK IRON</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label24(settings.time)}</span>
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>오늘 운동하는 날이에요</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>기록까지 남기면 이번 주 한 칸이 채워집니다.</div>
        </div>
      </div>

      {/* 못 하는 자리를 먼저 밝힌다 */}
      {!canNotify && (
        <div className="card" style={{ marginBottom: 18, borderLeft: '3px solid var(--warning)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>이 브라우저는 알림을 받을 수 없어요</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            설정은 저장해두셔도 됩니다. 알림을 받을 수 있는 기기에서 켜면 그대로 적용됩니다.
          </div>
        </div>
      )}
      {canNotify && !serverReady && (
        <div className="card" style={{ marginBottom: 18, borderLeft: '3px solid var(--warning)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>서버가 아직 알림을 보낼 준비가 안 됐어요</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            설정은 지금 저장해두셔도 됩니다. 준비가 끝나면 정한 시각에 옵니다.
          </div>
        </div>
      )}
      {canNotify && isIOS && !isStandalone && (
        <div className="card" style={{ marginBottom: 18, borderLeft: '3px solid var(--warning)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>아이폰은 홈 화면에 추가해야 알림이 옵니다</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            공유 → 홈 화면에 추가 를 한 다음, 그렇게 만든 앱에서 이 화면을 다시 열어주세요.
          </div>
        </div>
      )}

      {/* 이 기기 — 맨 위로 올렸다.
          예전에는 요일과 시간을 다 만진 다음에야 「이 기기에서 알림 켜기」가 나왔다.
          **켜지 않으면 나머지를 아무리 정해도 아무 일도 안 일어난다** — 켜는 것이 먼저다 */}
      {canNotify && serverReady && (
        <div className="card" style={{ marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!registered ? (
            <>
              <div style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>이 기기는 아직 알림을 안 받습니다</div>
              {devices > 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  다른 기기 {devices}대에서는 받고 있어요
                </div>
              )}
              <button className="btn-primary" disabled={busy} onClick={enableHere}>
                이 기기에서 알림 켜기
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, color: 'var(--success)' }}>
                이 기기는 알림을 받습니다{devices > 1 ? ` · 이 계정에 켠 기기 ${devices}대` : ''}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-secondary" disabled={busy} onClick={sendTest} style={{ flexGrow: 1 }}>
                  지금 한 통 보내보기
                </button>
                <button className="btn-secondary" disabled={busy} onClick={disableHere} style={{ flexGrow: 1 }}>
                  이 기기 끄기
                </button>
              </div>
            </>
          )}
          {permission === 'denied' && (
            <div style={{ fontSize: 12, color: 'var(--danger)', lineHeight: 1.7 }}>
              이 브라우저에서 알림을 막아두셨어요. 주소창 왼쪽의 자물쇠에서 다시 허락해주셔야 합니다 —
              한 번 막으면 앱이 다시 물어볼 수 없습니다.
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
        <Toggle
          on={settings.enabled}
          disabled={busy}
          onClick={() => patch({ enabled: !settings.enabled })}
          label="운동 알림 받기"
          desc={!settings.enabled
            ? '꺼져 있습니다'
            : noDays
              ? (settings.streakGuard
                ? '고른 요일이 없어요 · 오래 쉴 때만 옵니다'
                : '고른 요일이 없어 아무것도 안 옵니다')
              : '정한 요일과 시각에 옵니다'}
        />
        <Toggle
          on={settings.streakGuard}
          disabled={busy}
          onClick={() => patch({ streakGuard: !settings.streakGuard })}
          label="오래 쉬면 한 번 알리기"
          desc="마지막 운동에서 사흘이 지나면, 정한 요일이 아니어도 한 번"
        />
      </div>

      <div className="label">요일</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {DAY_LABELS.map((label, d) => {
          const on = settings.days.includes(d);
          return (
            <button
              key={d}
              className={`btn-secondary${on ? ' active' : ''}`}
              style={{ flexGrow: 1, padding: '10px 0' }}
              disabled={busy}
              onClick={() => toggleDay(d)}
            >{label}</button>
          );
        })}
      </div>
      {/* 흔한 조합은 한 번에. 일곱 개를 하나씩 누르게 두지 않는다 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {DAY_PRESETS.map(p => {
          const on = sameDays(settings.days, p.days);
          return (
            <button
              key={p.label}
              className="btn-secondary"
              disabled={busy}
              onClick={() => patch({ days: p.days })}
              style={{
                width: 'auto', padding: '5px 12px', fontSize: 11.5,
                ...(on ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : null),
              }}
            >{p.label}</button>
          );
        })}
      </div>

      {noDays && (
        <div style={{
          fontSize: 12, lineHeight: 1.7, marginBottom: 18,
          color: settings.streakGuard ? 'var(--text-muted)' : 'var(--danger)',
        }}>
          {settings.streakGuard
            ? '고른 요일이 없습니다. 지금은 오래 쉬었을 때만 한 번 옵니다.'
            : '고른 요일이 없고 「오래 쉬면 한 번 알리기」도 꺼져 있어 아무 알림도 안 옵니다.'}
        </div>
      )}

      {/* ── 시각 ──
          `<input type="time">` 를 걷었다. 브라우저마다 생김새가 다르고, 폰에서는
          굴림판이 뜨고, **비우면 빈 값이 서버로 간다**(그러면 저장이 실패한다).
          무엇보다 「저녁 7시」라고 생각하는 사람에게 19 를 찾게 하는 자리였다.
          오전/오후 · 시 · 분 셋으로 고른다. 담기는 값(24시간)은 그대로다 */}
      <div className="label">시간</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
        {[[AM, '오전'], [PM, '오후']].map(([v, label]) => (
          <button
            key={v}
            className={`btn-secondary${clock.ampm === v ? ' active' : ''}`}
            disabled={busy}
            onClick={() => setTime(v, clock.hour12, clock.minute)}
            style={{ width: 'auto', padding: '10px 16px' }}
            aria-pressed={clock.ampm === v}
          >{label}</button>
        ))}
        <select
          className="input"
          value={clock.hour12}
          disabled={busy}
          onChange={(e) => setTime(clock.ampm, Number(e.target.value), clock.minute)}
          aria-label="시"
          style={{ width: 'auto', flexGrow: 1, marginBottom: 0 }}
        >
          {HOURS12.map(h => <option key={h} value={h}>{h}시</option>)}
        </select>
        <select
          className="input"
          value={clock.minute}
          disabled={busy}
          onChange={(e) => setTime(clock.ampm, clock.hour12, Number(e.target.value))}
          aria-label="분"
          style={{ width: 'auto', flexGrow: 1, marginBottom: 0 }}
        >
          {minuteOptions(clock.minute).map(m => (
            <option key={m} value={m}>{String(m).padStart(2, '0')}분</option>
          ))}
        </select>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>
        {label24(settings.time)}에 옵니다
      </div>

      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.8 }}>
        정한 시각에 서버가 보냅니다. 그 시각에 서버가 쉬고 있었다면 그날은 건너뜁니다 —
        밤늦게 「오늘 운동하는 날이에요」가 오는 것보다 안 오는 게 낫다고 봤습니다.
        <br />
        그날 이미 운동을 적으셨으면 보내지 않습니다.
      </div>
    </div>
  );
}
