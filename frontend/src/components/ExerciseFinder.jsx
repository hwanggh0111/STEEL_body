import { useState, useMemo, useEffect } from 'react';
import { searchExercises, isPart, PARTS, hasExercise } from '../data/exerciseDict';

// ── 자세 설명은 **눌렀을 때** 받는다 ── (2026-10-05)
//
// `exerciseForm.js` 는 78KB 다 (운동 219개의 순서 · 조심할 것). 그런데 그것은
// 「자세 보기」를 눌러야 보는 것인데, 여기서 통째로 들여오고 있어서 **「운동」 탭을
// 열기만 해도** 다 받았다. 찾기만 하고 자세는 한 번도 안 보는 사람이 대부분이다.
//
// **단추를 그릴지는 사전으로 안다**(`hasExercise`) — 검사가 「사전의 이름 = 자세
// 설명의 열쇠」를 지키고 있어서 사전만 보면 된다. 사전은 어차피 들고 있다.
//
// 한 번 받으면 그대로 둔다. 두 번째 카드부터는 기다림이 없다.
let _form = null;
let _loading = null;
function loadForm() {
  if (_form) return Promise.resolve(_form);
  if (!_loading) {
    _loading = import('../data/exerciseForm')
      .then((m) => { _form = m; return m; })
      .catch(() => { _loading = null; return null; });   // 다음에 다시 해본다
  }
  return _loading;
}

// 운동 찾기 — **화면이 아니라 부품이다.**
//
// 이 덩어리는 원래 「운동 검색」 화면 안에만 있었다. 그래서 기록하다 운동 이름이
// 생각 안 나면 **화면을 나갔다 들어와야** 했다 — 적으려던 것을 도중에 끊는 셈이다.
//
// 9/1 에 기록 화면에도 넣으면서 **복붙하지 않고 떼어냈다.** 같은 것을 두 곳에 두면
// 반드시 한쪽만 고쳐진다 (이 앱에서 이미 여러 번 겪었다 — 점검 아이콘 · 보안 규칙 ·
// 응답 모양). 지금은 「운동 검색」 화면과 기록 화면이 **이 파일 하나**를 같이 쓴다.
//
// 하는 일은 둘이다:
//   · 앱 안의 사전을 **치는 동안 바로** 보여준다 (한국어 · 영어 · 초성 · 부위 · 근육)
//   · 운동마다 **자세 설명**을 눌러서 편다 (순서 · 조심할 것)
//
// ── 「인터넷에서 더 찾기」는 2026-10-21 에 걷어냈다 ──
//
// 앱에서 못 찾으면 **눌렀을 때만** 외부 DB(wger.de)에 물었다. 그런데 **그 길이
// 죽어 있었다** — `GET https://wger.de/api/v2/exercise/search/` 가 **404** 다
// (그쪽이 API 를 바꿨다. 지금 그 집의 길 목록에 `exercise/search` 가 아예 없다).
//
// 그래서 누르면 늘 이렇게 끝났다 —
//
//     「인터넷에서 찾지 못했어요. **잠시 후 다시 해보세요.**」  + 재시도 단추
//
// **거짓말이다.** 잠시 후에도, 내일도 안 된다. 이 파일이 바로 위에서
// 「눌러도 아무 일이 안 일어나는 자리를 남기면 고장으로 읽힌다」고 적어둔 그것이고,
// 알림 쪽에서 정한 「**될 것처럼 말하면 안 된다**」(`LoginPage` 의 `not_configured`)
// 와도 어긋난다.
//
// **되살리지 않았다.** 그쪽에 이름으로 찾는 길이 지금 없다 — 운동 932개를 통째로
// 받아 이름은 `exercise-translation` 에서 따로 맞춰야 하는데, 「눌러야 나가는 길」
// 하나에 그걸 둘 수는 없다. 그리고 애초에 **그 자료가 더 나빴다** — 이 화면의
// 맨 첫 머리글이 그 말이다: 「영어 이름뿐이라 설명이 없었다 · 좋은 자료를 버리고
// 더 나쁜 것을 기다린 셈이다」. 사전은 219개 전부에 설명과 자세가 달려 있다.
//
// 못 찾았을 때 할 수 있는 일은 **그대로 쓰기**다(자유 입력이다 — 적으면 기록되고,
// 이름의 낱말로 부위도 맞혀본다). 그 카드에 **부위로 둘러보는 길**을 같이 뒀다.
//
// **「같은 갈래 보기」는 2026-09-02 에 걷어냈다.** 「벤치프레스」를 찾으면 인클라인 ·
// 디클라인이 **이미 그 목록에 다 나와 있다** — 사전 검색이 갈래 이름까지 보기 때문이다.
// 눌러서 펼치면 방금 본 것을 다시 보여줄 뿐이었고, 카드마다 단추가 둘이라 정작
// 「자세 보기」가 어느 것인지 한 번 더 읽어야 했다.
//
// 고른 뒤에 무엇을 할지는 **쓰는 쪽이 정한다**(`onPick`) — 검색 화면은 기록 화면으로
// 데려가고, 기록 화면은 그 자리에서 이름 칸을 채운다.

