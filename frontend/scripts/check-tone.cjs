// 내가 만드는 알림 소리 (2026-09-22).
//
//   npm run tone     (npm run check 에도 들어 있다)
//
// **귀로만 확인되는 자리라 값으로 본다.** 소리가 맞게 나는지는 들어봐야 알지만,
// 「마지막 음이 올라가는가」 · 「없는 값을 골라도 안 터지는가」 · 「지운 소리를 고른 채로
// 두지 않는가」는 숫자로 볼 수 있다.
const esbuild = require('esbuild');
const fs = require('fs');

const bundle = (entry, out) => {
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', outfile: out, platform: 'node' });
  const m = require(process.cwd() + '/' + out);
  fs.unlinkSync(out);
  return m;
};

// localStorage 가 없으면 모듈을 읽다가 터진다
let store = {};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const C = bundle('src/data/customTones.js', '.t1.cjs');

let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

console.log('── 고른 것 → 울릴 음 ──');
const mid3 = C.notesOf({ pitch: 'mid', count: 3, speed: 'mid', shape: 'soft' });
ok('세 번 고르면 음이 셋', mid3.length, 3);
ok('보통 높이는 880', mid3[0].freq, 880);
// **마지막만 올라간다.** 같은 음을 세 번 치면 「끝났나?」 싶은데, 올라가면 끝이 들린다
ok('마지막은 5도 위 (880 × 1.5)', mid3[2].freq, 1320);
ok('가운데는 그대로', mid3[1].freq, 880);
ok('마지막이 조금 길다', mid3[2].dur > mid3[0].dur, true);
// 보통 빠르기는 0.18초 간격
ok('간격대로 놓인다', [mid3[0].start, mid3[1].start, mid3[2].start], [0, 0.18, 0.36]);

// **한 번이면 올릴 것이 없다.** 한 음짜리에서 5도를 올리면 고른 높이가 아닌 소리가 난다
const one = C.notesOf({ pitch: 'low', count: 1, speed: 'fast', shape: 'sharp' });
ok('한 번이면 고른 높이 그대로', one[0].freq, 440);
ok('  음도 하나', one.length, 1);

const fast = C.notesOf({ pitch: 'high', count: 4, speed: 'fast', shape: 'wood' });
ok('빠르게는 0.11초 간격', fast[1].start, 0.11);
ok('네 번도 된다', fast.length, 4);
ok('결이 실린다 (나무 = triangle)', fast[0].type, 'triangle');
ok('  나무는 잦아든다', fast[0].decay, true);
// 날카롭게(square)는 잦아들지 않는다 — 짧고 딱 끊겨야 시끄러운 곳에서 들린다
ok('날카롭게는 안 잦아든다', one[0].decay, undefined);

console.log('── 없는 값을 골라도 안 터진다 ──');
//
// 앱을 고치면서 재료 하나를 빼는 날이 올 수 있다. 그때 옛 값이 그대로 울리면
// 이상한 소리가 난다 — **기본으로 돌아간다**
ok('없는 높이는 보통으로', C.notesOf({ pitch: '없음', count: 3, speed: 'mid', shape: 'soft' })[0].freq, 880);
ok('없는 횟수는 3번으로', C.notesOf({ pitch: 'mid', count: 99, speed: 'mid', shape: 'soft' }).length, 3);
ok('빈 것을 줘도 안 터진다', C.notesOf({}).length, 3);
ok('아무것도 안 줘도 안 터진다', C.notesOf().length, 3);

console.log('── 한 벌 만들기 ──');
const t = C.buildTone({ pitch: 'high', count: 2, speed: 'slow', shape: 'sharp', name: '내알림' });
ok('이름이 붙는다', t.name, '내알림');
ok('무엇을 골랐는지 적힌다', t.desc, '높게 · 2번 · 느리게 · 날카롭게');
ok('내 것이라고 표시된다', t.mine, true);
ok('고친 것을 다시 열 수 있게 둔다', t.draft, { pitch: 'high', count: 2, speed: 'slow', shape: 'sharp' });
ok('이름이 없으면 「내 소리」', C.buildTone({}).name, '내 소리');
// 고르개에 들어가는 글자라 길면 줄이 무너진다
ok('이름은 여섯 자까지', C.buildTone({ name: '아주아주긴이름입니다' }).name.length, C.NAME_MAX);
ok('공백만 있으면 「내 소리」', C.buildTone({ name: '   ' }).name, '내 소리');

console.log('── 저장하고 읽기 ──');
store = {};
ok('처음에는 없다', C.loadTones(), []);

const saved = C.saveTones([t]);
ok('저장하면 한 벌', saved.length, 1);
ok('  울릴 음까지 만들어 준다', saved[0].notes.length, 2);
const back = C.loadTones();
ok('다시 읽어도 같다', [back.length, back[0].name, back[0].desc], [1, '내알림', '높게 · 2번 · 느리게 · 날카롭게']);

// **저장한 모양을 그대로 믿지 않는다** — 읽을 때마다 다시 만든다.
// 옛 판에서 저장한 값에 없는 재료가 들어 있어도 기본으로 돌아간다
store[Object.keys(store)[0]] = JSON.stringify([{ id: 'x', name: '옛것', draft: { pitch: '없앤것', count: 3, speed: 'mid', shape: 'soft' } }]);
const old = C.loadTones();
ok('없앤 재료는 기본으로 돌아간다', old[0].notes[0].freq, 880);
ok('  이름은 그대로 살린다', old[0].name, '옛것');

// 깨진 것이 들어 있어도 앱은 돈다
store[Object.keys(store)[0]] = '이건 JSON 이 아니다';
ok('깨진 저장은 빈 것으로', C.loadTones(), []);
store[Object.keys(store)[0]] = '{"a":1}';
ok('배열이 아니어도 빈 것으로', C.loadTones(), []);

console.log('── 몇 개까지 ──');
//
// 목록이 길어지면 고르는 일이 일이 된다. 고르개 한 줄에 기본 넷 + 만든 것이 함께 선다
const many = Array.from({ length: 20 }, (_, i) => C.buildTone({ name: 'n' + i, id: 'id' + i }));
ok('넘겨 저장해도 최대까지만', C.saveTones(many).length, C.MAX_TONES);
ok('최대는 여섯', C.MAX_TONES, 6);
ok('꽉 차면 더 못 만든다', C.canAdd(many), false);
ok('비었으면 만들 수 있다', C.canAdd([]), true);

console.log('');
console.log(bad ? bad + '건 어긋남' : '모두 통과');
process.exitCode = bad ? 1 : 0;
