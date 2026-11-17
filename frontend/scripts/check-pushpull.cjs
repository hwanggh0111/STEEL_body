// **미는 것과 당기는 것을 바르게 세는가** (2026-11-17 · 맵시).
//
//   npm run pushpull     (npm run check 에도 들어 있다)
//
// ── 왜 이 자가 생겼나 ──
//
// 11/09 에 「밀기 : 당기기」 기능을 연구하다가 **「밀기가 네 배」라고 적었고 그것이
// 지어낸 수**였다(`scripts/measure-pushpull.cjs` 머리글). 재보니 그 수가 아니었다.
// 이제 그 셈이 **사람 화면에 뜬다**(`components/PartBalance.jsx`) — 화면에 뜨는
// 수는 지어내면 안 되고, **조용히 틀리면 아무도 안 부른다.**
//
// 이 자가 보는 것은 **셈의 규칙 다섯**이다 —
//
//   1. **세트로 센다.** 무게로 세면 스쿼트 한 세트가 컬 열 세트를 이긴다
//   2. **코어가 잡힌다.** 플랭크는 무게가 없다 — kg 으로 세면 「코어 0%」가 되고
//      그것은 맞는 셈이고 **틀린 그림**이다 (11/09 에 그래서 kg 안을 접었다)
//   3. **유산소는 축이 다르다** — 미는 것도 당기는 것도 아니다
//   4. **못 가린 것은 어디에도 안 센다** — 사이드 레이즈(벌리는 것) · 부위를 못
//      알아본 것 · 줄여 적어 갈리지 않는 것(「데드」 = 데드행? 데드리프트?)
//   5. **한쪽이 0 이면 배수가 없다** — ∞ 는 수가 아니다
//
// 표(묶음 → 쪽)는 **`src/data/pushPull.js` 한 자리**에 있다. 이 자도 `measure-pushpull`
// 도 거기서 읽는다 — 베껴 적으면 **화면과 자가 다른 말을 하는 날**이 온다
// (11/16 의 「자가 「지금」을 베끼면 거짓이 된다」 류).
//
//   node scripts/check-pushpull.cjs --되돌려   일부러 틀린 셈 다섯을 먹여 빨개지는지 본다

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
let bad = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) bad += 1;
  console.log((pass ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got)
    + (pass ? '' : ' (기대: ' + JSON.stringify(want) + ')'));
};

/** 앱 모듈을 그대로 불러온다 — 화면이 쓰는 그 손을 본다 (`measure-pushpull` 과 같은 길) */
function load(rel, tmp) {
  const file = path.join(ROOT, tmp);
  esbuild.buildSync({
    entryPoints: [path.join(ROOT, rel)], bundle: true, format: 'cjs',
    outfile: file, platform: 'node', logLevel: 'silent',
  });
  const m = require(file);
  fs.unlinkSync(file);
  return m;
}

const PP = load('src/data/pushPull.js', '.cpp-pushpull.cjs');

// ── 먹이는 기록 ──
//
// **하루에 다 넣는다** — 창(28일)을 보는 것은 아래에서 따로 본다.
// 스쿼트는 **200kg 한 세트**, 컬은 **10kg 열 세트**다. kg 으로 세면 하체가
// 1,000 : 1,200 으로 비슷해 보이지만 **세트로 세면 1 : 10** 이다
const 오늘 = '2026-11-17';
const 기록 = {
  [오늘]: [
    { exercise: '스쿼트', weight: '200kg', sets: 1, reps: 5 },
    { exercise: '덤벨컬', weight: '10kg', sets: 10, reps: 12 },
    { exercise: '벤치프레스', weight: '80kg', sets: 5, reps: 5 },
    { exercise: '플랭크', sets: 3, reps: 1 },                  // 무게가 없다
    { exercise: '런닝머신', minutes: 30 },                      // 축이 다르다
    // **지어내 적어둔 옛 줄** — 「런닝머신 1세트 1회」(2026-11-05 머리글에 적힌 그 꼴).
    // 세트가 적혀 있으므로 **세기 쉬운 자리**다. 유산소는 축이 다르니 안 센다
    { exercise: '런닝머신', sets: 1, reps: 1 },
    { exercise: '사이드 레이즈', weight: '8kg', sets: 4, reps: 15 }, // 벌리는 것
    { exercise: '데드', weight: '140kg', sets: 2, reps: 5 },    // 줄여 적어 갈린다
    { exercise: '아무거나ㅁㄴㅇ', weight: '20kg', sets: 7, reps: 7 }, // 부위를 못 알아본다
  ],
  '2026-11-18': [{ exercise: '벤치프레스', weight: '80kg', sets: 99, reps: 5 }], // 앞날
  '2026-09-01': [{ exercise: '벤치프레스', weight: '80kg', sets: 50, reps: 5 }], // 창 밖
};

