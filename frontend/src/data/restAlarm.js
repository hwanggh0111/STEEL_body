// 쉬는 시간이 끝났다고 **폰이** 알리게 한다 (2026-10-16)
//
// ── 왜 ──
//
// 끝 알림은 여태 **화면 쪽**에서 울렸다 — 휴식 띠(`RestBar`)가 `finished` 를 보고
// `beepDone` 을 부른다. 화면이 떠 있는 동안에는 맞는 자리다. 그런데 쉬는 90초 동안
// 사람이 하는 일은 **폰을 주머니에 넣는 것**이다. 그 순간 두 가지가 같이 벌어진다 —
//
//   · 안드로이드가 뒤로 간 웹뷰의 타이머를 늦추거나 멈춘다 → `finished` 가 늦게 선다
//   · 설령 섰더라도 **소리를 낼 자리가 잠들어 있다** (오디오가 눌린다)
//
// 그래서 꺼내 보면 「휴식 끝」이 떠 있고, 실제로는 2분 40초를 쉰 뒤다. 타이머가
// 틀린 게 아니라 **알림이 안 간 것**인데, 쓰는 사람에게는 타이머가 고장 난 것으로 보인다.
//
// ── 어떻게 ──
//
// 끝나는 시각에 **OS 알림을 미리 예약한다**(`@capacitor/local-notifications`).
// 예약은 안드로이드가 들고 있으므로 웹뷰가 잠들어도 · 앱이 죽어도 제 시각에 뜬다.
// 잠금화면에도 뜬다.
//
// ── 지키는 선 ──
//
// **앱에서만.** 브라우저에서는 조용히 아무 일도 안 한다 — 지금 울리는 방식 그대로다.
// (브라우저 알림은 서비스 워커 · 푸시가 있어야 하는 다른 길이다. `pushSupport.js`)
//
// **화면이 떠 있을 때는 예약하지 않는다.** 둘 다 걸어두면 띠의 삑 소리와 OS 알림이
// 겹쳐 두 번 울린다. 앱이 뒤로 갈 때 걸고, 돌아오면 지운다 (`useRestAlarm.js`).
//
// **소리·진동을 둘 다 끈 사람에게는 안 건다.** 끈 사람이 끈 이유가 있다.
//
// **정확한 알람은 OS 가 이미 허락한 때만 쓴다.** 안드로이드 14부터 「알람 및 리마인더」는
// 따로 받는 권한이고, 플러그인은 기본값(`isExactNotification: true`)일 때 **예약할 때마다
// 설정 화면을 열어버린다** — 세트 사이에 그러면 안 된다. 그래서 먼저 물어보고
// (`checkExactNotificationSetting`) 허락돼 있을 때만 정확히, 아니면 느슨하게 건다.
// 느슨한 알람은 몇십 초 늦을 수 있지만 **안 울리는 것보다 낫고**, 화면을 보고 있는
// 동안에는 어차피 띠가 제때 울린다.

import { Capacitor } from '@capacitor/core';

// 예약은 **언제나 하나다** — 휴식도 하나뿐이다. 번호를 고정해두면 지울 때 찾을 필요가 없다
const ID = 7101;
const CHANNEL = 'rest-end';

// 권한을 물어본 적이 있나. 세트마다 묻지 않으려고 이 기기에 적어둔다
const LS_ASKED = 'steelbody_rest_notify_asked';

let plugin = null;
let channelReady = false;
let channelTries = 0;
let exactOk = null;              // null = 아직 안 물어봄
let granted = false;             // 권한을 받아둔 것을 기억한다 (아래 「미리 데운다」)

/** 이 기기에서 OS 알림을 걸 수 있나 (= 앱으로 열었나). */
export function canRestAlarm() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

// 플러그인은 **쓸 때 받는다.** 맨 위에서 받으면 브라우저로 여는 사람도
// 쓰지 않을 조각을 내려받는다 (첫 화면 무게는 10/15 에 줄여둔 것이다)
async function load() {
  if (plugin) return plugin;
  const mod = await import('@capacitor/local-notifications');
  plugin = mod.LocalNotifications;
  return plugin;
}

// 안드로이드 8부터 알림은 **채널**에 속해야 소리·우선순위가 정해진다.
// 채널이 없으면 조용한 기본 채널로 떨어져서 — 잠금화면에 안 뜬다
async function ensureChannel(api) {
  if (channelReady || channelTries >= 2) return;
  channelTries += 1;
  try {
    await api.createChannel({
      id: CHANNEL,
      name: '쉬는 시간',
      description: '쉬는 시간이 끝나면 알립니다',
      importance: 5,             // 화면 위로 떠오르는 등급
      visibility: 1,             // 잠금화면에 내용까지 보인다
      vibration: true,
    });
    channelReady = true;
  } catch {
    // **실패를 영영 기억하지 않는다.** iOS 에는 채널이 아예 없어서 늘 여기로 오고,
    // 안드로이드에서도 한 번쯤 실패할 수 있다. 그때 「만들었다」고 적어두면
    // 다시는 안 만들고 — 알림이 조용한 기본 채널로 떨어져 **잠금화면에 안 뜬다.**
    // 그래서 두 번까지만 다시 해본다(`channelTries`). 채널이 없어도 알림 자체는 간다
  }
}

