// 통째로 떠둔다 (2026-10-01).
//
//   npm run backup              backups/ 에 날짜 이름으로 뜬다
//   npm run backup -- --out D:/어디  다른 자리에 뜬다
//
// ── 왜 ──
//
// 이 앱의 기록 전부가 **파일 두 장**에 있다(`blackiron.json` · `photos.json`).
// 사람마다 자기 것 내려받기는 있지만(`/api/export/*`), **통째로 떠서 되돌리는 길**이
// 없었다. 파일 하나가 잘못되면 아홉 사람의 기록이 한 번에 사라진다.
//
// Postgres 로 옮기기 전에 이것부터 있어야 한다 — **옮기다 잘못돼도 돌아올 자리**다.
//
// ── 어떻게 ──
//
// **읽기만 한다.** 서버가 돌고 있어도 안전하다. 다만 서버가 저장하는 **그 순간**과
// 겹치면 반쯤 쓰인 파일을 읽을 수 있어서, 읽은 뒤 **JSON 으로 풀어보고** 안 풀리면
// 잠깐 뒤에 다시 읽는다. 원자적 쓰기(`rename`)를 쓰고 있어서 거의 안 걸리지만,
// 백업이 **깨진 것을 떠두면 백업이 아니다.**
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DB = process.env.DB_FILE ? path.resolve(process.env.DB_FILE) : path.join(ROOT, 'blackiron.json');
const PHOTOS = DB.replace(/\.json$/, '') + '.photos.json';
const PHOTOS_REAL = process.env.DB_FILE ? PHOTOS : path.join(ROOT, 'photos.json');

const args = process.argv.slice(2);
const outArg = args.indexOf('--out');
const OUT_DIR = outArg >= 0 && args[outArg + 1] ? path.resolve(args[outArg + 1]) : path.join(ROOT, 'backups');

// 몇 벌까지 둘까. 넘으면 **오래된 것부터** 버린다 — 안 버리면 디스크가 찬다
const KEEP = 20;

function readJsonTwice(file) {
  for (let i = 0; i < 3; i++) {
    try {
      const text = fs.readFileSync(file, 'utf8');
      JSON.parse(text);          // 풀리는지 본다. 안 풀리면 아래 catch
      return text;
    } catch (err) {
      if (i === 2) throw new Error(file + ' 를 온전히 읽지 못했습니다: ' + err.message);
      // 쓰는 중과 겹쳤을 수 있다. 잠깐 뒤에 다시
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150);
    }
  }
}

function human(n) {
  return n > 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + 'MB' : Math.round(n / 1024) + 'KB';
}

function main() {
  if (!fs.existsSync(DB)) {
    console.error('뜰 것이 없습니다 — ' + DB + ' 가 없습니다');
    process.exit(1);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = path.join(OUT_DIR, stamp);
  fs.mkdirSync(dir, { recursive: true });

  const dbText = readJsonTwice(DB);
  fs.writeFileSync(path.join(dir, 'blackiron.json'), dbText, 'utf8');
  let photoBytes = 0;
  if (fs.existsSync(PHOTOS_REAL)) {
    const pText = readJsonTwice(PHOTOS_REAL);
    fs.writeFileSync(path.join(dir, 'photos.json'), pText, 'utf8');
    photoBytes = Buffer.byteLength(pText);
  }

  // 무엇을 떴는지 한 장에 적어둔다 — 나중에 「이게 언제 것이고 몇 사람이지」를
  // 파일을 열어 세지 않게
  const data = JSON.parse(dbText);
  const note = {
    뜬때: new Date().toISOString(),
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
  console.log('  회원 ' + note.회원 + '명 · 운동 ' + note.운동기록 + '줄 · 본체 ' + human(note.본체크기) +
              (photoBytes ? ' · 사진 ' + human(photoBytes) : ' · 사진 없음'));
  if (drop.length) console.log('  오래된 ' + drop.length + '벌은 걷었습니다 (최근 ' + KEEP + '벌만 둡니다)');
}

main();
