// 추천 루틴을 화면과 맞춰본다.
//
//   npm run check
//
// 갈래 이름이 **서버와 화면 두 곳에 따로 적혀 있다.** 서버는 routines.js 에,
// 화면은 RoutinePage.jsx 의 PARTS_MAP 에. 한쪽만 고치면 그 칸이 조용히 빈다 —
// 서버는 200 을 주고 화면은 「데이터 없음」을 띄운다. 아무도 안 터지므로 눈으로만 잡힌다.
//
// 8/31 에 「기능성(특수부대식)」을 넣으면서 갈래가 다섯 더 생겼다. 그때 만든 검사다.
const fs = require('fs');
const path = require('path');

const routesFile = path.join(__dirname, '../src/routes/routines.js');
const pageFile = path.join(__dirname, '../../frontend/src/pages/RoutinePage.jsx');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad++;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

console.log('── 추천 루틴 (서버와 화면이 같은 이름을 쓰는가) ──');

// 서버 쪽은 실제로 불러서 본다 (파일을 읽어 흉내내면 흉내가 틀릴 수 있다)
const express = require('express');
const app = express();
app.use('/r', require('../src/routes/routines'));
const srv = app.listen(0, async () => {
  const base = 'http://localhost:' + srv.address().port + '/r';

  // ── 갈래 목록을 **어떻게 아나** (2026-09-22 에 고쳤다) ──
  //
  // 여태 `GET /` 로 넷을 한꺼번에 받아 봤다. 그런데 그 길은 **9/19 에 걷혔다**
  // (아무 화면도 안 부르는 길이었다 — 그날 `npm run api` 가 잡아낸 것이다).
  // 그 뒤로 이 검사는 404 HTML 을 JSON 으로 읽다가 **터져 있었다.** 검사가 터지면
  // 「실패」가 아니라 아예 아무것도 안 보는 것이라, 루틴이 어긋나도 모른다.
  //
  // 이제 **없는 갈래를 한 번 물어서** 목록을 받는다. 서버가 400 과 함께
  // 「머신 · 맨몸 · … 중에서 고를 수 있어요」를 주므로, 그것이 곧 갈래 목록이다.
  // 목록을 여기 또 적어두면 **셋째 벌**이 되어(서버 · 화면 · 검사) 더 어긋난다.
  const probe = await fetch(base + '/없는갈래');
  ok('없는 갈래는 400 으로 막는다', probe.status, 400);
  const types = String((await probe.json()).error || '').split('중에서')[0].trim().split(' · ').filter(Boolean);

  const all = {};
  for (const t of types) {
    const r = await fetch(base + '/' + encodeURIComponent(t));
    if (r.status !== 200) { ok(t + ' — 200 으로 온다', r.status, 200); continue; }
    all[t] = await r.json();
  }

  // 화면의 PARTS_MAP 을 글자 그대로 읽는다
  const page = fs.readFileSync(pageFile, 'utf-8');
  const mapText = page.slice(page.indexOf('const PARTS_MAP'), page.indexOf('};', page.indexOf('const PARTS_MAP')));
  const screen = {};
  for (const m of mapText.matchAll(/'([^']+)':\s*\[([^\]]*)\]/g)) {
    screen[m[1]] = [...m[2].matchAll(/'([^']+)'/g)].map(x => x[1]);
  }

  ok('갈래가 넷이다 (머신 · 맨몸 · 홈트 · 기능성)', Object.keys(all), ['머신', '맨몸', '홈트', '기능성']);
  ok('화면이 아는 갈래도 넷이다', Object.keys(screen), Object.keys(all));
  for (const type of Object.keys(all)) {
    ok(type + ' — 화면의 칸 이름이 서버와 같다', screen[type], Object.keys(all[type]));
    // 빈 칸이 있으면 눌렀을 때 「데이터 없음」이 뜬다
    ok(type + ' — 빈 칸이 없다', Object.entries(all[type]).filter(([, v]) => !v.length).map(([k]) => k), []);
  }

  // 운동 한 줄에 다섯 칸이 다 있어야 화면이 제대로 그려진다 (이름 · 세트 · 횟수 · 한마디 · 설명)
  const rows = Object.values(all).flatMap(t => Object.values(t).flat());
  ok('운동마다 다섯 칸이 다 있다', rows.filter(r => !r.name || !r.sets || !r.reps || !r.tip || !r.desc).length, 0);
  ok('설명이 한 줄짜리로 비어 있지 않다 (40자 이상)', rows.filter(r => r.desc.length < 40).map(r => r.name), []);

  // 기능성은 **집에서 하는 것**이다. 헬스장 기구가 이름에 들어가면 그건 여기 것이 아니다
  const home = Object.values(all['기능성']).flat().map(r => r.name + ' ' + r.desc);
  const GYM = ['바벨', '덤벨', '케이블', '머신', '수영', '스미스', '레그프레스'];
  ok('기능성에 헬스장 기구가 안 들어간다',
    GYM.filter(w => home.some(t => t.includes(w))), []);
  // 공식 프로그램이 아니라는 말이 화면에 있어야 한다
  ok('화면이 「공식 프로그램이 아니다」라고 적어둔다', /공식 프로그램은 아닙니다/.test(page), true);
  ok('화면이 「배낭으로 대신한다」고 적어둔다', /배낭/.test(page), true);

  // ── 부위가 다 붙어 있는가 (2026-09-22) ──
  //
  // 앱은 여태 이름으로 부위를 맞혔다. 그런데 여기 있는 것들은 **이미 부위 칸 안에**
  // 들어 있다 — 맞힐 필요가 없는 것을 맞히다 틀리기도 했다(「카프레이즈」→ 어깨).
  // 이제 서버가 부위를 같이 준다. **하나라도 빠지면 그 운동만 몸 지도에서 조용히
  // 사라지므로** 글자로 잡는다.
  console.log('── 부위가 다 붙어 있는가 ──');
  const MAPP = ['가슴', '등', '어깨', '하체', '팔', '코어'];
  const everyRow = [];
  for (const type of Object.keys(all)) {
    for (const [col, list] of Object.entries(all[type])) {
      list.forEach((e) => everyRow.push({ type, col, ...e }));
    }
  }
  ok('운동이 84개다', everyRow.length, 84);
  ok('부위가 없는 운동', everyRow.filter((e) => !e.main || !e.main.length).map((e) => e.type + '/' + e.col + '/' + e.name), []);
  // 몸 지도에 자리가 없는 이름을 적으면 그 줄은 조용히 사라진다
  ok('몸 지도에 없는 부위를 안 쓴다',
    everyRow.flatMap((e) => (e.main || []).concat(e.sub || []).filter((p) => !MAPP.includes(p))), []);
  ok('주와 곁이 겹치지 않는다',
    everyRow.filter((e) => (e.sub || []).some((p) => (e.main || []).includes(p))).map((e) => e.name), []);

  // 칸 이름이 부위면 **그 칸 이름이 그대로** 와야 한다 (지어내지 않는다)
  const fromCol = everyRow.filter((e) => MAPP.includes(e.col));
  ok('부위 칸은 칸 이름을 그대로 쓴다', fromCol.filter((e) => e.main[0] !== e.col).map((e) => e.name), []);

  // 부위 칸이 **아닌** 자리(홈트 「전신」 · 기능성 다섯)는 직접 적어둔 것이라야 한다
  const notCol = everyRow.filter((e) => !MAPP.includes(e.col));
  ok('부위가 아닌 칸은 스물넷', notCol.length, 24);
  ok('  거기도 부위가 다 있다', notCol.filter((e) => !e.main || !e.main.length).map((e) => e.name), []);
  // 「레이즈」 · 「워크」 같은 낱말에 속지 않는지 — 이름으로 맞히면 틀리는 것들이다
  ok('오버헤드 배낭 워크는 어깨다', notCol.find((e) => e.name === '오버헤드 배낭 워크')?.main, ['어깨']);
  ok('월싯은 하체다 (이름으로는 못 맞힌다)', notCol.find((e) => e.name === '월싯')?.main, ['하체']);
  ok('2.4km 달리기는 하체다', notCol.find((e) => e.name === '2.4km 달리기')?.main, ['하체']);

  console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));

  // ── 끝내는 법 (2026-09-22) ──
  //
  // `srv.close()` 바로 뒤에 `process.exit()` 를 부르면 **윈도우에서 터진다** —
  // libuv 가 닫는 중인 손잡이를 다시 건드리고(`UV_HANDLE_CLOSING`), 종료 코드가
  // 127 이 된다. 검사가 **전부 통과했는데도** `npm run check` 가 여기서 멈춘다.
  //
  // 그래서 끝낼 값만 적어두고 **자연히 끝나게** 둔다. `fetch` 는 연결을 살려두므로
  // (keep-alive) 그것부터 끊는다 — 안 끊으면 닫히기를 기다리며 안 끝난다.
  process.exitCode = bad ? 1 : 0;
  srv.closeAllConnections?.();
  srv.close();
});
