import { useState } from 'react';
import NavIcon from '../NavIcon';
import { useNavigate } from 'react-router-dom';
import { SEARCH_HISTORY_KEY } from '../../data/localKeys';
import { isAdmin } from '../../data/admin';
import { readLS, removeLS, saveLS } from '../../data/safeStorage';

// 홈 검색.
//
// 홈 화면이 420줄이었는데 그중 250줄이 이 검색이었다. 홈은 「오늘 뭘 할지」를 말하는
// 화면인데 파일의 절반이 초성 매칭과 최근 검색 목록이었다. 떼어낸다.
//
// **가는 곳이 없는 항목을 두지 않는다.** 예전에는 「미션」과 「이번 주 운동」이
// `path: '/home'` 만 들고 있었다. 홈에서 누르면 홈으로 가라는 뜻이라 아무 일도
// 일어나지 않았다 — 코드에 `scroll` 처리가 있는데 그걸 쓰는 항목이 하나도 없었다.
// 이제 셋 다 `scroll` 로 그 자리까지 데려간다.

// 초성 추출
function getChosung(str) {
  const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  return [...str].map(c => {
    const code = c.charCodeAt(0) - 0xAC00;
    if (code < 0 || code > 11171) return c;
    return CHO[Math.floor(code / 588)];
  }).join('');
}

function matchSearch(q, item) {
  const ql = q.toLowerCase();
  // 라벨, 키워드 직접 매칭
  if (item.label.toLowerCase().includes(ql)) return true;
  if (item.keywords.some(k => k.toLowerCase().includes(ql))) return true;
  // 초성 매칭
  const labelChosung = getChosung(item.label);
  if (labelChosung.includes(ql)) return true;
  if (item.keywords.some(k => getChosung(k).includes(ql))) return true;
  return false;
}

