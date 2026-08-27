import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

export const SEARCH_ITEMS = [
  // ─── 메인 페이지 ───
  { label: '홈', keywords: ['홈', '메인', 'home', 'main', '대시보드', 'dashboard', '홈화면'], path: '/home', icon: '🏠' },
  { label: '루틴 추천', keywords: ['루틴', '추천', 'routine', '분할', '운동루틴', '프로그램', '루', '추'], path: '/routine', icon: '📋' },
  { label: '운동 기록', keywords: ['운동', '기록', 'workout', '세트', '횟수', '중량', 'record', '운', '기'], path: '/workout', icon: '🏋️' },
  { label: '인바디', keywords: ['인바디', 'inbody', '체중', '체지방', '골격근', '근육량', 'weight', 'body', '인', '체', 'BMI', 'bmi'], path: '/inbody', icon: '📊' },
  { label: '홈트레이닝', keywords: ['홈트', '홈트레이닝', 'home training', '맨몸', '집운동', '홈워크아웃', '트레이닝'], path: '/homeworkout', icon: '🏠' },
  { label: '운동 검색', keywords: ['검색', 'search', '운동찾기', '부위', '근육', '찾기'], path: '/search', icon: '🔍' },
  { label: '측정 시스템', keywords: ['측정', 'measure', '시스템'], path: '/measure', icon: '📐' },
  { label: '히스토리', keywords: ['히스토리', 'history', '기록', '과거', '이력', '달력', '히'], path: '/history', icon: '📅' },
  { label: '고객센터', keywords: ['고객센터', '고객', '센터', '문의', '제보', '건의', '버그', 'bug', '신고', '오류', '안돼', '안됨', 'faq', 'FAQ', '자주묻는질문', '도움말', 'help', 'support', '소개', '앱정보', '버전', 'ㄱㄱㅅㅌ'], path: '/support', icon: '📮' },
  { label: '운동 알림', keywords: ['알림', '알람', '리마인더', '푸시', 'push', 'notification', '노티', '깨워', '까먹', '잊어', '요일', '시간', 'ㅇㄷㅇㄹ'], path: '/reminders', icon: '🔔' },
  { label: '공지함', keywords: ['공지', '공지함', '소식', '알림', '업데이트', 'update', '변경', '바뀐것', '패치', 'notice', 'changelog', '새기능', '고침'], path: '/support/notices', icon: '📰' },

  // ─── 측정 시스템 서브 기능 (탭 자동 선택) ───
  { label: '전신 사이즈', keywords: ['전신', '사이즈', '둘레', '가슴', '허리', '엉덩이', '팔둘레', '허벅지', '종아리', '목둘레'], path: '/measure', tab: 'size', icon: '📏' },
  { label: '어깨 측정', keywords: ['어깨', 'shoulder', '견봉', '어깨너비', '문짝', '광배', '비율'], path: '/measure', tab: 'shoulder', icon: '💪' },
  { label: '1RM 계산', keywords: ['1rm', '1RM', '최대중량', 'one rep max', '벤치프레스', '스쿼트', '데드리프트', '숄더프레스', 'brzycki'], path: '/measure', tab: 'orm', icon: '🔢' },
  { label: '체력 테스트', keywords: ['체력', '테스트', '푸시업', '풀업', '플랭크', '달리기', '윗몸일으키기', '시트업', '스쿼트', 'fitness'], path: '/measure', tab: 'fitness', icon: '🏃' },
  { label: '심박수 존', keywords: ['심박수', '심박', 'heart rate', '존', 'zone', '최대심박', '안정심박', '유산소', 'bpm'], path: '/measure', tab: 'heart', icon: '❤️' },
  { label: '스톱워치 / 타이머', keywords: ['스톱워치', 'stopwatch', '타이머', 'timer', '시간', '랩', 'lap'], path: '/measure', tab: 'stopwatch', icon: '⏱️' },
  { label: '유연성 측정', keywords: ['유연성', 'flexibility', '앉아 앞으로 굽히기', '스트레칭', '스쿼트 깊이'], path: '/measure', tab: 'flex', icon: '🧘' },

  // ─── 홈 안의 자리 (그 자리로 데려간다) ───
  { label: '오늘 할 것', keywords: ['오늘', 'today', '할것', '지금', '이어서', '진행중'], path: '/home', scroll: 'home-today', icon: '☀️' },
  { label: '이번 주 운동', keywords: ['이번주', '주간', '주', 'week', '달력', 'calendar'], path: '/home', scroll: 'home-week', icon: '📅' },
  { label: '미션', keywords: ['미션', 'mission', '목표', 'weekly'], path: '/home', scroll: 'home-missions', icon: '🎯' },

  // ─── 관리자 (관리자 권한 필요) ───
  { label: '관리자', keywords: ['관리자', 'admin', '어드민', '점검', '보안', 'AI', '관리'], path: '/admin', icon: '⚙️', adminOnly: true },
];

const HISTORY_KEY = 'ironlog_search_history';
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
    if (item.path) navigate(item.path, item.tab ? { state: { tab: item.tab } } : undefined);
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
        position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
        fontSize: 15, pointerEvents: 'none', opacity: 0.7,
      }} aria-hidden="true">🔍</span>

      {focused && (query.trim() || history.length > 0) && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', maxHeight: 320, overflowY: 'auto',
          zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        }}>
          {query.trim() ? (
            results.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                일치하는 항목이 없어요
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
                <span style={{ fontSize: 18 }} aria-hidden="true">{item.icon}</span>
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
                      <span style={{ fontSize: 14 }} aria-hidden="true">{item?.icon || '🕒'}</span>
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
