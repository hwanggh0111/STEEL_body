// 아픈 곳 · 달아오를 곳 미리보기 (2026-09-30).
//
//   npm run sore      (npm run check 에도 들어 있다)
//
// 시안은 artifact 729be142. 서랍의 「부위」 화면이 쓰는 계산이다.
//
// **화면으로는 확인하기 어려운 자리다.** 「4일째」를 눈으로 보려면 나흘을 기다려야 하고,
// 「14일째 물어보기」는 두 주가 걸린다. 그래서 날짜를 손으로 먹여서 본다.
//
// 지키는지 보는 것: 같은 부위를 다시 적어도 **처음 적은 날을 지킨다**(며칠째가 리셋되면
// 그 날수가 뜻을 잃는다) · 오늘 적으면 **1일째**다(0일째라고 적으면 안 적힌 줄 안다) ·
// 앞날은 안 받는다 · 아픈 곳을 **뺀 것을 같이 말한다** · 낫는 기간 · 병명 · 점수를
// 말하지 않는다 · 사전이 모르는 이름의 부위를 **짐작하지 않는다.**
const esbuild = require('esbuild');
const fs = require('fs');

const bundle = (entry, out) => {
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node' });
  const m = require(process.cwd() + '/' + out);
  fs.unlinkSync(out);
  return m;
};

const S = bundle('src/data/sorePart.js', '.so1.cjs');
const P = bundle('src/data/partPreview.js', '.so2.cjs');
const H = bundle('src/data/bodyHeat.js', '.so3.cjs');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

const TODAY = '2026-09-30';

console.log('── 적고 지우기 ──');
let list = S.addSore([], '어깨', TODAY);
ok('적힌다', list, [{ part: '어깨', date: '2026-09-30' }]);
// **처음 적은 날을 지킨다.** 덮으면 며칠째가 그때마다 1일로 돌아가고 날수가 뜻을 잃는다
const older = [{ part: '어깨', date: '2026-09-27' }];
ok('이미 적힌 것은 날짜를 안 덮는다', S.addSore(older, '어깨', TODAY)[0].date, '2026-09-27');
ok('한 부위는 한 칸이다', S.addSore(older, '어깨', TODAY).length, 1);
ok('지우면 사라진다', S.removeSore(older, '어깨'), []);
ok('  없는 것을 지워도 안 터진다', S.removeSore([], '어깨'), []);
ok('아픈지 묻는다', [S.isSore(older, '어깨'), S.isSore(older, '등')], [true, false]);

console.log('\n── 안 받는 것 ──');
ok('부위가 아니면 안 받는다', S.addSore([], '팔꿈치', TODAY), []);
ok('  「기타」도 부위가 아니다', S.addSore([], '기타', TODAY), []);
ok('날짜 모양이 아니면 안 받는다', S.addSore([], '어깨', '2026/09/30'), []);
ok('깨진 칸은 없는 것으로 본다',
  S.cleanSore([null, { part: '등' }, { part: 'x', date: TODAY }, { part: '등', date: TODAY }]),
  [{ part: '등', date: '2026-09-30' }]);
ok('  같은 부위가 두 번 담겨 있어도 하나만',
  S.cleanSore([{ part: '등', date: '2026-09-20' }, { part: '등', date: TODAY }]).length, 1);

console.log('\n── 며칠째 ──');
// 오늘 적었으면 **1일째**다. 0일째라고 적으면 사람은 안 적힌 줄 안다
ok('오늘 적으면 1일째', S.soreList([{ part: '어깨', date: TODAY }], TODAY)[0].days, 1);
ok('  사흘 전이면 4일째', S.soreList([{ part: '어깨', date: '2026-09-27' }], TODAY)[0].days, 4);
// **앞날로 적힌 것**(손으로 담긴 값)이 「-2일째」가 되면 안 된다
ok('앞날로 적혀 있어도 1일째 아래로 안 내려간다',
  S.soreList([{ part: '어깨', date: '2026-10-02' }], TODAY)[0].days, 1);
ok('오래 아픈 것이 위로 온다',
  S.soreList([{ part: '등', date: TODAY }, { part: '어깨', date: '2026-09-20' }], TODAY).map((r) => r.part),
  ['어깨', '등']);
