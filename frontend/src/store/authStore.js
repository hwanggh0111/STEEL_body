import { create } from 'zustand';
import { PER_USER_KEYS } from '../data/localKeys';
import client from '../api/client';
import { useWorkoutStore, resetCache as resetWorkoutCache } from './workoutStore';
import { useNoteStore, resetNoteCache } from './noteStore';
import { useInbodyStore, resetCache as resetInbodyCache } from './inbodyStore';
import { resetPose } from '../data/poseModel';
import { useRoutineSessionStore } from './routineSessionStore';
import { useReportStore } from './reportStore';
import { useGoalStore } from './goalStore';
import { useGymStore } from './gymStore';
import { useLockStore } from './lockStore';
// 이 스토어는 모듈이 로드되는 순간 localStorage 를 읽는다. 쿠키를 막아둔 브라우저는
// 읽기에서도 SecurityError 를 던지는데, 그러면 import 단계에서 앱 전체가 흰 화면이 된다.
import { readLS, saveLS, removeLS, readCookies } from '../data/safeStorage';

// 쿠키 존재 여부로 로그인 상태 판단 (sb_csrf는 httpOnly가 아니므로 읽기 가능)
function hasCsrfCookie() {
  return readCookies().includes('sb_csrf=');
}


// 파칭코 · 미니게임 · 레벨 · 성취 뱃지를 걷어내면서 남은 localStorage 키들.
// 진행도는 전부 브라우저에만 있었으므로 서버에는 지울 것이 없지만,
// 안 지우면 이미 쓰던 사람의 브라우저에 죽은 값이 영영 남는다. 앱이 뜰 때 한 번 쓸어낸다.
const REMOVED_GAME_KEYS = [
  // 레벨 · 칭호 (8/25 오전에 걷어냄) · 성취 뱃지 (8/25 오후)
  'steelbody_legend', 'steelbody_immortal', 'steelbody_level',
  'steelbody_exp', 'steelbody_title', 'steelbody_badges',
  'steelbody_legend_seen', 'steelbody_immortal_seen', 'steelbody_first_date',
  'steelbody_pachinko_used', 'steelbody_pachinko_exp', 'steelbody_pachinko_log',
  'steelbody_pachinko_best', 'steelbody_pachinko_best_exp',
  'steelbody_ul_tickets', 'steelbody_ul_exp',
  'steelbody_plates', 'steelbody_plate_tickets', 'steelbody_plate_best',
  'steelbody_plate_plays', 'steelbody_plate_unlimited',
];
REMOVED_GAME_KEYS.forEach(k => removeLS(k));

// 로그아웃할 때 브라우저에서 지울 것.
//
// 「기억해둔 것」과 「누구인지」 둘 다다. 남겨두면 다음에 그 기기를 쓰는 사람의
// 로그인 화면에 앞 사람의 아이디와 닉네임이 미리 채워진다.
// 목록은 `data/localKeys.js` 가 갖고 있다. 저장하는 쪽과 지우는 쪽이 **같은 목록**을
// 봐야 한다 — 따로 적어두면 새 키를 만든 사람이 여기에 넣는 것을 잊는다. 실제로
// 사진 · 검색 기록 · 답변 확인 시각이 그렇게 빠져 있었다
const LOGOUT_KEYS = PER_USER_KEYS;