// 부위 단추 — **사전이 아는 부위를 그대로 쓴다.**
// 여기에 손으로 적어두면 사전에 부위를 하나 더 만들었을 때 이 단추만 옛 목록으로 남는다.
// 「등」 · 「팔」이 안 나오던 것도 이 자리와 사전이 따로 놀아서 생긴 일이다
const CATEGORIES = PARTS.map((label) => ({ label, q: label }));

// 아래에 붙는 「자세 보기」. 글자만 놓아두면 눌러도 되는 것인지 모른다. 단추로 그린다
function MoreLink({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer',
        fontSize: 11.5, color: 'var(--text-muted)', textDecoration: 'underline',
        textUnderlineOffset: 3,
      }}
    >{children}</button>
  );
}

// 카드에 할 일이 둘이다 — 고르기와 자세 보기.
// 카드를 통째로 「고르기」로 두면 자세를 볼 방법이 없어진다.
// 그래서 **고르는 것은 오른쪽 단추**, 자세는 아래 줄의 단추다.
//
// **자세 설명을 붙인 이유** (2026-09-02) — 사전의 한 줄(`desc`)은 「그게 무슨
// 운동인가」이지 「어떻게 하는가」가 아니다. 「손 모아 다이아몬드. 삼두 + 가슴 안쪽」을
// 읽고 처음 하는 사람이 그 자세를 잡을 수는 없다. 순서 서너 줄과 **조심할 것 한 줄**을
// 눌러서 볼 수 있게 뒀다 — 늘 펼쳐두면 목록에서 운동을 못 고른다.
// `tag`(「인터넷」 딱지)는 2026-10-21 에 같이 걷었다 — 넘기는 자리가 외부 DB 결과뿐이었다
function Card({ ko, en, desc, pickLabel, onPick }) {
  const [openForm, setOpenForm] = useState(false);
  // 받아온 자세 설명. 누르기 전에는 null 이다
  const [form, setForm] = useState(null);
  // 사전에 없는 이름에는 자세 설명이 없다. 그때는 단추를 아예 안 그린다 —
  // 눌러도 아무 일이 안 일어나는 자리를 남기면 고장으로 읽힌다.
  // **받기 전에 알아야 하는 값이라 사전에 묻는다** (위의 loadForm 머리글).
  // 지금 이 카드에 오는 것은 사전 결과뿐이지만(외부 DB 를 걷었다) 검사는 남겨둔다 —
  // 「괄호 안을 뗀 이름」처럼 사전에 없는 꼴이 들어올 길이 아직 있다(`hasExercise`)
  const canOpen = hasExercise(ko);

  // **못 받은 것은 말한다** (2026-10-20에 고쳤다).
  //
  // 머리글에는 「접어두고 **말한다**」고 적혀 있었는데 코드는 `setOpenForm(false)` 로
  // **접기만 했다.** 신호가 끊긴 자리에서 「자세 보기」를 누르면 「불러오는 중…」이
  // 잠깐 떴다 사라지고 **아무 말도 없이 처음으로 돌아간다** — 이 파일이 바로 위에서
  // 「눌러도 아무 일이 안 일어나는 자리를 남기면 고장으로 읽힌다」고 적어둔 그것이다.
  const [formErr, setFormErr] = useState(false);
  const tryForm = async () => {
    setFormErr(false);
    const m = await loadForm();
    // 못 받으면 **펴둔 채로 말한다.** 다시 받는 것은 되는 일이다 — `loadForm` 이
    // 실패한 약속을 버려서(`_loading = null`) 다음 번에 다시 받으러 간다
    if (!m) { setFormErr(true); return; }
    setForm(m.formOf(ko));
  };
  const toggleForm = () => {
    if (openForm) { setOpenForm(false); return; }
    setOpenForm(true);
    if (!form) tryForm();
  };
  return (
    <div className="card list-item" style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flexGrow: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif", fontSize: 16, letterSpacing: 1.5, color: 'var(--text-primary)' }}>
              {ko}
            </span>
          </div>
          {en && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{en}</div>}
          {desc && (
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 5, lineHeight: 1.65 }}>
              {desc}
            </div>
          )}
        </div>
        <button
          className="btn-secondary"
          style={{ flexShrink: 0, whiteSpace: 'nowrap', padding: '6px 12px' }}
          onClick={onPick}
        >{pickLabel}</button>
      </div>
      {canOpen && (
        <div style={{ marginTop: 6 }}>
          <MoreLink onClick={toggleForm}>
            {openForm ? '자세 접기' : '자세 보기'}
          </MoreLink>
        </div>
      )}

      {/* 받는 사이 — 보통 눈에 안 띄게 짧지만, 느린 신호에서는 눌렀는데 아무 일도
          안 일어나는 것처럼 보인다 */}
      {openForm && !form && (formErr ? (
        // **못 받은 것과 없는 것은 다르다.** 이 운동에 자세 설명이 없는 것이 아니라
        // (없으면 단추를 안 그린다) 조각이 안 온 것이다
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          자세 설명을 못 불러왔어요.{' '}
          <button
            type="button"
            onClick={tryForm}
            style={{
              background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 12, color: 'var(--accent)',
              textDecoration: 'underline', textUnderlineOffset: 3,
            }}
          >다시 받기</button>
        </div>
      ) : (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>불러오는 중…</div>
      ))}

      {openForm && form && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 6 }}>
            이렇게 합니다
          </div>
          {/* 순서가 있는 것이라 번호를 매긴다 — 이 자리에서는 번호가 장식이 아니다 */}
          <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {form.steps.map((line) => (
              <li key={line} style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                {line}
              </li>
            ))}
          </ol>
          {/* **조심할 것은 따로 세운다.** 순서에 섞어두면 다치는 자리가 묻힌다 */}
          {form.careful && (
            <div style={{
              marginTop: 10, padding: '8px 10px',
              borderLeft: '2px solid var(--warning)', background: 'var(--bg-tertiary)',
              fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7,
            }}>
              <span style={{ color: 'var(--warning)' }}>조심할 것 — </span>
              {form.careful}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * @param onPick      운동을 고르면 부르는 함수. 이름(문자열)을 준다
 * @param pickLabel   고르는 단추에 적을 말 ('기록하기' · '이 운동으로')
 * @param autoFocus   열자마자 입력칸에 커서를 둘지 (기록 화면에서 펼칠 때 쓴다)
 * @param compact     기록 화면 안에 들어갈 때. 머리 설명을 줄인다
 */
// `initialQuery` — 열자마자 찾아둔 채로 시작한다. 몸 지도에서 「등 운동 찾기」로
// 들어오는 자리에 쓴다. 처음 값일 뿐이라 사람이 지우면 그대로 지워진다
export default function ExerciseFinder({ onPick, pickLabel = '기록하기', autoFocus = false, compact = false, initialQuery = '' }) {
  const [query, setQuery] = useState(initialQuery);

  // 부위 이름은 한 글자여도 찾는다 (「등」 · 「팔」)
  const typed = query.trim().length >= 2 || isPart(query);
  // 앱 안의 사전은 네트워크가 필요 없다. 치는 동안 바로 나온다
  const results = useMemo(() => (typed ? searchExercises(query) : []), [query, typed]);

  // ── 자세 설명을 **지하에 가기 전에 담아둔다** ── (2026-10-20)
  //
  // 10/5 에 이 조각(78KB)을 「자세 보기」를 누를 때 받게 갈랐다. 가른 것은 맞는데,
  // **받아온 조각을 담아두는 길이 「한 번 받아본 것」뿐이다** — 서비스 워커가 미리
  // 담는 것은 껍데기 둘(`/` · `/index.html`)이고 나머지는 지나간 것을 담는다.
  // 그래서 **신호 없는 헬스장에서 처음 누르면 안 온다.** 오늘 붙인 「다시 받기」는
  // 말을 해주는 것일 뿐이고, 신호가 없으면 다시 받아도 안 온다.
  //
  // 운동을 찾아 목록을 보고 있는 사람은 **한 번 누르면 닿는 자리**에 있다. 그 틈에
  // 조용히 받아둔다 — 첫 그림을 막지 않게 **한가할 때** 받고, 데이터 아끼기를 켠
  // 사람과 이미 신호가 없는 사람은 건드리지 않는다. 실패해도 아무 말도 안 한다
  // (`loadForm` 이 실패한 약속을 버리므로 눌렀을 때 다시 해본다).
  useEffect(() => {
    if (!results.length) return undefined;
    if (navigator.onLine === false) return undefined;
    if (navigator.connection?.saveData) return undefined;
    const run = () => { loadForm(); };
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(run, { timeout: 3000 });
      return () => window.cancelIdleCallback?.(id);
    }
    // 사파리에는 `requestIdleCallback` 이 없다. 조금 늦게 받는 것으로 갈음한다
    const t = setTimeout(run, 1500);
    return () => clearTimeout(t);
  }, [results.length]);

  const setQ = (v) => setQuery(v);

  return (
    <div>
      {!compact && (
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.7 }}>
          한국어 · 영어 · 초성으로 찾습니다. 부위 이름으로도 됩니다.
          <br />인터넷이 끊겨도 찾을 수 있습니다.
        </p>
      )}

      <input
        className="input"
        value={query}
        autoFocus={autoFocus}
        onChange={(e) => setQ(e.target.value)}
        placeholder="벤치프레스 · ㅂㅊㅍㄹㅅ · 가슴 · squat"
        style={{ marginBottom: 10 }}
      />

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: compact ? 12 : 18 }}>
        {CATEGORIES.map((c) => (
          <button
            key={c.q}
            className={`btn-secondary${query.trim() === c.q ? ' active' : ''}`}
            onClick={() => setQ(c.q)}
          >{c.label}</button>
        ))}
      </div>

      {!typed ? (
        <div className="empty-state" style={{ padding: compact ? '20px 0' : '40px 0' }}>
          <div className="empty-state-title">무엇을 찾으세요</div>
          <div className="empty-state-desc">두 글자부터 찾기 시작합니다. 위의 부위를 눌러도 됩니다.</div>
        </div>
      ) : (
        <>
          {results.length > 0 && (
            <>
              <div className="label">앱에 있는 운동 {results.length}개</div>
              {results.map((e) => (
                <Card
                  key={e.ko}
                  ko={e.ko}
                  en={e.en}
                  desc={e.desc}
                  pickLabel={pickLabel}
                  onPick={() => onPick(e.ko)}
                />
              ))}
            </>
          )}

          {/* ── 못 찾았을 때 ──
              **할 수 있는 일만 준다**(2026-10-21). 여기 아래에 「인터넷에서 더 찾기」가
              있었는데 그 길이 죽어 있었다(위 머리글) — 누르면 늘 「잠시 후 다시
              해보세요」였다. 걷어내고, 그 자리에 **되는 것 둘**을 남긴다:
              이름 그대로 쓰기 · 부위로 둘러보기 */}
          {results.length === 0 && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
                앱 안에서는 못 찾았어요
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                <b style={{ color: 'var(--text-primary)', fontWeight: 600 }}>이름 그대로 적으셔도 그대로 기록됩니다.</b>{' '}
                사전에 없는 이름도 낱말을 보고 부위를 맞혀봅니다.
                <br />오타일 수도 있어요 — 위의 부위 단추로 둘러보시거나,
                근육 이름(이두 · 복근 · 광배근)으로도 찾을 수 있습니다.
              </div>
              <button
                className="btn-primary"
                style={{ marginTop: 12 }}
                onClick={() => onPick(query.trim())}
              >「{query.trim()}」 그대로 쓰기</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