ok('한 줄로 적는다', S.soreLine(S.soreList([{ part: '어깨', date: '2026-09-27' }], TODAY)[0]), '어깨 · 4일째');

console.log('\n── 오래된 것은 묻는다 (지우지 않는다) ──');
const old14 = S.soreList([{ part: '어깨', date: '2026-09-16' }], TODAY)[0];
ok('14일 지나면 묻는다', old14.ask, true);
ok('  그 전에는 안 묻는다', S.soreList([{ part: '어깨', date: '2026-09-20' }], TODAY)[0].ask, false);
ok('  묻는 말이 있다', /아직 아프신가요/.test(S.askLine(old14)), true);
// **우리가 지우지 않는다** — 나았는지는 본인만 안다
ok('  저절로 사라지지 않는다', S.cleanSore([{ part: '어깨', date: '2026-01-01' }]).length, 1);
ok('  안 물을 칸에는 말이 없다', S.askLine({ part: '어깨', days: 2, ask: false }), null);

console.log('\n── 오늘 무엇을 권할까 ──');
// 몸 지도가 매긴 식은 순을 **그대로 쓴다** — 여기서 다시 매기면 두 화면이 다른 말을 한다
const workouts = {
  '2026-09-29': [{ exercise: '벤치프레스', weight: '80', sets: 5, reps: 5 }],   // 가슴
  '2026-09-28': [{ exercise: '랫풀다운', weight: '50', sets: 4, reps: 12 }],    // 등
  '2026-09-20': [{ exercise: '스쿼트', weight: '100', sets: 5, reps: 5 }],      // 하체
};
const heat = H.buildHeat(workouts, TODAY);
const adv = S.restAdvice([{ part: '하체', date: TODAY }], heat);
ok('아픈 곳은 안 권한다', adv.picks.includes('하체'), false);
ok('  뺀 것을 같이 준다', adv.skipped, ['하체']);
ok('  두 곳까지 권한다', adv.picks.length, 2);
ok('한 줄에 뺀 것도 적는다', /하체는 빼뒀어요/.test(S.adviceLine(adv)), true);
// **왜 안 보이는지**를 말해야 한다. 조용히 빼면 사람은 고장으로 읽는다
ok('아픈 곳이 없으면 뺀 말도 없다', /빼뒀어요/.test(S.adviceLine(S.restAdvice([], heat))), false);
ok('여섯이 다 아프면 사실대로',
  /쉬는 것도 운동이에요/.test(S.adviceLine(S.restAdvice(
    ['가슴', '등', '어깨', '하체', '팔', '코어'].map((p) => ({ part: p, date: TODAY })), heat,
  ))), true);

console.log('\n── 말투 ──');
const words = [
  S.soreLine({ part: '어깨', days: 4 }), S.askLine(old14), S.adviceLine(adv),
].join(' ');
// 낫는 기간 · 병명 · 점수 · 나무라기를 안 한다
ok('낫는 기간을 말하지 않는다', /주면 낫|나을|완치|회복까지/.test(words), false);
ok('  병명을 짐작하지 않는다', /염|증후군|파열|디스크/.test(words), false);
ok('  점수를 안 매긴다', /통증 \d|점|등급/.test(words), false);
ok('  나무라지 않는다', /하지 마|안 됩니다|무리/.test(words), false);

console.log('\n── 달아오를 곳 미리보기 ──');
const pv = P.previewPart('랫풀다운', heat, []);
ok('사전에서 부위를 읽는다', pv.part, '등');
ok('  며칠 전에 했나', pv.days, 2);
ok('  몸 지도와 같은 뜨거움 값', pv.level, H.heatLevel(2));
ok('  식은 것은 아니다', pv.cold, false);
ok('한 줄로 적는다', P.previewLine(pv), '등 — 2일 전에 했어요.');
ok('오늘 한 부위는 그렇게 적는다',
  P.previewLine(P.previewPart('벤치프레스', H.buildHeat({ [TODAY]: workouts['2026-09-29'] }, TODAY), [])),
  '가슴 — 오늘 이미 했어요.');