export const useAuthStore = create((set) => ({
  token: readLS('token'), // 레거시 호환 (httpOnly 쿠키 전환 완료 후 제거 예정)
  nickname: readLS('nickname'),
  // 인바디 참고 범위에만 쓴다. null 이면 범위를 안 그리고 숫자만 보여준다.
  // 서버가 들고 있고 checkAuth 때 받아온다 — 기기를 바꿔도 다시 안 물어본다
  sex: null,
  isLoggedIn: !!readLS('token') || hasCsrfCookie(),

  login: async (email, password) => {
    const { data } = await client.post('/auth/login', { email, password });
    if (data.token) saveLS('token', data.token);
    saveLS('nickname', data.nickname);
    if (data.email) saveLS('ironlog_email', data.email);
    if (data.role) saveLS('ironlog_role', data.role);
    set({ token: data.token, nickname: data.nickname, isLoggedIn: true });
    // **방금 비밀번호를 댄 사람에게 네 자리를 또 묻지 않는다** (2026-09-18).
    //
    // 앱 잠금은 기기의 가림막이고, 로그인은 그보다 센 자물쇠다 — 센 것을 통과한
    // 사람에게 약한 것을 다시 묻는 것은 의미가 없고, 로그인 직후에 잠금 화면이
    // 덮이면 「로그인이 안 됐나」로 읽힌다. 걸어둔 것은 그대로 남는다
    useLockStore.getState().release();
    // 지우기로 해뒀던 계정이면 서버가 되살리고 그렇다고 알려준다.
    // 로그인 화면이 이 값을 보고 「되살아났어요」를 띄운다
    return { restored: !!data.restored };
  },

  /**
   * 소셜로 들어왔을 때 (2026-09-18 에 여기로 모았다).
   *
   * 여태 **로그인 화면이 직접 `setState` 를 했다.** 그래서 어제 붙인 「로그인하면
   * 잠금을 놓는다」가 **그 길만 비껴갔다** — 구글로 들어오면 비밀번호보다 센 것을
   * 통과한 사람에게 네 자리를 또 물었다.
   *
   * 들어온 뒤에 해야 하는 일을 한 곳에 둔다: 담아두기 · 상태 · 잠금 놓기.
   * 세 길(이메일 · 가입 · 소셜)이 이제 같은 자리를 지난다.
   */
  socialLoggedIn: ({ nickname, email }) => {
    if (nickname) {
      saveLS('nickname', nickname);
      // **다음에 올 때 인사할 이름도 담는다.** 이메일 로그인은 담는데 소셜만 안 담아서,
      // 소셜로 쓰는 사람은 늘 「처음 온 사람」 차림의 화면을 봤다
      saveLS('saved_nickname', nickname);
    }
    if (email) saveLS('ironlog_email', email);
    set({ nickname: nickname || null, isLoggedIn: true });
    useLockStore.getState().release();
    // **역할은 서버에 물어서 담는다** (2026-10-01).
    //
    // 이메일 로그인과 가입은 ironlog_role 을 담는데 **소셜만 안 담고 있었다.**
    // 관리자 화면은 그 값 하나를 보고 열리므로(data/admin.js), 구글로만 들어온
    // 관리자에게는 관리자 메뉴가 **아예 안 보인다.** 9/18 에 「로그인하면 잠금을
    // 놓는다」가 소셜 길만 비껴갔던 것과 **똑같은 모양**이다 — 길이 셋인데 둘에만
    // 적어둔 것이다.
    //
    // 주소줄로 role 을 받지 않는다. 그건 사람이 고쳐서 보낼 수 있는 값이다 —
    // **서버에 다시 묻는다.**
    useAuthStore.getState().checkAuth();
  },

  // 가입 직후 자동 로그인 (백엔드가 토큰/쿠키 발급)
  register: async (email, password, nickname, username) => {
    const { data } = await client.post('/auth/register', { email, password, nickname, username });
    if (data?.token) saveLS('token', data.token);
    if (data?.nickname) saveLS('nickname', data.nickname);
    if (data?.email) saveLS('ironlog_email', data.email);
    if (data?.role) saveLS('ironlog_role', data.role);
    set({ token: data?.token || null, nickname: data?.nickname || nickname, isLoggedIn: true });
    // 가입 직후도 같다 — 방금 계정을 만든 사람에게 네 자리를 묻지 않는다
    useLockStore.getState().release();
    return data;
  },

  setSex: async (sex) => {
    const { data } = await client.put('/auth/sex', { sex });
    set({ sex: data.sex ?? null });
    return data.sex ?? null;
  },

  logout: async () => {
    try {
      await client.post('/auth/logout');
    } catch {}
    // 나갈 때 지울 것을 여기 한 군데에 모은다.
    //
    // Layout 이 헤더와 프로필 메뉴 두 곳에서 `['auto_login','ironlog_email', …]` 를
    // **손으로 나열**하고 있었다. 한 곳만 고치면 다른 쪽에 남는다 —
    // 8/25 에 죽은 게임 키를 정리하면서 「나열은 한 군데에만 있으면 된다」고 적어놓고
    // 이 둘을 못 봤다
    LOGOUT_KEYS.forEach(k => removeLS(k));
    // CSRF 쿠키 클라이언트에서도 삭제 (서버 실패 대비)
    try { document.cookie = 'sb_csrf=; Max-Age=0; path=/'; } catch { /* 쿠키를 막아둔 브라우저 */ }
    set({ token: null, nickname: null, sex: null, isLoggedIn: false });
    // 다른 스토어 초기화
    // 담아둔 목록 · 못 올린 줄까지 비운다. 안 비우면 다음에 로그인한 사람 화면에
    // **앞 사람이 헬스장에서 적은 기록**이 남는다 (localStorage 쪽은 LOGOUT_KEYS 가 지운다)
    useWorkoutStore.setState({ workouts: {}, server: {}, queue: [], loading: false, flushing: false });
    // 그날 메모도 같다 — 앞 사람이 달력에 적어둔 것이 남으면 안 된다
    useNoteStore.setState({ notes: {}, server: {}, queue: {}, loading: false, flushing: false, loadFailed: false });
    useInbodyStore.setState({ records: [], loading: false });
    // 목록을 「방금 받아왔다」고 기억해 둔 것까지 비운다.
    // 안 비우면 다음에 로그인한 사람이 앞 사람 목록을 잠깐 본다
    resetWorkoutCache();
    resetNoteCache();
    resetInbodyCache();
    // 체형의 자세 인식 모델도 놓아준다. 목록과 달리 **남의 것이 보이는 문제는
    // 아니지만**(모델은 누구에게나 같다), 10MB 를 든 채로 로그인 화면에 서 있을
    // 이유가 없다. 다음에 「체형」을 열면 CDN 이 아니라 브라우저 캐시에서 온다
    resetPose();
    // 진행 중인 루틴도 비운다 — 안 비우면 다음에 로그인한 사람이 앞 사람의 진행표를 본다
    useRoutineSessionStore.getState().reset();
    // 제보함도 — 안 비우면 다음 사람에게 앞 사람의 제보와 「새 답변」이 뜬다
    useReportStore.getState().reset();
    // 목표도 — 체중 목표는 남에게 보일 것이 아니다
    useGoalStore.getState().reset();
    // 기구 세팅도 — 남의 헬스장 세팅이 내 화면에 뜨면 안 된다
    useGymStore.getState().reset();
  },

  /**
   * 서버에 「나 누구냐」고 다시 묻는다. 앱이 뜰 때와 소셜로 들어온 직후에 부른다.
   *
   * **담아둔 값은 늙는다.** 역할은 로그인할 때 한 번 담기고 그만이라, 관리자에서
   * 내려온 사람의 브라우저에는 「관리자」가 **그대로 남아 있었다** — 서버가 막아주니
   * 뚫리지는 않지만, 눌러봐야 안 되는 메뉴가 계속 보인다.
   *
   * **못 물어본 것과 아니라고 들은 것은 다르다.** 비행기 모드나 서버가 잠깐 죽은 것은
   * 「로그인 안 된 상태」가 아니다 — 그때 상태를 꺼버리면 **적어둔 기록을 들고 있는
   * 사람이 로그인 화면으로 튕긴다.** 서버가 401/403 으로 **아니라고 말했을 때만** 끈다.
   */
  checkAuth: async () => {
    try {
      const { data } = await client.get('/auth/me');
      saveLS('nickname', data.nickname);
      // 관리자에서 내려왔으면 **담아둔 것도 지운다.** 안 지우면 옛 값이 그대로 산다
      if (data.role === 'admin') saveLS('ironlog_role', data.role);
      else removeLS('ironlog_role');
      // 인바디 참고 범위가 이걸 본다. 「checkAuth 때 받아온다」고 적어만 두고
      // 실제로는 안 받아오고 있었다 (2026-10-01)
      set({ nickname: data.nickname, sex: data.sex ?? null, isLoggedIn: true });
      return true;
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        set({ isLoggedIn: false });
        return false;
      }
      // 못 물어봤을 뿐이다 — 들고 있던 상태를 그대로 둔다
      return null;
    }
  },
}));