console.log('── 이름을 어느 쪽으로 가르나 ──');
ok('사전 이름이 하나라도 잡힌다 (사전이 비면 아무것도 안 잡는다)', PP.dictNameCount() > 100, true);
const 가름 = (n) => PP.sideOf(n);
ok('벤치프레스는 밀기', 가름('벤치프레스'), 'push');
ok('  **「벤치」로 줄여 적어도** 밀기다 (실제 기록에 스물두 줄)', 가름('벤치'), 'push');
ok('덤벨컬은 당기기 (`part: 팔` 안에 밀기도 있으므로 **묶음으로** 가른다)', 가름('덤벨컬'), 'pull');
ok('플랭크는 코어 — 무게가 없어도 잡힌다', 가름('플랭크'), 'core');
ok('런닝머신은 유산소 (부위가 `전신 · 유산소` 라 「못 알아본 것」이 아니다)', 가름('런닝머신'), 'cardio');
ok('사이드 레이즈는 **어느 쪽도 아니다** (벌리는 것)', 가름('사이드 레이즈'), 'nosplit');
ok('「데드」는 **갈리지 않아 안 센다** (데드행=당기기 · 데드리프트=하체)', 가름('데드'), 'nosplit');
ok('  적어 둔 그대로 「데드리프트」면 하체다', 가름('데드리프트'), 'leg');
ok('모르는 이름은 부위부터 못 알아본다', 가름('아무거나ㅁㄴㅇ'), 'other');

// ── **묶음이 기구 이름이면 축은 운동 이름 안에 있다** ── (`GEAR_GROUPS`)
//
// 밴드 여덟이 통째로 「못 가림」으로 떨어지고 있었다 — 집에서 밴드로 하는 사람의
// 기록이 전부 어디에도 안 셌다. **부위로는 못 가른다**(`밴드 풀어파트` 는 부위가
// 어깨인데 당기는 것이다) → 이름 안의 묶음 이름으로 본다
ok('`밴드 로우` 는 당기기 (이름 안의 「로우」)', 가름('밴드 로우'), 'pull');
ok('  `밴드 체스트프레스` 는 밀기', 가름('밴드 체스트프레스'), 'push');
ok('  `밴드 스쿼트` 는 하체', 가름('밴드 스쿼트'), 'leg');
ok('  `밴드 풀어파트` 는 **여전히 못 가림** (어깨라고 밀기로 고르지 않는다)',
  가름('밴드 풀어파트'), 'nosplit');

