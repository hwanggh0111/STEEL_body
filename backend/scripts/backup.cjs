// 통째로 떠둔다 (2026-10-01).
//
//   npm run backup              backups/ 에 날짜 이름으로 뜬다
//   npm run backup -- --out D:/어디  다른 자리에 뜬다
//
//   DATABASE_URL=... npm run backup   운영(Neon Postgres)에서 뜬다
//
// ── 왜 ──
//
// 이 앱의 기록 전부가 **글자 두 덩이**다(`blackiron.json` · `photos.json`).
// 사람마다 자기 것 내려받기는 있지만(`/api/export/*`), **통째로 떠서 되돌리는 길**이
// 없었다. 하나가 잘못되면 아홉 사람의 기록이 한 번에 사라진다.
//
// ── 어디에서 뜨나 (2026-10-22 에 고친 자리) ──
//
// 이 글은 10/01 에 적었다 — 그때는 기록이 **파일 두 장**이었다. 10/14 에 운영이
// Neon Postgres 로 옮겨갔는데 **이 스크립트는 파일만 읽고 있었다.**
//
// 그래서 `DATABASE_URL` 을 운영으로 걸고 떠도 **내 컴퓨터의 파일**을 떠놓고
// 「떠뒀습니다 · 회원 18명」이라고 말했다. 틀린 것을 담아놓고 성공했다고 말하는
// 백업은 **없는 것보다 나쁘다** — 되돌려야 하는 날에야 알게 된다.
//
// 이제 `src/storage` 를 지난다. 앱이 읽는 자리에서 읽으므로 **앱과 같은 곳**을 뜬다.
// 어디에서 떴는지 적바림과 화면에 적는다.
//
// ── 어떻게 ──
//
// **읽기만 한다.** 서버가 돌고 있어도 안전하다. 다만 서버가 저장하는 **그 순간**과
// 겹치면 반쯤 쓰인 파일을 읽을 수 있어서, 읽은 뒤 **JSON 으로 풀어보고** 안 풀리면
// 잠깐 뒤에 다시 읽는다. 원자적 쓰기(`rename`)를 쓰고 있어서 거의 안 걸리지만,
// 백업이 **깨진 것을 떠두면 백업이 아니다.**
// (Postgres 에서는 한 줄을 통째로 받으므로 반쯤 읽을 일이 없다.)
const fs = require('fs');
const path = require('path');

const storage = require('../src/storage');

const ROOT = path.join(__dirname, '..');
// 어디에서 읽을지는 `storage` 가 안다 — 여기서 다시 셈하면 어긋난다
// (여태 `PHOTOS` 를 셈해놓고 쓰지도 않았다. 쓰이지 않는 셈은 틀려도 안 들킨다)
const WHERE = storage.isPostgres ? 'Postgres (DATABASE_URL)' : storage.pathOf(storage.MAIN);

const args = process.argv.slice(2);
const outArg = args.indexOf('--out');
const OUT_DIR = outArg >= 0 && args[outArg + 1] ? path.resolve(args[outArg + 1]) : path.join(ROOT, 'backups');

// 몇 벌까지 둘까. 넘으면 **오래된 것부터** 버린다 — 안 버리면 디스크가 찬다
const KEEP = 20;

function readJsonTwice(name) {
  for (let i = 0; i < 3; i++) {
    try {
      const text = storage.readSync(name);
      JSON.parse(text);          // 풀리는지 본다. 안 풀리면 아래 catch
      return text;
    } catch (err) {
      if (i === 2) throw new Error(name + ' 을 온전히 읽지 못했습니다: ' + err.message);
      // 쓰는 중과 겹쳤을 수 있다. 잠깐 뒤에 다시 (Postgres 는 한 줄을 통째로 받는다)
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150);
    }
  }
}
function human(n) {
  return n > 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + 'MB' : Math.round(n / 1024) + 'KB';
}

async function main() {
  // Postgres 는 **미리 읽어두어야** 읽을 수 있다 (`storage` 머리글의 한 가지 규칙)
  await storage.init();

  if (!storage.existsSync(storage.MAIN)) {
    console.error('뜰 것이 없습니다 — ' + WHERE + ' 에 기록이 없습니다');
    process.exit(1);
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = path.join(OUT_DIR, stamp);
  fs.mkdirSync(dir, { recursive: true });

  const dbText = readJsonTwice(storage.MAIN);
  fs.writeFileSync(path.join(dir, 'blackiron.json'), dbText, 'utf8');
  let photoBytes = 0;
  if (storage.existsSync(storage.PHOTOS)) {
    const pText = readJsonTwice(storage.PHOTOS);
    fs.writeFileSync(path.join(dir, 'photos.json'), pText, 'utf8');
    photoBytes = Buffer.byteLength(pText);
  }

  // 무엇을 떴는지 한 장에 적어둔다 — 나중에 「이게 언제 것이고 몇 사람이지」를
  // 파일을 열어 세지 않게
  const data = JSON.parse(dbText);
  const note = {
    뜬때: new Date().toISOString(),
    // **어디에서 떴나.** 되돌리는 날 제일 먼저 봐야 하는 것이다 —
    // 내 컴퓨터 것인지 운영 것인지 담긴 파일만 보고는 가릴 수 없다
    어디서: WHERE,
    회원: (data.users || []).length,
    운동기록: (data.workouts || []).length,
    인바디: (data.inbody || []).length,
    측정: (data.measures || []).length,
    제보: (data.reports || []).length,
    본체크기: Buffer.byteLength(dbText),
    사진크기: photoBytes,
  };
  fs.writeFileSync(path.join(dir, '무엇을-떴나.json'), JSON.stringify(note, null, 2), 'utf8');

  // 오래된 것 걷기
  const all = fs.readdirSync(OUT_DIR).filter(n => /^\d{4}-\d{2}-\d{2}T/.test(n)).sort();
  const drop = all.slice(0, Math.max(0, all.length - KEEP));
  for (const d of drop) fs.rmSync(path.join(OUT_DIR, d), { recursive: true, force: true });

  console.log('떠뒀습니다 → ' + dir);
  console.log('  어디서: ' + WHERE);
  console.log('  회원 ' + note.회원 + '명 · 운동 ' + note.운동기록 + '줄 · 본체 ' + human(note.본체크기) +
              (photoBytes ? ' · 사진 ' + human(photoBytes) : ' · 사진 없음'));
  if (drop.length) console.log('  오래된 ' + drop.length + '벌은 걷었습니다 (최근 ' + KEEP + '벌만 둡니다)');
}

main()
  .then(() => storage.close())
  .catch(async (err) => {
    // 연결을 닫지 않으면 **스크립트가 끝나지 않는다** (pg 의 풀이 붙잡는다)
    console.error(err.message);
    try { await storage.close(); } catch { /* 닫다 터져도 끝내는 길은 막지 않는다 */ }
    process.exit(1);
  });
