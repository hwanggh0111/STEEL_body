import { useRefreshTick } from '../store/refreshStore';
import ImportCsv from '../components/ImportCsv';
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import client from '../api/client';
import { toast } from '../components/Toast';
import { isOfflineError } from '../data/offline';
import { measurePayload, UNDO_MS } from '../data/undoRow';
import { confirmDialog } from '../components/ConfirmModal';
import BodySizeSection from '../components/measure/BodySizeSection';
import OneRMSection from '../components/measure/OneRMSection';
import FitnessTestSection from '../components/measure/FitnessTestSection';
import HeartRateSection from '../components/measure/HeartRateSection';
import StopwatchSection from '../components/measure/StopwatchSection';
import FlexibilitySection from '../components/measure/FlexibilitySection';
import ShoulderSection from '../components/measure/ShoulderSection';
import { dateKey } from '../data/dateKey';
import { readLS } from '../data/safeStorage';
import { TOKEN_KEY } from '../data/localKeys';

// 일곱 가지 도구.
//
// 예전에는 **작은 탭 일곱 개가 옆으로 스크롤**됐다. 무엇이 있는지 한눈에 안 보이고,
// 글자도 11px 에 누르는 자리도 작았다 (앱의 다른 곳은 44px 을 지킨다).
//
// 골라 쓰는 도구 상자에 가깝다고 보고, 격자로 펼쳤다. `desc` 는 그게 뭘 하는지다 —
// 이름만으로는 「어깨 측정」과 「전신 사이즈」가 어떻게 다른지 알 수 없다.
const TABS = [
  { key: 'size', label: '전신 사이즈', desc: '가슴 · 허리 · 팔 · 허벅지 둘레' },
  { key: 'shoulder', label: '어깨 측정', desc: '어깨너비와 허리 대비 비율' },
  { key: 'orm', label: '1RM 계산', desc: '든 무게와 횟수로 최대 중량 환산' },
  { key: 'fitness', label: '체력 테스트', desc: '푸시업 · 플랭크 · 달리기 기록' },
  { key: 'heart', label: '심박수 존', desc: '나이로 유산소 구간 계산' },
  { key: 'stopwatch', label: '스톱워치 · 타이머', desc: '재고 남기기' },
  { key: 'flex', label: '유연성', desc: '앞으로 굽히기 · 스쿼트 깊이' },
];

