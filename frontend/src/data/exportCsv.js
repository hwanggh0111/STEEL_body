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