// ── ★ **표와 사전이 서로 맞나 (모집단)** ── (2026-11-17 · 정석의 지적을 받아 세웠다)
//
// 위 가름 열 줄은 **표본**이다. 표본이 다 맞아도 **사전에 새 묶음이 생기면** 그것은
// 조용히 「못 가림」으로 떨어지고, 「전부 가려진다」는 말은 **셈이 작아서 참**이 된다.
// 정석이 오늘 `check-typedfield` 에서 같은 꼴을 잡았다(아이디 칸을 셋 중 하나만 셌다).
//
// 그래서 **사전 쪽에서 거꾸로** 본다 —
//   ⑴ 표에 적었는데 사전에 **없는** 묶음은 죽은 줄이다(오타 · 이름이 바뀐 것)
//   ⑵ 한 묶음이 **두 목록**에 들면 `groupSide` 의 **적은 차례**가 답을 정한다 — 사고다
//   ⑶ 축에 안 든 묶음은 **세어서 적는다.** FAIL 로 두지 않는다(레이즈처럼 어느 쪽도
//      아닌 것이 실제로 있다) — 다만 **수가 보여야** 늘어난 날 눈에 띈다
console.log('\n── 표와 사전이 서로 맞나 ──');
{
  const dict = load('src/data/exerciseDict.js', '.cpp-dict.cjs');
  const 사전묶음 = new Set((dict.EXERCISE_DICT || []).map((e) => e.group).filter(Boolean));
  ok('사전에서 묶음을 읽었다', 사전묶음.size > 10, true);

  const 표 = { push: PP.PUSH_GROUPS, pull: PP.PULL_GROUPS, leg: PP.LEG_GROUPS, core: PP.CORE_GROUPS };
  const 없는것 = [];
  const 겹친것 = [];
  const 본것 = new Map();
  for (const [쪽, 목록] of Object.entries(표)) {
    for (const g of 목록) {
      if (!사전묶음.has(g)) 없는것.push(`${쪽}:${g}`);
      if (본것.has(g)) 겹친것.push(`${g} (${본것.get(g)} · ${쪽})`);
      else 본것.set(g, 쪽);
    }
  }
  ok('표의 묶음이 **전부 사전에 있다** (없으면 죽은 줄이다)', 없는것, []);
  ok('한 묶음이 두 쪽에 들어 있지 않다 (들면 적은 차례가 답을 정한다)', 겹친것, []);

  const 안든것 = [...사전묶음].filter((g) => !본것.has(g)).sort();
  console.log('       축에 안 든 묶음 ' + 안든것.length + '개 / 사전 ' + 사전묶음.size + '개');
  console.log('         ' + 안든것.join(' · '));
  // 그 묶음들은 **어느 쪽도 아니다**로 떨어져야 한다 — 하나 골라 실제로 확인한다
  if (안든것.length) {
    const 보기 = (dict.EXERCISE_DICT || []).find((e) => e.group === 안든것[0]);
    ok('  축에 안 든 묶음은 `nosplit` 으로 떨어진다 (' + (보기?.ko || '') + ')',
      보기 ? PP.sideOf(보기.ko) : 'nosplit', 'nosplit');
  }
}

console.log('\n── 세트로 세는가 ──');
const b = PP.pushPullBalance(기록, { today: 오늘 });
ok('밀기 세트', b.sets.push, 5);
ok('당기기 세트', b.sets.pull, 10);
ok('하체 세트 — **무게가 아니다** (200kg 한 세트는 1 이다)', b.sets.leg, 1);
ok('코어 세트 — 무게가 없는 것도 센다', b.sets.core, 3);
ok('상체 = 밀기 + 당기기', b.upper, 15);
ok('가려진 세트 전부', b.total, 19);
ok('본 창은 28일이다', b.days, 28);

console.log('\n── 안 센 것을 세어서 말하는가 ──');
ok('유산소 줄 — **세트가 적힌 옛 줄까지** 둘 다 안 센다', b.skipped.cardio, 2);
ok('부위를 못 알아본 줄', b.skipped.other, 1);
ok('축에 없거나 갈리지 않는 줄 (사이드 레이즈 · 데드)', b.skipped.nosplit, 2);
ok('  그 줄들의 세트는 **어디에도 안 들었다** (4 + 2 + 7 세트가 total 밖이다)',
  b.sets.push + b.sets.pull + b.sets.leg + b.sets.core, b.total);

console.log('\n── 창 밖과 앞날 ──');
ok('앞날 기록은 안 센다 (99세트가 밀기에 안 들었다)', b.sets.push < 99, true);
ok('창 밖(28일 전) 기록도 안 센다 (50세트가 안 들었다)', b.sets.push, 5);
const 넓게 = PP.pushPullBalance(기록, { today: 오늘, days: 200 });
ok('  창을 넓히면 그 줄이 들어온다', 넓게.sets.push, 55);

