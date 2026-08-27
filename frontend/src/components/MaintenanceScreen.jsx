import { useState, useEffect } from 'react';
import { MAINT_KEY as MAINT_LS_KEY, MAINT_VERSION_KEY as MAINT_VERSION_LS_KEY } from '../data/localKeys';
// 이 컴포넌트는 App 전체를 감싼다. 쿠키를 막아둔 브라우저에서 localStorage 가
// 던지면 앱이 통째로 흰 화면이 되므로 안전한 래퍼만 쓴다.
import { readLS, saveLS } from '../data/safeStorage';
import client from '../api/client';
import { isAdmin as isAdminUser } from '../data/admin';
import { dateKey } from '../data/dateKey';

// 서버가 진짜다. localStorage 는 마지막으로 받아온 것을 담아두는 자리일 뿐이다 —
// 첫 화면을 그리는 순간과 네트워크가 없을 때 쓴다.
//
// 예전에는 이 목록이 localStorage 에만 있었다. 관리자가 점검을 잡아도 그 브라우저에만
// 저장돼서 **다른 사람에게는 아무 일도 일어나지 않았다.** 점검 화면도 안 뜨고,
// 고객센터의 '점검 예정' 도 영영 비어 있었다.
const MAINT_KEY = MAINT_LS_KEY;

const DEFAULT_SCHEDULE = [];

export function getSchedules() {
  try {
    const saved = JSON.parse(readLS(MAINT_KEY));
    return Array.isArray(saved) ? saved : DEFAULT_SCHEDULE;
  } catch { return DEFAULT_SCHEDULE; }
}

// 서버에서 받아 캐시를 갱신한다. 실패하면 마지막으로 받아둔 것을 그대로 쓴다 —
// 점검 목록을 못 받은 것 때문에 앱이 안 열리면 안 된다
export async function fetchSchedules() {
  try {
    const { data } = await client.get('/maintenance');
    const list = Array.isArray(data) ? data : [];
    saveLS(MAINT_KEY, JSON.stringify(list));
    return list;
  } catch {
    return getSchedules();
  }
}

// 관리자 화면에서 저장할 때. 서버에 올리고 캐시도 맞춰둔다
export async function pushSchedules(schedules) {
  const { data } = await client.put('/maintenance', { schedules });
  const list = Array.isArray(data) ? data : schedules;
  saveLS(MAINT_KEY, JSON.stringify(list));
  return list;
}

// 기본 스케줄 강제 적용 (테스트용)
export function forceDefaultSchedule() {
  saveLS(MAINT_KEY, JSON.stringify(DEFAULT_SCHEDULE));
}

// 앱 시작 시 기본 스케줄과 localStorage 동기화
// DEFAULT_SCHEDULE이 코드에서 바뀌면 자동 반영 (빈 배열이면 건너뜀 — 사용자 설정 보존)
const MAINT_VERSION_KEY = MAINT_VERSION_LS_KEY;
const CURRENT_VERSION = JSON.stringify(DEFAULT_SCHEDULE);
if (DEFAULT_SCHEDULE.length > 0 && readLS(MAINT_VERSION_KEY) !== CURRENT_VERSION) {
  saveLS(MAINT_KEY, CURRENT_VERSION);
  saveLS(MAINT_VERSION_KEY, CURRENT_VERSION);
}

// 이 스케줄이 그 날 도는가.
//   date 가 있으면 그 하루만 도는 일회성이다 — 관리자가 날짜를 찍어 잡은 점검.
//   date 가 없으면 요일 반복이다. days 가 비어 있으면 매일.
//   type 은 있는데 date 가 없는 것은 옛 '즉시 시작' 이 남긴 찌꺼기다.
//   그때는 날짜를 안 적고 days 를 비워둬서, 5분짜리 긴급 점검이 매일 같은 시각에
//   되살아났다. 그런 항목은 돌리지 않는다 (목록에는 남으니 관리자가 지우면 된다).
function runsOn(schedule, dateStr, weekday) {
  if (schedule.date) return schedule.date === dateStr;
  if (schedule.type) return false;
  if (schedule.days && schedule.days.length > 0) return schedule.days.includes(weekday);
  return true;
}

/**
 * 이 스케줄이 **지금** 도는가.
 *
 * 관리자 화면의 목록이 「지금 도는 중」을 표시하려면 같은 판단이 필요하다.
 * 판단을 두 곳에 적으면 언젠가 갈라진다 — 여기 하나만 쓴다.
 */