// `icon` 은 **직접 그린 아이콘의 이름**이다 (`components/NavIcon.jsx`).
// 예전에는 이모지를 글자로 찍었다 — 그림은 애플 · 구글 · 삼성이 각각 그린 것이라
// 남의 것이고, 폰마다 다르게 나온다. 여기 것들은 **길찾기 · 더보기와 같은 그림**을 쓴다.
// 같은 자리로 가는 길인데 검색에서만 다른 그림이면 두 번 익혀야 한다.
// 이름을 잘못 적으면 조용히 빈 칸이 된다 — `npm run check` 가 이름을 맞춰본다
export const SEARCH_ITEMS = [
  // ─── 메인 페이지 ───
  // 탭 이름이 「HOME」에서 「오늘」로 바뀌었다 (2026-09-16). 찾는 말은 둘 다 받는다 —
  // 쓰던 사람은 아직 「홈」이라고 친다. 그림도 탭바와 같은 것을 쓴다(두 번 익히지 않게)
  { label: '오늘', keywords: ['오늘', '홈', '메인', 'home', 'main', '대시보드', 'dashboard', '홈화면', '오늘뭐'], path: '/home', icon: 'body' },
  { label: '루틴 추천', keywords: ['루틴', '추천', 'routine', '분할', '운동루틴', '프로그램', '루', '추'], path: '/routine', icon: 'clipboard' },
  { label: '운동 기록', keywords: ['운동', '기록', 'workout', '세트', '횟수', '중량', 'record', '운', '기'], path: '/train', icon: 'dumbbell' },
  // ── 「몸」 탭 안의 갈래 셋 ── (2026-09-18 에 여기로 돌렸다)
  //
  // **여태 옛 단독 화면으로 보냈다** (`/inbody` · `/measure`). 5차에 인바디 · 재는 도구 ·
  // 견주기를 「몸」 탭 한 자리에 모았는데 검색만 옛 주소를 들고 있었다 — 같은 자리로
  // 가는 길이 두 벌이고, 검색으로 들어간 사람은 **탭바에 아무 칸도 안 켜진 화면**에
  // 서서 옆 갈래로 못 건너갔다. 이제 「몸」으로 데려가고 갈래만 골라준다
  { label: '인바디', keywords: ['인바디', 'inbody', '체중', '체지방', '골격근', '근육량', 'weight', 'body', '인', '체', 'BMI', 'bmi'], path: '/body', tab: 'inbody', icon: 'chart' },
  { label: '견주기', keywords: ['견주기', '비교', 'compare', '전후', '변화', '달라진', '사진', '몸사진'], path: '/body', tab: 'compare', icon: 'trend' },
  // 몸 지도 (2026-09-16). 「오늘 뭐하지」로 찾는 사람이 닿아야 하는 자리다
  { label: '몸 지도', keywords: ['몸지도', '지도', '부위', '오늘뭐', '뭐하지', '회복', '쉰', '식은', 'map', '몸'], path: '/map', icon: 'body' },
  // 기구 (2026-09-17, 7차). 아래 탭바에도 있다 — **탭바와 같은 그림을 쓴다**
  // (같은 자리로 가는 길인데 검색에서만 다른 그림이면 두 번 익혀야 한다)
  { label: '기구 세팅', keywords: ['기구', '세팅', '시트', '발판', '그립', '헬스장', '머신', 'setting', 'gym', 'ㄱㄱ'], path: '/gym', icon: 'wrench' },
  // 목표 (2026-09-17). 홈의 목표 카드에서 들어오는 자리지만, 목표를 접어둔 사람에게는
  // 그 카드가 한 줄로 줄어 있다 — 「목표」로 찾는 사람이 닿을 길은 있어야 한다
  { label: '내 목표', keywords: ['목표', 'goal', '주몇번', '체중목표', '감량', '증량', '연속', '스트릭', 'streak', '다짐', 'ㅁㅍ'], path: '/goal', icon: 'target' },
  { label: '기능성운동', keywords: ['기능성', '기능성운동', '홈트', '홈트레이닝', 'home training', '맨몸', '집운동', '홈워크아웃', '트레이닝'], path: '/homeworkout', icon: 'homegym' },
  { label: '운동 검색', keywords: ['검색', 'search', '운동찾기', '부위', '근육', '찾기'], path: '/search', icon: 'search' },
  { label: '재는 도구', keywords: ['측정', 'measure', '시스템', '재는', '도구'], path: '/body', tab: 'measure', icon: 'ruler' },
  { label: '히스토리', keywords: ['히스토리', 'history', '기록', '과거', '이력', '달력', '히'], path: '/history', icon: 'calendar' },
  { label: '고객센터', keywords: ['고객센터', '고객', '센터', '문의', '제보', '건의', '버그', 'bug', '신고', '오류', '안돼', '안됨', 'faq', 'FAQ', '자주묻는질문', '도움말', 'help', 'support', '소개', '앱정보', '버전', 'ㄱㄱㅅㅌ'], path: '/support', icon: 'chat' },
  { label: '운동 알림', keywords: ['알림', '알람', '리마인더', '푸시', 'push', 'notification', '노티', '깨워', '까먹', '잊어', '요일', '시간', 'ㅇㄷㅇㄹ'], path: '/reminders', icon: 'bell' },
  { label: '공지함', keywords: ['공지', '공지함', '소식', '알림', '업데이트', 'update', '변경', '바뀐것', '패치', 'notice', 'changelog', '새기능', '고침'], path: '/support/notices', icon: 'megaphone' },

  // ─── 「재는 도구」 안의 일곱 ───
  // `tab` 이 「몸」의 갈래(재는 도구)고 `sub` 가 그 안의 칸이다.
  // 둘을 한 번에 골라줘야 「1RM」을 찾은 사람이 **두 번 더 누르지 않는다**
  { label: '전신 사이즈', keywords: ['전신', '사이즈', '둘레', '가슴', '허리', '엉덩이', '팔둘레', '허벅지', '종아리', '목둘레'], path: '/body', tab: 'measure', sub: 'size', icon: 'ruler' },
  { label: '어깨 측정', keywords: ['어깨', 'shoulder', '견봉', '어깨너비', '문짝', '광배', '비율'], path: '/body', tab: 'measure', sub: 'shoulder', icon: 'dumbbell' },
  { label: '1RM 계산', keywords: ['1rm', '1RM', '최대중량', 'one rep max', '벤치프레스', '스쿼트', '데드리프트', '숄더프레스', 'brzycki'], path: '/body', tab: 'measure', sub: 'orm', icon: 'stack' },
  { label: '체력 테스트', keywords: ['체력', '테스트', '푸시업', '풀업', '플랭크', '달리기', '윗몸일으키기', '시트업', '스쿼트', 'fitness'], path: '/body', tab: 'measure', sub: 'fitness', icon: 'flame' },
  { label: '심박수 존', keywords: ['심박수', '심박', 'heart rate', '존', 'zone', '최대심박', '안정심박', '유산소', 'bpm'], path: '/body', tab: 'measure', sub: 'heart', icon: 'heart' },
  { label: '스톱워치 / 타이머', keywords: ['스톱워치', 'stopwatch', '타이머', 'timer', '시간', '랩', 'lap'], path: '/body', tab: 'measure', sub: 'stopwatch', icon: 'clock' },
  { label: '유연성 측정', keywords: ['유연성', 'flexibility', '앉아 앞으로 굽히기', '스트레칭', '스쿼트 깊이'], path: '/body', tab: 'measure', sub: 'flex', icon: 'trend' },

  // ─── 홈 안의 자리 (그 자리로 데려간다) ───
  { label: '오늘 할 것', keywords: ['오늘', 'today', '할것', '지금', '이어서', '진행중'], path: '/home', scroll: 'home-today', icon: 'check' },
  { label: '이번 주 운동', keywords: ['이번주', '주간', '주', 'week', '달력', 'calendar'], path: '/home', scroll: 'home-week', icon: 'calendar' },

  // ─── 관리자 (관리자 권한 필요) ───
  { label: '관리자', keywords: ['관리자', 'admin', '어드민', '점검', '보안', 'AI', '관리'], path: '/admin', icon: 'gear', adminOnly: true },
];

