// **한쪽씩 하는 운동 — 오른쪽 칸이 네 길에서 같은 자를 쓰는가** (2026-11-19)
//
//   npm run side
//   node scripts/check-side.cjs --되돌려     일부러 어긋낸 꼴 여섯을 먹여 본다
//
// ── 왜 이 자가 생겼나 ──
//
// 11/17 에 「원팔 덤벨로우 L<R」 같은 이름을 **거절**하게 만들었다. 거절은 맞았지만
// **받을 칸을 안 줬다** — 그 사람은 좌우가 다른 날을 어디에도 못 적는다. 11/19 에
// `weight_r` · `reps_r` 를 붙여 그 짝을 냈다(시안 1119 ①).
//
// 이 칸은 **길이 넷**이다 — 손으로 적기(`POST`) · 고치기(`PUT`) · 파일로 넣기
// (`utils/csvRows`) · 파일로 받기(`routes/export`). 무게 칸이 10/22 에 바로 이
// 자리에서 어긋났다(손으로는 `-50` 을 막고 파일로는 그냥 들어왔다). 그래서 자를 둔다.
//
// ── 무엇을 보는가 ──
//
//   ⑴ **자가 하나인가** — 네 길이 `utils/workoutFields.js` 의 같은 손을 부른다
//   ⑵ **좌우가 같으면 칸을 안 만드는가** — 안 적는 사람의 줄이 지금과 모양이 같아야
//      한다(`note` · `rir` · `link` 와 같은 결). 이게 깨지면 옛 줄과 새 줄이 갈린다
//   ⑶ **내보낸 것을 되읽는가** — 내보내는 식을 `routes/export.js` 에서 **읽어서** 센다.
//      베껴 적으면 한쪽만 고쳐지는 날 자만 옛 식을 본다(11/17 머리줄 사건과 같은 선)
//   ⑷ **열 이름을 못 박는다** — 이름이 바뀌면 머리줄과 읽는 쪽이 같이 바뀌어 한 바퀴는
//      계속 돌지만 **이미 내보낸 파일**이 조용히 안 읽힌다. 영어 별명도 살아 있어야 한다
//   ⑸ **옛 파일(두 칸이 없는 것)도 읽힌다** — 열이 없으면 칸을 만들지 않는다
//   ⑹ **유산소 줄에는 담지 않는다** — 런닝머신에 왼쪽 오른쪽이 없다
//
// 읽기에 실패하면 **통과가 아니라 FAIL** 이다 — 모를 때는 우는 쪽으로 틀린다.
const fs = require('fs');
const path = require('path');

const SRC = (p) => path.join(__dirname, '..', 'src', p);
const { normalizeSideWeight, normalizeSideReps } = require(SRC('utils/workoutFields'));
const { readWorkouts, headerOf, COLS } = require(SRC('utils/csvRows'));

const NL = String.fromCharCode(10);
let bad = 0;
const 본다 = (이름, 받은것, 바라던것) => {
  const g = JSON.stringify(받은것);
  const w = JSON.stringify(바라던것);
  const 같다 = g === w;
  if (!같다) bad += 1;
  console.log((같다 ? 'OK   ' : 'FAIL ') + 이름 + ' → ' + g + (같다 ? '' : ' (기대: ' + w + ')'));
};

