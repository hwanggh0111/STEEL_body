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

console.log('── 붙는 자리 (2026-09-22 에 잡은 것들) ──');
//
// 아래 셋은 **귀로만 드러나는 버그**였다. 값으로는 다 맞는데 소리가 안 나거나
// 다른 소리가 난다 — 글자로 잡을 수밖에 없다.
const fsrc = (f) => fs.readFileSync(f, 'utf-8');

// ① 소리 기계는 **사람이 누른 그 순간**에만 깨울 수 있다. `playTone` 은 이미 깨어
//    있을 때만 울린다 — 설정 화면은 소리를 **처음** 내는 자리라 거기서 깨워야 한다
const maker = fsrc('src/components/ToneMaker.jsx');
ok('만들면서 들려주는 쪽은 previewTone 을 쓴다', /previewTone\(/.test(maker), true);
ok('  playTone 을 그냥 쓰지 않는다', /[^w]playTone\(/.test(maker), false);

// ② 만든 소리를 골라둬도 **앱이 켜질 때 얹지 않으면 안 울린다** —
//    재생하는 쪽은 얹어준 것만 알고, 없으면 기본 소리로 떨어진다(다른 소리가 난다)
const layout = fsrc('src/components/Layout.jsx');
ok('앱이 켜질 때 만든 소리를 얹는다',
  /setExtraTones\(loadTones\(\)\)/.test(layout), true);

// ③ 지운 소리를 고른 채로 두면 **아무 소리도 안 난다**
const setpage = fsrc('src/pages/SettingsPage.jsx');
ok('지운 소리를 고른 채로 두지 않는다',
  /some\(\(t\) => t\.id === toneId\)\) setTone\('ding'\)/.test(setpage), true);

// ④ 설정 화면은 휴식 타이머 스토어를 **통째로 구독하면 안 된다** —
//    그 스토어는 쉬는 동안 250ms 마다 남은 초를 바꾼다. 스위치 열일곱이 초당 네 번씩
//    다시 그려진다
// 주석에도 그 글자가 나오므로(왜 그러면 안 되는지 적어뒀다) **주석을 걷고** 본다
const noComment = setpage.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
ok('설정 화면이 타이머 스토어를 통째로 안 본다',
  /useRestTimerStore\(\)/.test(noComment), false);
ok('  값 하나씩 고른다', (noComment.match(/useRestTimerStore\(\(st\)/g) || []).length >= 6, true);

// ⑤ 「켜짐/꺼짐」은 **걸려 있나**를 봐야 한다. `canLock()` 은 「이 브라우저에서
//    쓸 수 있나」라, 그걸로 적으면 안 걸었는데 「켜짐」이라고 나온다
ok('앱 잠금은 걸렸는지로 적는다', /isLockSet/.test(setpage), true);

// ── 만든 소리를 고를 수 있나 (2026-09-29 에 찾은 버그) ──
//
// 9/22 에 소리 만들기를 붙였는데 **고를 수가 없었다.** 휴식 타이머 스토어가 고른
// 이름을 **기본 넷으로만** 걸렀다 — `my-1758…` 은 그 넷에 없으니 「종」으로 되돌았다.
// 미리듣기는 만든 소리가 나고 저장되는 것은 종이라, 아무도 어디가 틀렸는지 모른다.
console.log('');
console.log('── 만든 소리를 고를 수 있나 ──');

const A = bundle('src/data/alertSound.js', '.t2.cjs');
const my = C.buildTone({ id: 'my-1', name: '내 소리', pitch: 'high', count: 2, speed: 'fast', shape: 'sharp' });

ok('얹기 전에는 모르는 소리다', A.knownTone('my-1'), false);
A.setExtraTones([my]);
ok('얹으면 아는 소리가 된다', A.knownTone('my-1'), true);
ok('기본 넷도 그대로 안다', A.knownTone('ding'), true);
ok('없는 이름은 모른다', A.knownTone('없는것'), false);

// 읽을 때는 **아직 아무도 얹지 않았다**(스토어가 `Layout` 보다 먼저 만들어진다).
// 그래서 모양만 보고 들인다 — 버리면 다시 열 때마다 기본 소리로 돌아간다
ok('만든 소리 이름처럼 생겼다', A.looksLikeToneId('my-1758999'), true);
ok('빈 것은 아니다', A.looksLikeToneId(''), false);
ok('한글·따옴표가 섞이면 아니다', A.looksLikeToneId("ding'); drop"), false);

const rest = fsrc('src/store/restTimerStore.js');
const restCode = rest.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
ok('고른 소리를 기본 넷으로 거르지 않는다', /readPickOf\(id, TONES/.test(restCode), false);
ok('아는 소리인지로 본다', /knownTone\(id\)/.test(restCode), true);
ok('읽을 때는 모양만 본다', /looksLikeToneId/.test(restCode), true);

// ── 설정함이 있는 자리로 보내나 (2026-09-29 에 찾은 버그) ──
//
// 「내려받기 · 가져오기」가 고객센터로 보내면서 있지도 않은 갈래를 넘겼다.
// 내려받기는 기록 화면(`/history`)과 몸의 측정 갈래에 있다
console.log('');
console.log('── 설정함이 있는 자리로 보내나 ──');
ok('고객센터로 안 보낸다', /support['"], \{ state: \{ tab: 'data'/.test(setpage), false);
ok('기록 화면으로 보낸다', /navigate\('\/history'\)/.test(setpage), true);
ok('측정은 몸의 측정 갈래로', /navigate\('\/body', \{ state: \{ tab: 'measure' \} \}\)/.test(setpage), true);
ok('체형에서 잰 것을 지울 수 있다', /removeLS\(SHAPE_LOG_KEY\)/.test(setpage), true);
ok('  옛 한 칸도 같이 지운다', /removeLS\(SHAPE_RATIOS_KEY\)/.test(setpage), true);
ok('헬스장으로 가는 길이 있다', /navigate\('\/gym'\)/.test(setpage), true);

// ── 없는 것을 있다고 적지 않는다 ──
//
// 숨은 **홈트 화면에만** 있다. 「운동할 때도」라고 적어두면 헬스장에서도 된다고 읽는다
console.log('');
console.log('── 숨은 어디서 되나 ──');
const st = fsrc('src/store/settingsStore.js');
const stCode = st.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
ok('「운동할 때도」라고 안 적는다', /운동할 때도/.test(stCode), false);
ok('홈트 안에서 갈린다고 적는다', /홈트 전체에서/.test(stCode), true);
const train = fsrc('src/pages/TrainPage.jsx');
ok('(운동 화면에는 아직 숨이 없다)', /useBreath|BreathRow/.test(train), false);

console.log('');
console.log(bad ? bad + '건 어긋남' : '모두 통과');
process.exitCode = bad ? 1 : 0;
