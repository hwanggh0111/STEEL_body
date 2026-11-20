// **내 기록을 CSV 로 받는 손** (2026-11-17)
//
// ── 왜 꺼냈나 ──
//
// 서버에는 받는 길이 **셋**이다 — `/export/workouts` · `/export/inbody` ·
// `/export/measures`(`backend/src/routes/export.js`). 그런데 **둘만 불리고 있었다.**
// 내려받기 손이 `HistoryPage.jsx` **안에** 있어서, 측정 화면에서는 쓸 수가 없었다.
//
// 그 사이가 **설정에서 끊겨 있었다**: 설정의 「측정 내려받기 · 줄자로 잰 것」이
// `/body` 의 측정 갈래로 보내는데 **거기 내려받을 단추가 없다.** 누른 사람은
// 재는 도구 목록에 떨어져서 **측정은 못 받는 줄 알게 된다.** 9/29 에 「없는 한 곳으로
// 보내는 것보다 두 줄이 낫다」로 고친 그 류가, **측정 쪽에는 그대로 남아 있었다.**
//
// 서버 쪽 `/export/measures` 는 9/18 에 **같은 날 같은 종류를 두 번 잰 줄을 가르는
// 「번호」 칸까지** 넣어 다듬어 둔 길이다. 두 달 동안 아무도 안 불렀다.
//
// ── 이름은 서버가 정한다 ──
//
// 여기 이름을 적어두면 **둘이 어긋난다.** 실제로 어긋나 있었다 — 서버는
// `steelbody_workouts.csv` 를 주는데 화면은 `blackiron_workouts.csv` 를 적었고,
// `a.download` 가 서버 헤더를 **이긴다.** 그래서 사람은 옛 이름으로 받고 있었다.
//
// 그래서 **`Content-Disposition` 을 읽어 그것을 쓴다.** 못 읽을 때만(헤더가 안
// 보이는 다른 출처 등) 넘겨받은 이름으로 떨어진다. 이러면 이름이 한 자리에만 있다.
import { readLS } from './safeStorage';
import { TOKEN_KEY } from './localKeys';

// `attachment; filename="steelbody_measures.csv"` → `steelbody_measures.csv`
// `filename*=UTF-8''…` 꼴도 받는다 (한글 이름을 주게 되면 그 꼴로 온다)
export function nameFromDisposition(line) {
  const s = String(line || '');
  const star = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(s);
  if (star) { try { return decodeURIComponent(star[1].trim()); } catch { /* 아래로 */ } }
  const plain = /filename\s*=\s*"([^"]+)"/i.exec(s) || /filename\s*=\s*([^;]+)/i.exec(s);
  return plain ? plain[1].trim() : '';
}

// `type` 은 서버 길의 마지막 토막이다 — `workouts` · `inbody` · `measures`
export function exportCsv(type, fallbackName) {
  const baseURL = import.meta.env.VITE_API_URL || '/api';
  const token = readLS(TOKEN_KEY);
  return fetch(`${baseURL}/export/${type}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  })
    .then((res) => {
      if (!res.ok) throw new Error('Export failed');
      const name = nameFromDisposition(res.headers.get('content-disposition')) || fallbackName;
      return res.blob().then((blob) => ({ blob, name }));
    })
    .then(({ blob, name }) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      // 문서에 붙이지 않은 링크는 클릭해도 아무 일이 안 일어나는 브라우저가 있다.
      // 그리고 곧바로 revoke 하면 내려받기가 시작되기 전에 주소가 사라져 빈 파일이 된다
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return name;
    });
}

// ── **한 묶음으로 받기** ── (2026-11-19 · 맵시 · 시안 ⑥)
//
// 위의 `exportCsv` 는 셋을 **한 장씩** 받는다. 그런데 받을 길이 **아예 없는 것**이
// 넷 있었다 — 메모 · 내 루틴 · 기구 세팅 · 사진. 통째로 뜨는 길은 있지만
// (`routes/export.js` 의 `/export/backup`) 그것은 **관리자만** 쓰고 남의 것까지 담는다.
//
// 그래서 **내 것 전부**를 한 묶음으로 받는 길을 쓴다. 계정을 지우기 전에 쓸 것이다 —
// 30일 유예 뒤에 지워지니(8/31 결정) 그 전에 전부 받아둘 길이 있어야 한다.
//
// 서버 길은 `GET /api/export/all?parts=<쉼표로 이은 것>` 이고 묶음 한 장으로 온다.
// **무엇을 담을지 고르는 것은 사람**이다 — 사진은 무거워서 기본으로 안 담는다.
// 이름은 여기서 정하지 않는다(`Content-Disposition`) — 위 머리글의 그 까닭이다.
/**
 * **무엇이 얼마나 담기는지 먼저 본다** (2026-11-20 · 맵시 · 시안 ⑥).
 *
 * 같은 주소를 `parts` 없이 부르면 서버가 목록만 준다 —
 * `{ 담기는것: [{열쇠, 갈래, 줄, 기본꺼짐, 늘담는다}], 안담는것: [{갈래, 까닭}] }`.
 *
 * ★ **못 받아도 아무 일도 안 난다.** 받기 카드는 이 값 없이도 그대로 돌아가고,
 * 수를 적는 자리만 비어 있다 — 설정 화면을 여는 길목에 **막는 것을 두지 않는다.**
 */
export function 받을것미리본다() {
  const baseURL = import.meta.env.VITE_API_URL || '/api';
  const token = readLS(TOKEN_KEY);
  return fetch(`${baseURL}/export/all`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  })
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null);
}

export function exportAll(parts, fallbackName = 'steelbody_all.zip') {
  const baseURL = import.meta.env.VITE_API_URL || '/api';
  const token = readLS(TOKEN_KEY);
  const q = encodeURIComponent((parts || []).join(','));
  return fetch(`${baseURL}/export/all?parts=${q}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  })
    .then((res) => {
      if (!res.ok) throw new Error('Export failed ' + res.status);
      const name = nameFromDisposition(res.headers.get('content-disposition')) || fallbackName;
      return res.blob().then((blob) => ({ blob, name }));
    })
    .then(({ blob, name }) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return name;
    });
}