// ── 내보내는 식을 그 파일에서 읽는다 ──────────────────────────
//
// 되돌려 꼴이 이 손에 가짜 글을 먹인다. 그래서 **글을 받는 함수**로 둔다
const 식 = {
  /** `routes/export.js` 의 운동 줄 식. 못 찾으면 `null` (= FAIL) */
  내보내는식(글) {
    // 11/26 에 「순서」 칸이 붙어 식이 `return` 안으로 들어갔다 — 두 꼴을 다 찾는다
    const m = /const rows = workouts\.map\(\(?w\)? =>[\s\S]{0,3000}?`([^`]+)`/.exec(글);
    return m ? m[1] : null;
  },
  /** 그 식이 적는 칸 수 */
  칸수(식글) {
    return 식글 === null ? null : 식글.split(',').length;
  },
};

const 한줄로 = (식글, w) => {
  const LINK_KO = { drop: '드롭', super: '슈퍼' };
  // `no` 는 그날 적은 차례(2026-11-26 「순서」 칸). 한 줄만 보는 자라 1 이다
  const 값 = (expr) => new Function('w', 'LINK_KO', 'no', 'return (' + expr + ');')(w, LINK_KO, 1);
  return 식글
    .replace(/\$\{csvCell\(([^)]*?)\)\}/g, (_, e) => String(값(e)))
    .replace(/\$\{([^}]+)\}/g, (_, e) => String(값(e)));
};

// ── ⑴ 자가 하나인가 ───────────────────────────────────────────
console.log('── 네 길이 같은 자를 부르는가 ──');
const 부르나 = (파일, 손) => {
  const 글 = fs.readFileSync(SRC(파일), 'utf8');
  return 글.includes(손);
};
본다('손으로 적는 길이 부른다', 부르나('routes/workouts.js', 'normalizeSideWeight'), true);
본다('  오른쪽 횟수도', 부르나('routes/workouts.js', 'normalizeSideReps'), true);
본다('파일로 넣는 길이 부른다', 부르나('utils/csvRows.js', 'normalizeSideWeight'), true);
본다('  오른쪽 횟수도', 부르나('utils/csvRows.js', 'normalizeSideReps'), true);
본다('고치는 길도 같은 자리에서 받는다',
  (fs.readFileSync(SRC('routes/workouts.js'), 'utf8').match(/normalizeSideWeight\(/g) || []).length, 2);
본다('담는 쪽이 두 칸을 안다',
  ['weight_r', 'reps_r'].every((k) => fs.readFileSync(SRC('db.js'), 'utf8').includes(k)), true);

// ── ★ 세트를 받는 길이 살아 있는가 ───────────────────────────
//
// (2026-11-19 · 정석이 **화면을 열어** 잡았다) 좌우 칸을 붙일 때 가장 쉽게 깨지는 것이
// **세트 하나**다. 한 세트에 양쪽을 다 하므로 세트는 좌우로 쪼개지 않는데, 그 말을
// 서버에만 적고 화면에서 그 칸을 지우면 **세트를 적을 자리가 없어진다.**
// 서버 쪽 자로는 안 잡힌다 — 서버는 `sets` 를 그대로 받으니까. **화면이 안 보내면 끝이다.**
//
// 그래서 여기서 **화면이 담아 보내는 글**을 읽는다. 자리를 숫자로 박지 않고 식으로 찾는다
const 화면 = {
  /** 기록 화면이 서버로 담아 보내는 글 한 덩이 (`TrainPage.jsx` 의 `payload`) */
  담는글(글) {
    const m = /const payload = asCardio\s*\n([\s\S]{0,700}?)\n\s*\/\//.exec(글);
    return m ? m[1] : null;
  },
};
console.log(NL + '── 세트를 받는 길이 살아 있는가 ──');
const 화면글 = fs.readFileSync(
  path.join(__dirname, '..', '..', 'frontend', 'src', 'pages', 'TrainPage.jsx'), 'utf8');
const 담는글 = 화면.담는글(화면글);
본다('화면이 담아 보내는 글을 찾았다', 담는글 !== null, true);
본다('세트를 담는다', 담는글 !== null && /\bsets:/.test(담는글), true);
본다('  횟수도', 담는글 !== null && /\breps:/.test(담는글), true);
본다('  무게도', 담는글 !== null && /\bweight:/.test(담는글), true);
// **칸 이름을 베끼지 않는다** — 「세트」라고 적힌 라벨이 **그 라벨이 가리키는 칸**(`htmlFor`)을
// 들고 있는지로 본다. 라벨만 남고 칸이 사라지는 것이 이 결함의 꼴이다
const 세트라벨 = /<label[^>]*htmlFor="([^"]+)"[^>]*>세트<\/label>/.exec(화면글);
본다('「세트」 라벨이 있다', 세트라벨 !== null, true);
본다('  그 라벨이 가리키는 칸이 있다',
  세트라벨 !== null && new RegExp('id="' + 세트라벨[1] + '"').test(화면글), true);

// ── ⑵ 좌우가 같으면 칸을 안 만든다 ────────────────────────────
console.log(NL + '── 좌우가 같으면 칸을 안 만든다 ──');
본다('무게가 같으면', normalizeSideWeight('22.5', '22.5', false), { ok: true, value: null });
본다('  맨몸끼리도', normalizeSideWeight('맨몸', '맨몸', false), { ok: true, value: null });
본다('횟수가 같으면', normalizeSideReps(10, 10, false), { ok: true, value: null });
본다('  글자로 온 같은 수도', normalizeSideReps('10', 10, false), { ok: true, value: null });
본다('안 보내면 건드리지 않는다',
  [normalizeSideWeight(undefined, '22.5', false).value, normalizeSideReps(undefined, 10, false).value],
  [undefined, undefined]);
본다('빈 글은 지운다',
  [normalizeSideWeight('', '22.5', false).value, normalizeSideReps('', 10, false).value], [null, null]);
본다('다르면 담는다',
  [normalizeSideWeight('20', '22.5', false).value, normalizeSideReps('8', 10, false).value], ['20', 8]);

// ── 왼쪽과 같은 테두리인가 ───────────────────────────────────
console.log(NL + '── 왼쪽과 같은 테두리인가 ──');
본다('음수는 거절', normalizeSideWeight('-5', '22.5', false).ok, false);
본다('999 넘으면 거절', normalizeSideWeight('1000', '22.5', false).ok, false);
본다('0 회는 거절', normalizeSideReps(0, 10, false).ok, false);
본다('소수 횟수는 거절', normalizeSideReps('8.5', 10, false).ok, false);
본다('섞인 글자는 거절', normalizeSideReps('8회', 10, false).ok, false);
본다('1000 넘으면 거절', normalizeSideReps(1001, 10, false).ok, false);

// ── ⑶⑷ 내보낸 것을 되읽는가 ──────────────────────────────────
console.log(NL + '── 내보낸 것을 되읽는가 (한 바퀴) ──');
const 내보내기글 = fs.readFileSync(SRC('routes/export.js'), 'utf8');
const 식글 = 식.내보내는식(내보내기글);
본다('내보내는 식을 찾았다', 식글 !== null, true);
본다('머리줄 칸 수와 내보낸 칸 수가 같다', 식.칸수(식글), COLS.workouts.length);
// 11/26 에 끝에 「순서」가 붙었다(`csvRows.COLS` 머리글) — **이 두 칸의 자리는 그대로**다
본다('열 이름이 바뀌지 않았다', COLS.workouts.slice(10, 12), ['오른쪽 무게', '오른쪽 횟수']);

if (식글) {
  const 줄 = {
    date: '2026-11-19', exercise: '원팔 덤벨로우', weight: '22.5', sets: 3, reps: 10,
    note: '왼무릎 모임', rir: '1~2', weight_r: '20', reps_r: 8,
  };
  const 되읽기 = readWorkouts(headerOf('workouts') + NL + 한줄로(식글, 줄));
  본다('거절된 줄 없다', 되읽기.bad, []);
  본다('오른쪽이 돌아온다',
    [되읽기.rows[0] && 되읽기.rows[0].weight_r, 되읽기.rows[0] && 되읽기.rows[0].reps_r], ['20', 8]);
  본다('왼쪽도 그대로',
    [되읽기.rows[0] && 되읽기.rows[0].weight, 되읽기.rows[0] && 되읽기.rows[0].reps], ['22.5', 10]);
}

console.log(NL + '── 영어 별명으로 적힌 파일도 읽힌다 (손으로 만든 것) ──');
const 영어 = ['date,exercise,weight,sets,reps,weight_r,reps_r',
  '2026-11-19,원팔 덤벨로우,22.5,3,10,20,8'].join(NL);
const 영 = readWorkouts(영어);
본다('거절 없다', 영.bad, []);
본다('오른쪽이 돌아온다', [영.rows[0] && 영.rows[0].weight_r, 영.rows[0] && 영.rows[0].reps_r], ['20', 8]);

// ── ⑸ 옛 파일 ────────────────────────────────────────────────
console.log(NL + '── 옛 파일(두 칸이 없는 것)도 읽힌다 ──');
const 옛 = readWorkouts(['날짜,운동명,무게,세트,횟수', '2026-11-19,벤치프레스,60,5,8'].join(NL));
본다('거절 없다', 옛.bad, []);
본다('오른쪽 칸을 만들지 않는다',
  [('weight_r' in (옛.rows[0] || {})), ('reps_r' in (옛.rows[0] || {}))], [false, false]);

// ── ⑹ 유산소 줄 ──────────────────────────────────────────────
console.log(NL + '── 유산소 줄에는 담지 않는다 ──');
본다('무게가 오면 거절', normalizeSideWeight('20', '맨몸', true).why, '유산소 줄에는 좌우를 따로 적지 않아요');
본다('횟수가 오면 거절', normalizeSideReps(8, null, true).why, '유산소 줄에는 좌우를 따로 적지 않아요');
const 유산소 = readWorkouts([headerOf('workouts'), '2026-11-19,런닝머신,맨몸,,,,30,5,,,20,8'].join(NL));
본다('파일에서도 그 줄만 거절한다', 유산소.bad.length, 1);
본다('  까닭을 말한다', 유산소.bad[0] && 유산소.bad[0].why, '유산소 줄에는 좌우를 따로 적지 않아요');

// ── 되돌려 보기 ──────────────────────────────────────────────
//
// **셈이 0 이어서 통과한 것**과 **자가 안 도는 것**을 가른다. 어긋낸 꼴을 자의 손에
// 직접 먹여, 자가 그것을 집는지 본다 (`check-angle.cjs` 와 같은 꼴)
if (process.argv.includes('--되돌려')) {
  console.log(NL + '── 되돌려 보기 ──');
  let 샌것 = 0;
  const 꼴 = [
    ['내보내는 식에서 두 칸을 빼면 칸 수가 모자란다',
      // **글을 어긋낸 뒤 다시 뽑는다** — 파일 글을 그대로 세면 파일 전체의 쉼표를 센다
      () => 식.칸수(식.내보내는식(내보내기글.replace(",${csvCell(w.weight_r || '')},${w.reps_r || ''}", ''))),
      COLS.workouts.length - 2],
    ['  지금 식은 머리줄과 같다', () => 식.칸수(식글), COLS.workouts.length],
    ['식을 못 찾으면 null 이다 (통과가 아니다)', () => 식.내보내는식('아무 글도 아니다'), null],
    ['열 이름이 바뀌면 끝 두 이름이 달라진다',
      () => ['메모2', '여유2'].join('·') === ['오른쪽 무게', '오른쪽 횟수'].join('·'), false],
    ['「같으면 칸을 안 만든다」가 꺼지면 값이 담긴다',
      () => normalizeSideWeight('22.5', undefined, false).value, '22.5'],
    ['유산소 깃발이 꺼지면 거절하지 않는다',
      () => normalizeSideReps(8, null, false).value, 8],
    // ★ 세트 칸이 사라진 꼴 — 11/19 에 내 시안이 바로 이렇게 틀렸다
    ['세트를 안 담으면 담는 글에 `sets:` 가 없다',
      () => /\bsets:/.test(화면.담는글(화면글.replace(/sets: Number\(useSets\), /, '')) || ''), false],
    ['라벨이 가리키는 칸이 사라지면 못 찾는다',
      () => {
        const 어긋낸글 = 화면글.replace('id="tr-s"', 'id="tr-없어진칸"');
        const l = /<label[^>]*htmlFor="([^"]+)"[^>]*>세트<\/label>/.exec(어긋낸글);
        return l !== null && new RegExp('id="' + l[1] + '"').test(어긋낸글);
      }, false],
    ['담는 글을 못 찾으면 null 이다 (통과가 아니다)',
      () => 화면.담는글('아무 글도 아니다'), null],
  ];
  for (const [이름, 부르기, 어긋난값] of 꼴) {
    const 받은것 = 부르기();
    const 집었다 = JSON.stringify(받은것) === JSON.stringify(어긋난값);
    if (!집었다) 샌것 += 1;
    console.log((집었다 ? 'OK   잡는다: ' : 'FAIL 샌다  : ') + 이름
      + ' → ' + JSON.stringify(받은것) + (집었다 ? '' : ' (기대: ' + JSON.stringify(어긋난값) + ')'));
  }
  bad += 샌것;
  console.log(샌것 ? '  ↑ **어긋난 꼴을 자가 못 집었다.**'
    : '  어긋낸 꼴 ' + 꼴.length + '개를 다 집었다');
}

console.log(NL + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