ok('식었으면 며칠째인지', /10일째 식어 있어요/.test(
  P.previewLine(P.previewPart('스쿼트', heat, []))), true);
ok('한 번도 안 한 부위', /한 번도 안 했어요/.test(
  P.previewLine(P.previewPart('사이드레터럴레이즈', heat, []))), true);

// **모르는 이름의 부위를 짐작하지 않는다.** 아무 부위나 고르면 지도가 틀린 색을 낸다
const unknown = P.previewPart('무슨무슨운동', heat, []);
ok('모르는 이름은 모른다고 한다', unknown.known, false);
ok('  그 줄도 그렇게 적는다', /아직 몰라요/.test(P.previewLine(unknown)), true);
ok('  뜨거움은 0 이다', unknown.level, 0);
ok('빈 이름이면 아무것도 안 준다', P.previewPart('', heat, []), null);

// 아픈 부위를 골라도 **막지 않는다** — 막으면 사람이 아픔을 안 적는다
const sorePv = P.previewPart('랫풀다운', heat, [{ part: '등', date: TODAY }]);
ok('아픈 부위인 것을 안다', sorePv.sore, true);
ok('  알려주지만 막지 않는다', /하셔도 되지만/.test(P.soreWarn(sorePv)), true);
ok('  안 아프면 아무 말도 안 한다', P.soreWarn(pv), null);

// ── 몸 그림이 보이는가 ── (2026-09-30)
//
// 이 그림의 바탕은 `#1c1813` 이고 카드는 `#1e1a14` 다 — **거의 같은 색**이다.
// 홈트에서는 판이 돌면서 칸이 하나씩 금색으로 채워지니 괜찮지만, 여기는 **한 곳만**
// 칠한다. 나머지를 `untouched` 로 안 넘기면 **금색 덩이만 떠 있고 몸이 안 보인다.**
// (그 점선 규칙은 그림의 첫 줄에 이미 적혀 있다 — 「안 건드린 곳은 점선으로만 두른다」)
//
// 그리고 색은 **값을 직접 적어야 한다.** `var(--warning)` 을 SVG 속성에 넣으면
// 아무 색도 안 칠해진다(그림 머리글에 적힌 것이고, 9/30 에 한 번 물렸다).
const codeOf = (x) => x
  .replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, '$1')
  .replace(/^\s*\/\/.*$/gm, '');
const partsPage = codeOf(fs.readFileSync('src/pages/PartsPage.jsx', 'utf-8'));
const bodySvg = codeOf(fs.readFileSync('src/components/PumpBody.jsx', 'utf-8'));

console.log('── 몸 그림이 보이는가 ──');
// 두 갈래 다 몸을 그린다 (아픔 · 미리보기 · 미리보기의 빈 상태 = 셋)
ok('몸 그림을 세 자리에서 그린다', (partsPage.match(/<PumpBody/g) || []).length, 3);
ok('  셋 다 나머지를 점선으로 두른다',
  (partsPage.match(/untouched: MAP_PARTS/g) || []).length >= 3, true);
// 아픔은 금색이 아니다 — 달아오름과 뜻이 섞인다
ok('아픔은 딴 색으로 칠한다', /mark=\{\{ parts: rows/.test(partsPage), true);
ok('  그 색을 값으로 넘긴다 (CSS 변수는 SVG 에서 안 먹는다)',
  /color: MARK_WARNING/.test(partsPage), true);
ok('  SVG 에 CSS 변수를 안 넘긴다', /mark=\{\{[^}]*var\(--/.test(partsPage), false);
ok('그림 쪽도 값을 직접 들고 있다', /MARK_WARNING = '#[0-9a-f]{6}'/.test(bodySvg), true);
// 읽어주는 말은 자리마다 달라야 한다 — 「이번 판에서 등를 채웠어요」는 여기서 틀린 말이다
ok('읽어주는 말을 자리마다 바꿔 넘긴다', (partsPage.match(/label=/g) || []).length, 3);

console.log('');
if (bad > 0) { console.log(bad + '건 실패'); process.exit(1); }
console.log('모두 통과');