const HISTORY_KEY = SEARCH_HISTORY_KEY;
const HISTORY_MAX = 10;

export default function HomeSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(readLS(HISTORY_KEY)) || []; } catch { return []; }
  });

  const remember = (label) => {
    const updated = [label, ...history.filter(h => h !== label)].slice(0, HISTORY_MAX);
    setHistory(updated);
    saveLS(HISTORY_KEY, JSON.stringify(updated));
  };

  const forget = (label) => {
    const updated = history.filter(h => h !== label);
    setHistory(updated);
    saveLS(HISTORY_KEY, JSON.stringify(updated));
  };

  const forgetAll = () => {
    setHistory([]);
    removeLS(HISTORY_KEY);
  };

  // 데려가는 길은 하나다 — 목록 · 최근 검색 · Enter 가 같은 것을 쓴다
  const go = (item) => {
    if (!item) return;
    if (item.scroll) {
      document.getElementById(item.scroll)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    // `tab` 은 그 화면의 갈래, `sub` 는 갈래 안의 칸이다 (「몸 → 재는 도구 → 1RM」).
    // 둘을 한 번에 실어 보내야 찾은 사람이 **더 안 누른다**
    if (!item.path) return;
    const state = {};
    if (item.tab) state.tab = item.tab;
    if (item.sub) state.sub = item.sub;
    navigate(item.path, Object.keys(state).length ? { state } : undefined);
  };

  const admin = isAdmin();
  const visible = SEARCH_ITEMS.filter(item => !item.adminOnly || admin);
  const results = query.trim() ? visible.filter(item => matchSearch(query, item)) : [];

  const pick = (item) => {
    remember(item.label);
    setQuery('');
    setFocused(false);
    go(item);
  };

  return (
    <div style={{ position: 'relative', marginBottom: 24 }}>
      <input
        type="text"
        className="input"
        placeholder="어디로 갈까요? (예: 1RM, 어깨 측정, 고객센터)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && query.trim()) {
            const top = results[0];
            if (top) { e.target.blur(); pick(top); }
          } else if (e.key === 'Escape') {
            setQuery('');
            setFocused(false);
            e.target.blur();
          }
        }}
        style={{ paddingLeft: 38, fontSize: 14 }}
      />
      <span style={{
        position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
        pointerEvents: 'none', opacity: 0.7, color: 'var(--text-muted)',
      }} aria-hidden="true"><NavIcon name="search" size={16} /></span>

      {focused && (query.trim() || history.length > 0) && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', maxHeight: 320, overflowY: 'auto',
          zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        }}>
          {query.trim() ? (
            results.length === 0 ? (
              // ── 막다른 길을 없앤다 ── (2026-09-17)
              //
              // 여기는 「일치하는 항목이 없어요」로 끝났다. 그런데 **못 찾는 말의
              // 대부분은 운동 이름**이다 — 「벤치프레스」를 치면 이 목록에는 당연히
              // 없다(화면 이름이 아니니까). 정작 운동 사전은 앱 안에 설명까지 달고
              // 있는데, 홈에서 친 사람에게는 없다고만 말했다.
              //
              // 이제 그 말을 들고 운동 검색으로 넘긴다 — 그 화면이 `?q=` 를 받게
              // 고친 것이 이것을 하려던 것이다
              <div style={{ padding: '14px 16px', textAlign: 'center' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>갈 수 있는 화면 중에는 없어요</div>
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const term = query.trim();
                    setQuery('');
                    setFocused(false);
                    navigate(`/search?q=${encodeURIComponent(term)}`);
                  }}
                  style={{
                    marginTop: 10, background: 'none', border: '1px solid var(--border)',
                    color: 'var(--accent)', fontSize: 12.5, padding: '8px 12px',
                    borderRadius: 'var(--radius)', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  「{query.trim().slice(0, 12)}」 운동으로 찾아보기 ›
                </button>
              </div>
            ) : results.map((item, i) => (
              <div
                key={item.label}
                onMouseDown={(e) => { e.preventDefault(); pick(item); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', cursor: 'pointer',
                  borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                {/* **그림을 그린다.** 2026-09-17 까지 여기는 `{item.icon}` 을 그대로
                    찍고 있었다 — 그 값은 그림이 아니라 `'chat'` 같은 **이름**이라,
                    목록에 「chat 고객센터」라고 영어 낱말이 붙어 나왔다. 이모지를 쓰던
                    시절의 줄이 그림으로 바꾼 뒤에도 남아 있었다 (바로 아래 최근 검색은
                    제대로 `NavIcon` 을 쓰고 있어서 한 화면 안에서 둘이 달랐다) */}
                <span style={{ color: 'var(--text-muted)', display: 'flex' }} aria-hidden="true">
                  <NavIcon name={item.icon} size={16} />
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{item.label}</span>
              </div>
            ))
          ) : (
            <>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 14px', borderBottom: '1px solid var(--border)',
                fontSize: 11, color: 'var(--text-muted)',
              }}>
                <span>최근 검색</span>
                <button
                  onMouseDown={(e) => { e.preventDefault(); forgetAll(); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}
                >전체 삭제</button>
              </div>
              {history.map((label, i) => {
                const item = visible.find(s => s.label === label);
                return (
                  <div
                    key={label}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 14px',
                      borderBottom: i < history.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <div
                      onMouseDown={(e) => { e.preventDefault(); setFocused(false); go(item); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: 'pointer' }}
                    >
                      {/* 최근에 친 말은 항목이 아닐 수도 있다 — 그때는 시계를 그린다 */}
                      <span style={{ color: 'var(--text-muted)', display: 'flex' }} aria-hidden="true">
                        <NavIcon name={item?.icon || 'clock'} size={16} />
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
                    </div>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); forget(label); }}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, fontSize: 12 }}
                      aria-label={`${label} 최근 검색에서 지우기`}
                    >✕</button>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