/**
 * 알림 권한. **한 번만 묻는다.**
 *
 * 거절해도 다시 안 묻는다 — 앱이 할 일이 아니다. 거절한 사람은 화면 쪽 알림만 받는다.
 * 묻는 자리는 **휴식을 시작할 때**다(화면이 떠 있는 때). 뒤로 간 뒤에는 창을 못 띄운다.
 */
export async function askRestAlarmOnce() {
  if (!canRestAlarm()) return false;
  try {
    const api = await load();
    const now = await api.checkPermissions();
    if (now.display === 'granted') { granted = true; return true; }
    if (now.display === 'denied') return false;
    // 'prompt' — 아직 안 물어본 상태. 한 번만 묻는다
    if (localStorage.getItem(LS_ASKED) === '1') return false;
    localStorage.setItem(LS_ASKED, '1');
    const asked = await api.requestPermissions();
    granted = asked.display === 'granted';
    return granted;
  } catch {
    return false;
  }
}

/**
 * **미리 데워 둔다** (2026-10-16 에 더한 것).
 *
 * 예약은 **앱이 뒤로 가는 순간**에 건다. 그런데 그 순간 할 일이 넷이었다 —
 * 플러그인 내려받기 · 권한 묻기 · 채널 만들기 · 예약하기. 안드로이드는 뒤로 간
 * 웹뷰의 자바스크립트를 **곧 얼린다** — 넷을 줄줄이 기다리다 얼면 **예약이 아예
 * 안 걸리고**, 그러면 이 기능은 조용히 없는 것이 된다. 하필 **가장 흔한 경우**
 * (주머니에 넣는 순간)에서 그렇다.
 *
 * 그래서 앞의 셋을 **휴식이 시작될 때(화면이 떠 있을 때)** 미리 해둔다.
 * 뒤로 가는 순간에 남는 일은 `schedule()` 하나다.
 */
export async function warmUpRestAlarm() {
  if (!canRestAlarm()) return false;
  try {
    const api = await load();
    const perm = await api.checkPermissions();
    granted = perm.display === 'granted';
    if (!granted) return false;
    await ensureChannel(api);
    if (exactOk === null) {
      try {
        const st = await api.checkExactNotificationSetting();
        exactOk = st.exact_alarm === 'granted';
      } catch {
        exactOk = false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 지금 **잠금화면 알림을 받을 수 있는 상태인가.** 설정함이 사실을 적는 데 쓴다.
 *
 *   'off'       앱이 아니다 (브라우저) — 줄을 아예 안 그린다
 *   'granted'   켜짐
 *   'denied'    거절했다 — 앱에서는 다시 못 묻는다. 폰 설정에서만 풀린다
 *   'prompt'    아직 안 물어봤다 (첫 휴식 때 묻는다)
 *
 * **「켜짐」이라고 적어놓고 안 울리는 것이 제일 나쁘다.** 그래서 꺼진 까닭을 갈라 적는다.
 */
export async function alarmPermission() {
  if (!canRestAlarm()) return 'off';
  try {
    const api = await load();
    const now = await api.checkPermissions();
    if (now.display === 'granted') return 'granted';
    if (now.display === 'denied') return 'denied';
    return 'prompt';
  } catch {
    return 'off';
  }
}

/**
 * `deadline`(ms) 에 울리도록 예약한다. 이미 걸려 있으면 덮어쓴다(+30초를 누른 때).
 *
 * @param deadline 끝나는 시각 (Date.now() 와 같은 축)
 * @param body     알림에 적을 한 줄 ('다음 · 3세트 · 60kg 10회')
 */
export async function scheduleRestAlarm(deadline, body = '') {
  if (!canRestAlarm() || !deadline) return false;
  // 이미 지난 시각은 걸 수 없다. 1초는 남아 있어야 한다
  if (deadline - Date.now() < 1000) return false;
  try {
    const api = await load();
    // **데워져 있으면 다시 묻지 않는다.** 여기는 앱이 막 뒤로 간 순간이라
    // 자바스크립트가 곧 얼어붙는다 — 왕복을 하나라도 줄여야 예약이 걸린다
    if (!granted) {
      const perm = await api.checkPermissions();
      granted = perm.display === 'granted';
      if (!granted) return false;
    }
    await ensureChannel(api);

    if (exactOk === null) {
      try {
        const st = await api.checkExactNotificationSetting();
        exactOk = st.exact_alarm === 'granted';
      } catch {
        exactOk = false;
      }
    }

    await api.schedule({
      notifications: [{
        id: ID,
        channelId: CHANNEL,
        title: '휴식 끝',
        body: body || '다음 세트 하세요',
        schedule: {
          at: new Date(deadline),
          // 폰이 깊이 잠들어 있어도 깨워서 울린다
          allowWhileIdle: true,
        },
        // 허락돼 있을 때만 정확히. 아니면 느슨하게 — **설정 화면을 열지 않는다**
        isExactNotification: exactOk === true,
        ongoing: false,
        autoCancel: true,
      }],
    });
    return true;
  } catch {
    return false;                // 알림 하나 때문에 휴식이 멈추면 안 된다
  }
}

/** 걸어둔 예약을 지운다. 없으면 아무 일도 안 난다. */
export async function cancelRestAlarm() {
  if (!canRestAlarm()) return;
  try {
    const api = await load();
    await api.cancel({ notifications: [{ id: ID }] });
  } catch {
    /* 지우지 못해도 할 수 있는 일이 없다 */
  }
}