console.log('\n── 배수 ──');
ok('밀기 ÷ 당기기', Math.round(b.ratio * 100) / 100, 0.5);
ok('  꼴은 **자리로** 말한다 (1 아래면 당기는 쪽이 많다)', PP.ratioLabel(b.ratio), '1 : 2');
ok('2.5배는 `2.5 : 1`', PP.ratioLabel(2.5), '2.5 : 1');
ok('열 배를 넘으면 소수를 접는다', PP.ratioLabel(12.4), '12 : 1');
const 한쪽만 = PP.pushPullBalance({ [오늘]: [{ exercise: '벤치프레스', weight: '80kg', sets: 3, reps: 5 }] }, { today: 오늘 });
ok('**한쪽이 0 이면 배수가 없다** — ∞ 는 수가 아니다', 한쪽만.ratio, null);
ok('  그때 꼴도 없다 (화면이 다른 줄을 쓴다)', PP.ratioLabel(한쪽만.ratio), null);

console.log('\n── 셀 것이 없을 때 ──');
const 빈것 = PP.pushPullBalance({}, { today: 오늘 });
ok('기록이 없으면 전부 0 이다', 빈것.total, 0);
ok('  (화면은 그때 칸을 아예 안 그린다 — `PartBalance` 의 `total === 0`)',
  fs.readFileSync(path.join(ROOT, 'src/components/PartBalance.jsx'), 'utf8').includes('total === 0'), true);

// ─────────────────────────────────────────────────────────────
// 되돌려-FAIL — **일부러 틀린 셈**을 먹여 이 자가 빨개지는지 본다.
//
// 자를 세워놓고 「PASS 가 떴다」로 끝내면 자가 장식이 된다. 아래 넷은 11/09 에
// 실제로 고민했던 틀린 길들이다 — kg 으로 세기(둘) · 유산소 끼우기 · 못 가린 것
// 한쪽에 넣기 · 앞날 세기. 다섯 다 **이 자가 집어야 한다.**
// ─────────────────────────────────────────────────────────────
if (process.argv.includes('--되돌려')) {
  console.log('\n── 되돌려-FAIL: 일부러 틀린 셈을 먹인다 ──');
  const kg = (w) => { const m = /\d+(?:\.\d+)?/.exec(String(w || '')); return m ? Number(m[0]) : 0; };
  const 틀린셈 = [
    {
      이름: 'kg 으로 세면 — 하체가 1 이 아니라 1000 이 된다',
      run: () => {
        let leg = 0;
        for (const r of 기록[오늘]) if (PP.sideOf(r.exercise) === 'leg') leg += kg(r.weight) * (r.sets || 0) * (r.reps || 0);
        return leg === 1;
      },
    },
    {
      이름: 'kg 으로 세면 — 코어가 0 이 된다 (플랭크는 무게가 없다)',
      run: () => {
        let core = 0;
        for (const r of 기록[오늘]) if (PP.sideOf(r.exercise) === 'core') core += kg(r.weight) * (r.sets || 0);
        return core === 3;
      },
    },
    {
      이름: '유산소를 밀기에 끼우면 — 밀기가 5 가 아니게 된다',
      run: () => {
        let push = 0;
        for (const r of 기록[오늘]) {
          const s = PP.sideOf(r.exercise);
          if (s === 'push' || s === 'cardio') push += Number(r.sets) || 0;
        }
        return push === 5;
      },
    },
    {
      이름: '못 가린 것을 한쪽에 몰면 — 가려진 세트 합이 total 을 넘는다',
      run: () => {
        let t = 0;
        for (const r of 기록[오늘]) t += Number(r.sets) || 0;   // 전부 센다
        return t === b.total;
      },
    },
    {
      이름: '앞날을 세면 — 밀기가 5 가 아니라 104 가 된다',
      run: () => {
        let push = 0;
        for (const [, list] of Object.entries(기록)) {
          for (const r of list) if (PP.sideOf(r.exercise) === 'push') push += Number(r.sets) || 0;
        }
        return push === 5;
      },
    },
  ];
  for (const t of 틀린셈) ok('틀린 셈이 **걸린다**: ' + t.이름, t.run(), false);
}

console.log('\n' + (bad ? bad + '건 실패' : '전부 통과'));
process.exit(bad ? 1 : 0);
