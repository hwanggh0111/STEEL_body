// 서버가 뜨는 데 얼마나 드나 — 재보는 자리 (2026-10-07).
//
//   npm run boot         다섯 번 띄워 가운뎃값
//   npm run boot -- 9    아홉 번
//
// **왜 이것만 따로 재나.** `npm run bench` 는 **돌고 있는 서버 안**에서 재는 자다 —
// 저장이 몇 ms 인가, 조회가 몇 ms 인가. 그런데 이 앱이 올라갈 **Render 무료 판은
// 15분 놀면 잠든다.** 다음 사람이 열면 프로세스가 **처음부터 다시 뜬다** —
// 하루에 몇 번씩이다. 그 값은 bench 가 재는 어느 줄에도 안 들어 있었다.
//
// **무엇을 재나** — 프로세스를 새로 띄워서 `/api/health` 가 **200 으로 답할 때까지**다.
// 「떴다」고 찍는 줄까지만 재면 안 된다. 그 줄 뒤에도 할 일이 남아 있을 수 있고,
// 사람이 겪는 것은 **답이 오는 때**다.
//
// **검사가 아니다.** 통과·실패가 없다 — 수를 적어두고 다음에 견준다.
// 그래서 `npm run check` 에 안 넣는다 (여러 번 띄우느라 오래 걸리고, 기계마다 다르다).
//
// **진짜 서버 자리(4000)를 안 건드린다.** 딴 번호로 띄우고 끝나면 죽인다.
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = 4321;
const RUNS = Math.max(1, Number(process.argv[2]) || 5);
const ROOT = path.join(__dirname, '..');
// **진짜 DB 를 안 건드린다** (2026-10-07, 코드 검토에서 잡혔다).
//
// 처음에 `DB_FILE` 을 안 줬다. 그러면 띄운 서버가 `.env` 를 읽어서 **진짜
// `blackiron.json` 을 연다** — 다섯 번 띄우고 죽이는 동안 진짜 기록에 대고
// 열고 닫기를 다섯 번 한 셈이다. `DATABASE_URL` 이 있는 자리면 **진짜 DB** 다.
//
// 이 폴더의 다른 스크립트는 전부 임시 파일을 쓴다. 여기만 빠져 있었다.
const TMP = path.join(ROOT, '.boot.json');
const cleanTmp = () => {
  for (const f of [TMP, TMP.replace(/\.json$/, '.photos.json')]) {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch { /* 없으면 그만이다 */ }
  }
};
cleanTmp();

function once() {
  return new Promise((done) => {
    const t0 = Number(process.hrtime.bigint());
    // **배포와 같은 깃발로 띄운다** — 메모리 뚜껑이 다르면 뜨는 값도 달라진다
    const p = spawn(process.execPath,
      ['--max-old-space-size=256', '--optimize-for-size', 'src/index.js'], {
        cwd: ROOT,
        // `DATABASE_URL` 도 지운다 — 있으면 `DB_FILE` 이 있어도 그쪽으로 간다
        env: { ...process.env, PORT: String(PORT), DB_FILE: TMP, DATABASE_URL: '' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    let said = 0;
    p.stdout.on('data', (c) => {
      if (!said && /Server running/.test(String(c))) said = Number(process.hrtime.bigint());
    });
    p.stderr.on('data', () => {});
    const poll = setInterval(() => {
      http.get({ host: 'localhost', port: PORT, path: '/api/health' }, (r) => {
        r.resume();
        if (r.statusCode === 200) {
          clearInterval(poll);
          clearTimeout(guard);
          const ready = Number(process.hrtime.bigint());
          p.kill();
          done({ said: said ? (said - t0) / 1e6 : null, ready: (ready - t0) / 1e6 });
        }
      }).on('error', () => { /* 아직 안 떴다 */ });
    }, 5);
    // 20초가 넘으면 뭔가 잘못된 것이다 — 그 판은 안 센다.
    //
    // **다 됐으면 이 타이머를 끈다** (2026-10-07, 코드 검토에서 잡혔다). 안 끄면
    // 잴 것을 다 재고도 **20초를 더 떠 있고**, 그 사이 죽은 자식을 또 죽이려 든다.
    const guard = setTimeout(() => {
      clearInterval(poll); p.kill(); done({ said: null, ready: -1 });
    }, 20000);
  });
}

const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

(async () => {
  console.log('── 서버가 뜨는 데 ── (' + RUNS + '번 띄운다)');
  const saids = [];
  const readys = [];
  for (let i = 0; i < RUNS; i++) {
    const r = await once();
    if (r.ready > 0) { readys.push(r.ready); if (r.said) saids.push(r.said); }
    // 바로 다음 판을 띄우면 앞 프로세스가 아직 번호를 쥐고 있다
    await new Promise((r2) => setTimeout(r2, 300));
  }
  if (!readys.length) {
    console.log('  한 번도 못 띄웠다 — 번호 ' + PORT + ' 가 막혀 있나 보라');
    process.exit(1);
  }
  const say = (label, value) =>
    console.log('  ' + label.padEnd(34, ' ') + String(value.toFixed(0)).padStart(6) + ' ms');
  if (saids.length) say('「떴다」고 말할 때까지', med(saids));
  say('첫 요청에 답할 때까지 (가운뎃값)', med(readys));
  say('  제일 빠를 때', Math.min(...readys));
  say('  제일 느릴 때', Math.max(...readys));
  console.log('');
  console.log('Render 무료 판은 15분 놀면 잠든다 — 이 값은 **깨울 때마다** 치른다.');
  console.log('바꾼 것이 이 줄을 움직였으면 README 개발 일지에 적는다.');
  cleanTmp();
})();