// `embedded` — 「몸」 화면 안에 들어가 있다 (5차 리모델링, 2026-09-04).
// 제목은 「몸」이 들고 있다
export default function MeasurePage({ embedded = false, subTab = null }) {
  const location = useLocation();
  // 검색에서 navigate state로 탭 지정 가능
  // 지정해서 들어오지 않으면 **목록부터** 연다. 예전에는 늘 '전신 사이즈'가 열렸는데,
  // 대부분은 다른 걸 하러 온다
  //
  // ── 아는 칸만 받는다 ── (2026-09-18)
  //
  // 여태 `location.state.tab` 을 **그대로 믿었다.** 「몸」 탭 안에 들어가 있을 때
  // 그 state 는 「몸」의 갈래 이름(`'measure'`)이라 여기 칸 이름이 아니다 —
  // 그대로 넣으면 `TABS.find` 가 아무것도 못 찾아서 **아무 칸도 아닌 빈 화면**이 열린다.
  // 주소에 아무나 아무것이나 넣을 수 있는 자리이기도 하다.
  // 갈래 안의 칸은 「몸」이 `subTab` 으로 따로 넘겨준다
  const known = (k) => (TABS.some((t) => t.key === k) ? k : null);
  const initialTab = known(subTab) || known(location.state?.tab);
  const [tab, setTab] = useState(initialTab);
  const [measures, setMeasures] = useState([]);
  const [loading, setLoading] = useState(true);
  // ── **못 받은 것과 없는 것은 다르다** ── (2026-11-09)
  //
  // 여태 실패를 토스트로만 알렸다. 토스트가 사라지면 갈래마다
  // **「데이터 없음 — 어깨 측정 기록이 없어요」** 가 남는다 — **재둔 사람에게
  // 안 쟀다고 말하는 것**이다. 갈래가 일곱이라 그 말이 일곱 자리에 있다.
  // 그래서 **갈래를 그리기 전에 한 자리에서** 가린다 (받는 중 · 받음 · 못 받음)
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);

  // 검색에서 다시 들어올 때 칸을 따라간다. **아는 칸일 때만** 옮긴다 (위 참고)
  useEffect(() => {
    const want = known(subTab) || known(location.state?.tab);
    if (want) setTab(want);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab, location.state?.tab, location.key]);

  // 머리의 새로고침이 올리는 값. deps 에 넣는 것만으로 다시 받는다
  const refreshTick = useRefreshTick();

  useEffect(() => {
    setFailed(false);
    client.get('/measures')
      // 서버가 배열을 준다. 다른 모양이 오면 빈 것으로 친다 —
      // 목록을 그리는 코드에 객체가 들어가면 화면이 통째로 죽는다
      .then(({ data }) => setMeasures(Array.isArray(data) ? data : []))
      // **상태로 남긴다** — 토스트만으로는 사라진 뒤에 거짓이 남는다 (2026-11-09)
      .catch(() => { setFailed(true); toast('측정 데이터를 불러오지 못했어요', 'error'); })
      .finally(() => setLoading(false));
  }, [refreshTick, retry]);

  const filterByType = (type) => measures.filter(m => m.type === type);

  // 히스토리의 CSV 내보내기와 같은 방식이다 — 쿠키 인증이라 fetch 로 받아
  // blob 으로 내려받는다. 문서에 붙이지 않은 링크는 클릭해도 아무 일이 안 일어나는
  // 브라우저가 있고, 곧바로 revoke 하면 내려받기 전에 주소가 사라져 빈 파일이 된다
  const exportMeasures = () => {
    const baseURL = import.meta.env.VITE_API_URL || '/api';
    const token = readLS(TOKEN_KEY);
    fetch(`${baseURL}/export/measures`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    })
      .then(res => { if (!res.ok) throw new Error('export failed'); return res.blob(); })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'blackiron_measures.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        toast('측정 기록 CSV 내보내기 완료!');
      })
      .catch(() => toast('내보내기에 실패했어요', 'error'));
  };

  // 저장 중에는 두 번째 누름을 버린다.
  // 여섯 갈래(둘레 · 어깨 · 1RM · 체력 · 스톱워치 · 유연성)가 전부 여기를 지난다 —
  // 갈래마다 막으면 하나를 빠뜨린다
  const handleSave = async (type, data) => {
    if (saving) return;
    setSaving(true);
    try {
      const date = data.date || dateKey();
      const payload = { type, date, data };

      // ── **담는 일과 다시 받는 일을 가른다** ── (2026-11-04)
      //
      // 여태 둘을 한 `try` 에 넣고, 어느 쪽이 터져도 **「저장에 실패했어요」**라고
      // 했다. 그런데 담기는 이미 끝난 뒤에 받기가 끊기면 **그 말이 거짓이다** —
      // 그 말을 들은 사람은 **같은 둘레를 다시 적고**, 측정 기록이 두 벌 쌓인다.
      //
      // 홈트에서 이미 배운 자리다(`HomeworkoutPage`: 「'못 올렸다'가 사실이 아니었던
      // 것이다 … 그 말을 듣고 직접 적으면 앞의 둘이 두 번 쌓인다」). **그 교훈이
      // 이 길에는 안 닿아 있었다.**
      try {
        await client.post('/measures', payload);
      } catch (err) {
        // 서버가 「그렇게는 안 받는다」고 답했으면 **그 말을 그대로** 전한다.
        // 신호가 없는 것은 다시 눌러야 하는 일이라 그렇게 적는다 (측정은 줄이 없다 —
        // 적은 값은 칸에 그대로 있으니 신호가 오면 그 자리에서 다시 누르면 된다)
        toast(isOfflineError(err)
          ? '신호가 없어 저장하지 못했어요 — 적은 값은 그대로 있어요. 신호가 오면 다시 눌러주세요'
          : (err.response?.data?.error || '저장에 실패했어요'), 'error');
        return;
      }

      try {
        const { data: refreshed } = await client.get('/measures');
        // 위의 첫 로드와 같은 이유로 지킨다
        setMeasures(Array.isArray(refreshed) ? refreshed : []);
        toast('저장 완료!');
      } catch {
        // **담긴 것은 담겼다.** 목록만 못 맞췄다고 말한다
        toast('저장했어요 — 목록은 못 받아왔어요. 새로고침하면 보입니다');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const ok = await confirmDialog(
      '이 측정 기록을 삭제할까요?\n\n지운 바로 뒤 몇 초 동안만 되돌릴 수 있어요.',
      { title: '측정 기록 삭제', confirmText: '삭제' },
    );
    if (!ok) return;
    // ★ **지우기 전에 줄을 뜬다** (2026-11-11) — `deleteMeasure` 도 줄을 바로 지운다
    // (소프트 삭제가 없다). 측정은 **고치는 길이 없어** 되돌릴 것은 지우기 하나다
    const before = measures.find((m) => m.id === Number(id)) || null;
    const body = before ? measurePayload(before) : null;
    try {
      await client.delete(`/measures/${id}`);
      setMeasures(prev => prev.filter(m => m.id !== Number(id)));
      toast('삭제 완료!', 'success', body ? {
        label: '되돌리기', ms: UNDO_MS,
        run: async () => {
          // ★ **담는 일과 받는 일을 가른다** — 한 뭉치에 넣으면 담긴 뒤에 받기가
          // 끊겼을 때 「되살리지 못했어요」라는 **거짓말**을 한다(위 `handleSave` 의
          // 머리글 · 11/04 에 그 자리를 고쳤다). `npm run basement` 가 이것을 본다
          try {
            await client.post('/measures', body);
          } catch (err) {
            toast(err.response?.data?.error || '되살리지 못했어요', 'error');
            return;
          }
          try {
            const { data: refreshed } = await client.get('/measures');
            setMeasures(Array.isArray(refreshed) ? refreshed : []);
            toast('되살렸어요');
          } catch {
            // **담긴 것은 담겼다.** 목록만 못 맞췄다고 말한다
            toast('되살렸어요 — 목록은 못 받아왔어요. 새로고침하면 보입니다');
          }
        },
      } : null);
    } catch (err) {
      // 서버가 적어 보낸 까닭을 그대로 전한다 (2026-11-04)
      toast(err.response?.data?.error || '삭제에 실패했어요', 'error');
    }
  };

  if (loading) {
    return (
      <div>
        {!embedded && <div className="section-title"><div className="accent-bar" />측정 시스템</div>}
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          로딩 중...
        </div>
      </div>
    );
  }

  return (
    <div>
      {!embedded && <div className="section-title"><div className="accent-bar" />측정 시스템</div>}

      {!tab ? (
        <>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.7 }}>
            재고 남기는 도구들입니다. 무엇을 하실지 골라주세요.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="card clickable"
                style={{
                  textAlign: 'left', minHeight: 76, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4,
                  fontFamily: "'Barlow', 'IBM Plex Sans KR', sans-serif",
                }}
              >
                <span style={{
                  fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif", fontSize: 15, letterSpacing: 1.5,
                  color: 'var(--text-primary)',
                }}>{t.label}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t.desc}</span>
              </button>
            ))}
          </div>

          {/* 내보내기.
              운동과 인바디는 히스토리에서 CSV 로 뽑을 수 있는데 **측정만 길이 없었다.**
              전신 사이즈를 1년 재둔 사람이 그것만 못 꺼낸다.
              종류마다 칸이 달라서 한 줄에 한 항목으로 길게 편다 */}
          {/* ── 챙겨 나가기와 그 짝 ── (가져오기는 2026-09-18 에 붙였다)
              내보내기는 잰 것이 있을 때만 나온다. **가져오기는 정반대**다 —
              새 기기에서 아무것도 없을 때가 제일 필요한 순간이라 늘 그린다 */}
          <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {measures.length > 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                지금까지 {measures.length}건 재두셨어요
              </span>
            )}
            <span style={{ display: 'flex', gap: 7, marginLeft: 'auto', flexWrap: 'wrap' }}>
              {measures.length > 0 && (
                <button
                  className="btn-secondary"
                  onClick={exportMeasures}
                  style={{ width: 'auto', padding: '6px 14px', fontSize: 12 }}
                >CSV 로 내보내기</button>
              )}
              <ImportCsv
                kind="measures"
                label="측정"
                onDone={() => client.get('/measures')
                  .then(({ data }) => setMeasures(Array.isArray(data) ? data : []))
                  .catch(() => {})}
                style={{ padding: '7px 12px', fontSize: 12 }}
              />
            </span>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button className="btn-secondary" onClick={() => setTab(null)}>‹ 도구 고르기</button>
          <div style={{
            fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif", fontSize: 17, letterSpacing: 1.5,
            color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{TABS.find(t => t.key === tab)?.label}</div>
        </div>
      )}

      {/* ★ **못 받았으면 갈래를 안 그린다** (2026-11-09).

          갈래마다 「…기록이 없어요」가 적혀 있어서(일곱 자리), 못 받아온 것이
          **재둔 사람에게 안 쟀다고 말하는 것**이 된다. 갈래 일곱을 각자 고치는
          대신 **한 자리에서** 가린다 — 「없다」고 말할 자리가 하나도 안 열린다.

          기록이 있는데 못 받은 것인지 정말 없는 것인지 우리는 모른다. 그래서
          **모른다고 말하고 다시 받는 길을 준다** (`FeedDetailBody` 와 같은 선) */}
      {failed && measures.length === 0 ? (
        <div className="empty-state" style={{ padding: '28px 0' }}>
          <div className="empty-state-title">측정 기록을 못 불러왔어요</div>
          <div className="empty-state-desc">
            안 잰 것이 아니라, 지금 목록을 받아오지 못했어요.<br />
            <button
              type="button"
              onClick={() => setRetry((n) => n + 1)}
              style={{
                background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13, color: 'var(--accent)',
                textDecoration: 'underline', textUnderlineOffset: 3,
              }}
            >다시 받기</button>
          </div>
        </div>
      ) : (<>
      {tab === 'size' && <BodySizeSection records={filterByType('bodySize')} onSave={(data) => handleSave('bodySize', data)} onDelete={handleDelete} />}
      {tab === 'shoulder' && <ShoulderSection records={filterByType('shoulder')} onSave={(data) => handleSave('shoulder', data)} onDelete={handleDelete} />}
      {tab === 'orm' && <OneRMSection records={filterByType('oneRM')} onSave={(data) => handleSave('oneRM', data)} onDelete={handleDelete} />}
      {tab === 'fitness' && <FitnessTestSection records={filterByType('fitness')} onSave={(data) => handleSave('fitness', data)} onDelete={handleDelete} />}
      {tab === 'heart' && <HeartRateSection />}
      {tab === 'stopwatch' && <StopwatchSection onSave={(data) => handleSave('stopwatch', data)} />}
      {tab === 'flex' && <FlexibilitySection records={filterByType('flexibility')} onSave={(data) => handleSave('flexibility', data)} onDelete={handleDelete} />}
      </>)}
    </div>
  );
}
