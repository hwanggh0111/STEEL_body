import { Component } from 'react';

// 화면이 죽었을 때 사람에게 보이는 것.
//
// **이 앱에는 에러 경계가 하나도 없었다.** 어느 화면에서든 렌더가 한 번 던지면
// React 는 트리를 통째로 버린다 — 남는 것은 **흰 화면**이다. 아무 글자도, 버튼도
// 없다. 쓰는 사람은 앱이 망가졌다고 생각하고 지운다. 우리는 무슨 일이 있었는지
// 영영 모른다.
//
// 여기서 하는 일은 셋이다.
//   1. 흰 화면 대신 무슨 일인지 한 줄로 말한다
//   2. 사람이 지금 할 수 있는 것을 준다 — 새로고침 · 홈으로
//   3. 「앱이 새 판으로 바뀐 것」은 잘못이 아니라 안내다. 그건 저절로 고친다
//
// 배포 직후가 그렇다. 화면은 옛 판을 들고 있는데 서버에는 새 파일만 있다. 안 열어본
// 탭을 누르는 순간 그 조각을 못 받아온다 — 잘못된 것이 아니라 **오래된 것**이다.

// 조각(청크)을 못 받아온 것인가. 브라우저마다 말이 달라서 넓게 본다
export function isStaleChunk(err) {
  const msg = String(err?.message || err || '');
  return /dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError|Failed to fetch/i.test(msg);
}

// 새로고침을 한 번만 한다. 새로 받아도 같은 오류면 고리에 갇힌다 —
// 그때는 안내를 띄우고 사람에게 넘긴다
const RELOAD_KEY = 'sb_reloaded_for_error';

function reloadedAlready() {
  try {
    return sessionStorage.getItem(RELOAD_KEY) === '1';
  } catch {
    // 저장소를 막아둔 브라우저. 확인할 길이 없으면 새로고침을 안 한다 —
    // 고리에 갇히는 것보다 안내를 보는 편이 낫다
    return true;
  }
}

function markReloaded() {
  try {
    sessionStorage.setItem(RELOAD_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

export function clearReloadMark() {
  try {
    sessionStorage.removeItem(RELOAD_KEY);
  } catch { /* 막혀 있으면 그냥 둔다 */ }
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { err: null, stale: false };
  }

  static getDerivedStateFromError(err) {
    return { err, stale: isStaleChunk(err) };
  }

  componentDidCatch(err, info) {
    // 오래된 조각이면 한 번은 저절로 새로 받는다. 사람이 뭘 잘못한 게 아니다
    if (isStaleChunk(err) && !reloadedAlready() && markReloaded()) {
      window.location.reload();
      return;
    }
    // **무엇이 터졌는지를 서버로 한 줄 보낸다.**
    //
    // 이 안내를 본 사람 열에 아홉은 제보를 안 적고 그냥 나간다. 그러면 우리는
    // 흰 화면이 났다는 것조차 모른다 — 오늘 그것 때문에 두 번 헤맸다.
    // **사람이 적은 글이나 기록은 안 붙인다.** 무엇이 터졌는지와 어느 화면인지만 보낸다.
    // 실패해도 조용히 넘어간다 (이미 터진 화면에서 또 터지면 안 된다)
    try {
      const baseURL = import.meta.env.VITE_API_URL || '/api';
      fetch(`${baseURL}/client-error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: String(err?.message || err),
          stack: String(err?.stack || info?.componentStack || ''),
          path: typeof window !== 'undefined' ? window.location.pathname : '',
        }),
      }).catch(() => {});
    } catch { /* 여기서 또 터지면 안 된다 */ }
  }

  render() {
    const { err, stale } = this.state;
    if (!err) return this.props.children;

    const title = stale ? '앱이 새 판으로 바뀌었어요' : '이 화면을 그리지 못했어요';
    const desc = stale
      ? '새로 받아야 합니다. 아래를 누르면 바로 됩니다 — 저장하신 기록은 그대로 있습니다.'
      : '저장하신 기록은 그대로 있습니다. 새로고침으로 대개 돌아옵니다. 그래도 안 되면 고객센터에 남겨주세요.';

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '70vh', padding: 24, textAlign: 'center', gap: 12,
      }}>
        <div style={{ fontSize: 17, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 380 }}>
          {desc}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            className="btn-primary"
            onClick={() => { clearReloadMark(); window.location.reload(); }}
          >새로고침</button>
          <button
            className="btn-secondary"
            onClick={() => { clearReloadMark(); window.location.href = '/home'; }}
          >홈으로</button>
        </div>

        {/* 무슨 일인지 궁금한 사람에게만. 제보에 붙여주시면 우리가 찾기 쉽다 */}
        {!stale && (
          <details style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', maxWidth: 380 }}>
            <summary style={{ cursor: 'pointer' }}>무슨 일인지 보기</summary>
            <pre style={{
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', textAlign: 'left',
              marginTop: 8, fontSize: 11.5, lineHeight: 1.6,
            }}>{String(err?.message || err)}</pre>
          </details>
        )}
      </div>
    );
  }
}