export function runningNow(schedule, ref = new Date()) {
  if (!schedule) return false;
  const nowMin = ref.getHours() * 60 + ref.getMinutes();
  const day = ref.getDay();
  const today = dateKey(ref);
  const yesterday = dateKey(new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 1));
  const startMin = schedule.startHour * 60 + schedule.startMin;
  const endMin = startMin + schedule.durationMin;

  for (const offset of [0, 1440]) {
    const onDate = offset ? yesterday : today;
    const onDay = offset ? (day + 6) % 7 : day;
    if (!runsOn(schedule, onDate, onDay)) continue;
    if (nowMin >= startMin - offset && nowMin < endMin - offset) return true;
  }
  return false;
}

function getMaintenanceInfo() {
  const schedules = getSchedules();
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const day = now.getDay();
  const today = dateKey(now);
  const yesterday = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));

  for (const schedule of schedules) {
    const startMin = schedule.startHour * 60 + schedule.startMin;
    const endMin = startMin + schedule.durationMin;

    // 자정을 넘기는 점검이 있다. 23:30 에 60분을 걸면 endMin 이 1470 이라
    // 00:15 (nowMin 15) 에는 어느 조건에도 안 걸려서 점검이 저 혼자 풀렸다.
    // 오늘 시작한 창과, 어제 시작해 오늘로 넘어온 창을 둘 다 본다.
    // offset 1440 은 어제 것을 오늘 시각 축으로 끌어온 값이다 (어제 23:30 → -30).
    for (const offset of [0, 1440]) {
      const onDate = offset ? yesterday : today;
      const onDay = offset ? (day + 6) % 7 : day;
      if (!runsOn(schedule, onDate, onDay)) continue;

      const s = startMin - offset;
      const e = endMin - offset;
      if (nowMin < s || nowMin >= e) continue;

      return {
        active: true,
        remainSec: (e - nowMin) * 60 - now.getSeconds(),
        startTime: `${String(schedule.startHour).padStart(2, '0')}:${String(schedule.startMin).padStart(2, '0')}`,
        // 자정을 넘으면 시가 24 를 넘는다. 그대로 찍으면 '24:30' 이 뜬다
        endTime: `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`,
        durationMin: schedule.durationMin,
        reason: schedule.reason || '정기 시스템 점검',
        type: schedule.type || 'regular',
      };
    }
  }
  return { active: false };
}

function formatTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}시간 ${String(m).padStart(2, '0')}분 ${String(s).padStart(2, '0')}초`;
  return `${m}분 ${String(s).padStart(2, '0')}초`;
}

// 점검 종류별로 부르는 이름. 문단은 따로 두지 않는다 —
// 예전에는 제목 · 안내문 · 뱃지 · 문단 · 꼬리말이 **전부 같은 말**을 했다
const KINDS = {
  emergency: { icon: '🚨', title: '긴급 점검 중', color: 'var(--danger)' },
  server:    { icon: '🖥️', title: '서버 점검 중', color: 'var(--info)' },
  regular:   { icon: '🔧', title: '정기 점검 중', color: 'var(--accent)' },
};
const kindOf = (t) => KINDS[t] || KINDS.regular;

export default function MaintenanceScreen({ children }) {
  const [info, setInfo] = useState(() => getMaintenanceInfo());
  const [kicked, setKicked] = useState(false);

  const admin = isAdminUser();

  // 서버에서 목록을 받아온다. 열자마자 한 번, 그 뒤로는 5분마다.
  //
  // 관리자가 방금 잡은 점검이 이미 열어둔 화면에도 곧 반영돼야 한다.
  // 1초마다 부르면 서버가 상한다 — 시각 계산은 1초마다 하되 목록만 5분마다 받는다.
  const [, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    const pull = () => fetchSchedules().then(() => { if (alive) setTick(t => t + 1); });
    pull();
    const id = setInterval(pull, 5 * 60 * 1000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // 시각을 다시 재는 주기.
  //
  // 예전에는 **언제나 1초마다** 돌면서 `setInfo` 를 불렀다. 이 컴포넌트가 앱 전체를
  // 감싸고 있으니, 점검이 없는 평소에도 1초에 한 번씩 앱 꼭대기가 다시 그려졌다.
  // 남은 시간을 초 단위로 세어야 하는 것은 **점검 중일 때뿐**이다.
  useEffect(() => {
    const period = info.active ? 1000 : 30000;
    const timer = setInterval(() => {
      const newInfo = getMaintenanceInfo();
      setInfo(newInfo);

      // 관리자는 막지 않는다
      if (admin) return;
      if (newInfo.active && !kicked) setKicked(true);
      // 점검이 끝나면 저절로 되살아난다
      if (!newInfo.active && kicked) {
        setKicked(false);
        window.location.reload();
      }
    }, period);
    return () => clearInterval(timer);
  }, [kicked, admin, info.active]);

  // 관리자는 점검 중에도 앱을 쓴다. 다만 **지금 막혀 있다는 것을 알아야 한다** —
  // 예전에는 관리자에게 아무 표시가 없어서, 점검을 걸어두고 잊으면 자기만 멀쩡한 앱을
  // 보면서 사용자는 막혀 있는 상태가 이어졌다
  if (admin) {
    if (!info.active) return children;
    const kind = kindOf(info.type);
    return (
      <>
        <div style={{
          position: 'sticky', top: 0, zIndex: 99999,
          background: kind.color, color: '#000',
          padding: '7px 14px', fontSize: 12.5, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        }}>
          <span aria-hidden="true">{kind.icon}</span>
          <span>{kind.title} — 사용자는 지금 앱을 못 씁니다</span>
          <span style={{ marginLeft: 'auto', fontWeight: 500 }}>
            {info.endTime} 까지 · {formatTime(Math.max(0, info.remainSec))} 남음
          </span>
        </div>
        {children}
      </>
    );
  }

  if (!info.active) return children;

  const kind = kindOf(info.type);
  // 남은 만큼 줄어드는 바. 예전에는 **지나간 만큼 차오르는** 바를 「남은 시간」 아래에
  // 뒀다 — 숫자는 줄고 바는 늘어서 서로 반대로 움직였다
  const leftRatio = info.durationMin > 0
    ? Math.max(0, Math.min(1, info.remainSec / (info.durationMin * 60)))
    : 0;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'var(--bg-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 999999, padding: 20, overflow: 'auto',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 380, width: '100%' }}>
        {/* 앱 이름은 작게. 여기 온 사람은 어느 앱인지 안다 */}
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 18, fontWeight: 700, letterSpacing: 4,
          background: 'linear-gradient(135deg, #ffd700, #ff6b1a, #ffd700)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: 28,
        }}>
          STEEL BODY
        </div>

        <div style={{ fontSize: 40, marginBottom: 14 }} aria-hidden="true">{kind.icon}</div>

        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 24, letterSpacing: 3, color: kind.color, marginBottom: 26,
        }}>
          {kind.title}
        </div>

        {/* 여기 온 사람이 알고 싶은 것은 **언제 끝나나** 하나다. 제일 크게 둔다.
            예전에는 이 숫자가 맨 아래에 있었고, 그 위로 제목 · 안내문 · 뱃지 · 문단이
            전부 같은 말을 네 번 하고 있었다 */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: `1px solid ${kind.color}`,
          borderRadius: 'var(--radius)',
          padding: '20px 18px', marginBottom: 14,
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>남은 시간</div>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 34, letterSpacing: 2, color: kind.color, lineHeight: 1,
          }}>
            {formatTime(Math.max(0, info.remainSec))}
          </div>
          <div className="progress-bg" style={{ marginTop: 14, height: 5 }}>
            <div style={{
              height: 5, width: `${leftRatio * 100}%`,
              background: kind.color, borderRadius: 'var(--radius)',
              transition: 'width 1s linear',
            }} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 12 }}>
            {info.startTime} ~ {info.endTime}
            <span style={{ color: 'var(--text-muted)' }}> · {info.durationMin}분</span>
          </div>
        </div>

        {/* 사유는 관리자가 적은 그 말이다. 앱이 지어낸 문단은 없앴다 */}
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '12px 14px',
          fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7,
          textAlign: 'left', marginBottom: 16,
        }}>
          <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>사유</span>
          {info.reason}
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.8 }}>
          끝나면 저절로 다시 열립니다. 새로고침하지 않으셔도 됩니다.
          <br />
          <b style={{ color: 'var(--text-secondary)' }}>적어두신 기록은 그대로 있습니다.</b>
        </div>
      </div>
    </div>
  );
}
