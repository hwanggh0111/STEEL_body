// ── **라이브에서 터진 것을 꺼내 온다 — 그걸 보고 내가 고친다** ── (2026-11-26 · 주인 지시)
//
//   npm run errors                 내 컴퓨터의 기록 (파일 DB)
//   npm run errors -- 50           최근 50건까지 줄줄이
//   DATABASE_URL=... npm run errors  **라이브(Neon Postgres)의 기록**
//
// 주인이 정한 모양은 「오류가 나면 Claude 에게 와서 Claude 가 고친다」다. 그 길의 끝이
// 이 자다 — 서버가 적어 둔 것(`utils/errorLog`)을 **사람 눈과 내 눈에 같은 모양으로**
// 꺼낸다. 관리자 화면(`GET /api/security/errors`)과 **같은 자를 부른다** — 두 벌로 두면
// 한쪽만 고쳐진다(이 앱이 여러 번 겪은 꼴이다).
//
// 로그인하지 않는다. 기록이 사는 곳(`storage`)을 서버와 **같은 손으로** 열어 읽을 뿐이다.
// 그래서 라이브를 보려면 `DATABASE_URL` 만 있으면 된다 — 쿠키 · 관리자 비번이 필요 없다.
// **읽기만 한다.**
const storage = require('../src/storage');

const N = Number(process.argv[2]) || 20;

const 짧게 = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const 한국시 = (iso) => {
  try {
    return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false });
  } catch { return iso; }
};

storage.init().then(() => {
  // **저장소를 연 뒤에 들여온다** — `errorLog` 는 `db` 를 들고, `db` 는 열린 저장소를 읽는다
  const { recentErrors, groupErrors } = require('../src/utils/errorLog');
  const list = recentErrors(300);

  console.log('');
  if (list.length === 0) {
    console.log('터진 기록이 없다 — 서버가 적은 500 · 잡히지 않은 거절이 하나도 없다.');
    console.log('(라이브를 보려면 DATABASE_URL 을 주고 돌린다)');
    process.exit(0);
  }

  const groups = groupErrors(list);
  console.log(`── 터진 것 ${list.length}건 · ${groups.length}가지 ─────────────────────────`);
  console.log('');
  groups.forEach((g, i) => {
    console.log(`${String(i + 1).padStart(2)}. ${g.count}번   ${짧게(g.what, 150)}`);
    console.log(`      처음 ${한국시(g.first)} · 마지막 ${한국시(g.last)}`);
  });

  console.log('');
  console.log(`── 최근 ${Math.min(N, list.length)}건 (최신이 위) ──────────────────────────`);
  list.slice(0, N).forEach((e) => {
    console.log(`${한국시(e.timestamp)}  ${짧게(e.detail, 200)}`);
  });
  console.log('');
  console.log('많이 나는 것부터 고친다. 자리는 끝에 적힌 `파일:줄` 이다.');
  process.exit(0);
}).catch((err) => {
  console.error('저장소를 열지 못했다:', err.message);
  process.exit(1);
});
