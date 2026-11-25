// CSV 를 다시 읽어 들이는 쪽 (2026-09-18).
//
// 내보내기는 있는데 **되돌릴 길이 없었다.** 기기를 바꾸거나 계정을 새로 만들면
// 내려받아 둔 파일이 있어도 못 넣는다. 이 DB 는 파일 하나라 날아갈 위험도 남아 있다 —
// 「챙겨 나갈 수는 있는데 들고 들어올 수는 없다」는 반쪽이다.
//
// **여기는 순수한 계산만 둔다** (글자 → 줄). DB 도 요청도 안 만진다 —
// 그래야 `npm run import` 가 값으로 확인할 수 있다. 실제로 넣는 일은 라우트가 한다.
//
// ── 왜 서버에서 읽는가 ──
//
// 화면에서 파싱해 한 줄씩 올릴 수도 있다. 그런데 5년치가 3만 줄이고, 전역 제한은
// 분당 100 요청이다 — **사람이 자기 기록을 되돌리는 일이 공격으로 보인다.**
// 그래서 파일 한 장을 한 번에 받는다.

const { MEASURE_TYPE_OF, FIELD_KEY_OF } = require('./measureLabels');
// 무게 · 운동명을 다듬는 자는 저장하는 쪽과 **같은 것**을 쓴다 (2026-10-22)
const { normalizeWeight, cleanExerciseName, normalizeNote, normalizeRir,
        normalizeSideWeight, normalizeSideReps } = require('./workoutFields');
// 이름이 조용히 잘리는 것을 막는 자 — 까닭도 그 자리에서 가져온다 (2026-11-17)
const { tagLike, ANGLE_WHY } = require('./sanitize');
// 유산소 줄의 시간 · 거리 — **손으로 적는 길과 같은 자**를 쓴다 (2026-11-05).
// 무게에서 한 번 어긋났던 자리라(이 파일 머리글) 처음부터 한 곳에서 든다
const { normalizeCardio } = require('./cardioFields');
const { isRecordDay } = require('./dayRange');
// 내보낼 때 엑셀 때문에 붙인 작은따옴표를 뗀다 — 규칙은 그쪽 한 곳에 있다
const { unguardCell } = require('./csv');

// ── **엑셀에서 한 번 열면 한 줄도 안 들어왔다** ── (2026-11-03)
//
// 사용자 자리에 앉아 「기기를 바꾼 사람」을 걸어보다 걸렸다. 내보낸 파일을
// **엑셀에서 열었다 저장하면 엑셀이 날짜 꼴을 바꿔 쓴다** —
//
//   2026-11-03  →  `2026. 11. 3`  ·  `2026.11.03`  ·  `2026/11/03`
//
// 그러면 **모든 줄이 「날짜가 이상해요」로 거절된다.** 5년치면 3만 줄이 다 거절이고,
// 사람은 **제 기록을 되돌릴 수가 없다** — 내보내기를 둔 까닭이 바로 그 길인데
// (이 파일 머리글: 「챙겨 나갈 수는 있는데 들고 들어올 수는 없다는 반쪽이다」)
// 그 길이 **엑셀을 한 번 거치면 막힌다.** 파일을 열어 눈으로 확인하는 것은
// 사람이 당연히 하는 일이다.
//
// **연-월-일 순서가 분명한 꼴만 받는다.** 첫 토막이 네 자리면 그것이 연도다.
// `11/3/2026` 과 `3/11/2026` 은 **안 받는다** — 나라마다 월·일 순서가 달라
// 어느 쪽인지 알 수 없고, **조용히 틀린 날에 넣는 것이 거절보다 나쁘다.**
// `26-11-03` 도 안 받는다(1926년인지 2026년인지 알 수 없다).
//
// 못 읽으면 **받은 글자를 그대로 돌려준다** — 그 값으로 「이상해요」를 말해야 한다.
const DAY_SHAPE = /^(\d{4})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})\s*\.?$/;
function normalizeDay(raw) {
  const s = String(raw ?? '').trim();
  const m = DAY_SHAPE.exec(s);
  if (!m) return s;
  return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
}

/**
 * CSV 한 장을 줄과 칸으로 쪼갠다.
 *
 * 우리가 내보낸 것을 되읽는 것이 본디 일이라 규칙은 내보내기와 짝이다 —
 *   · 맨 앞의 BOM(`﻿`)을 걷는다. 한글 엑셀을 위해 우리가 붙인 것이다
 *   · 칸 앞의 작은따옴표도 걷는다 — **그것도 우리가 붙인 것**이다
 *     (`utils/csv.js` 의 `unguardCell`). 2026-10-21 까지 안 걷어서 「-5도 인클라인」이
 *     「'-5도 인클라인」으로 들어왔다
 *   · `"` 로 감싼 칸 안에서는 쉼표와 줄바꿈이 글자다. `""` 는 따옴표 하나다
 *   · `\r\n` 과 `\n` 을 같이 받는다 (엑셀은 `\r\n` 으로 저장한다)
 *   · 빈 줄은 버린다 (파일 끝의 줄바꿈 하나가 빈 줄로 읽힌다)
 *
 * **글자를 지어내지 않는다** — 칸 안의 값은 자른 뒤 그대로 돌려준다.
 */
function parseCsv(text) {
  const src = String(text == null ? '' : text).replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; }   // "" → "
        else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ',') { row.push(cell); cell = ''; continue; }
    if (c === '\r') continue;                            // \r\n 의 \r
    if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    cell += c;
  }
  row.push(cell);
  rows.push(row);

  return rows
    // 앞뒤 공백은 **깎는 게 맞다** — 읽는 쪽도(`exercise`), 중복을 보는 열쇠도
    // (`workoutKey`) 이미 깎아서 쓴다. 여기서만 남겨두면 세 자리가 어긋난다
    .map((r) => r.map((v) => unguardCell(v.trim())))
    .filter((r) => r.some((v) => v !== ''));
}

// 엑셀에서 열을 지우거나 순서를 바꿔놓고 넣는 사람이 있다. **머리글을 보고 자리를 찾는다** —
// ── ★ **내보내기 머리줄과 가져오기가 찾는 이름을 한 자리에 둔다** ── (2026-11-17)
//
// 이 파일 머리글이 지키겠다고 적어둔 것이 「내보낸 것을 그 앱이 다시 읽을 수 있는가」다.
// 그런데 **머리줄은 `routes/export.js` 에 생글자로** 있고, 찾는 이름은 **여기에 또
// 생글자로** 있었다 — 한 쌍인데 두 벌이다. 한쪽에서 「무게」를 「무게(kg)」로 다듬으면
// 아래 `at()` 가 그 칸을 **못 찾고 조용히 -1** 이 된다: 날짜 · 운동명만 거절로 걸리고
// **무게 · 세트 · 횟수는 빈 값으로 들어간다.** 파일은 멀쩡해 보이고 수만 비어 있다.
//
// (같은 결의 자리를 오늘 셋 고쳤다 — 받는 파일 이름이 서버와 화면에서 갈린 것 ·
//  「오늘」을 그 자리에서 또 읽던 열두 자리. **한쪽이 정하는 값을 다른 쪽이 또 들고
//  있으면 반드시 갈린다.**)
//
// 그래서 **열 이름을 여기 한 벌만** 둔다. `export.js` 가 이것으로 머리줄을 짓고,
// 아래 `at()` 이 **첫 후보로** 같은 이름을 본다. 옛 파일을 위한 별명(`date` ·
// `weight` 처럼 영어로 적힌 것, 괄호 없는 옛 이름)은 뒤에 그대로 남긴다 —
// 내보낸 적 있는 파일은 **영영 읽혀야 한다.**
const COLS = {
  // `메모` · `여유` 는 2026-11-18 — 끝에 붙인다. 옛 파일은 두 칸이 없고(-1), 그래도 읽힌다
  // `오른쪽 무게` · `오른쪽 횟수` 는 2026-11-19(한쪽씩 하는 운동) — 역시 **끝에** 붙인다.
  // 가운데 끼우면 내보낸 적 있는 파일의 자리가 밀린다
  workouts: ['날짜', '운동명', '무게', '세트', '횟수', '묶음', '시간(분)', '거리(km)', '메모', '여유',
             '오른쪽 무게', '오른쪽 횟수'],
  inbody: ['날짜', '키(cm)', '체중(kg)', '체지방률(%)', '골격근량(kg)', '체수분(L)', 'BMI'],
  measures: ['날짜', '종류', '번호', '항목', '값'],
};

/** 그 갈래의 머리줄 한 줄. 내보내기가 이것을 쓴다 */
const headerOf = (kind) => COLS[kind].join(',');

// 자리를 숫자로 박아두면 열 하나가 밀렸을 때 무게 칸에 세트 수가 들어간다
const at = (header, ...names) => {
  for (const n of names) {
    const i = header.findIndex((h) => h === n);
    if (i >= 0) return i;
  }
  return -1;
};

const num = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

/**
 * 운동 CSV → 넣을 줄.
 *
 * 내보내기의 머리글은 `날짜,운동명,무게,세트,횟수` 다.
 * **한 줄이 안 되는 것 때문에 나머지를 버리지 않는다** — 되돌리려고 넣는 파일이다.
 * 걸린 줄은 몇째 줄이 왜 걸렸는지 같이 돌려준다.
 */
function readWorkouts(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return { rows: [], bad: [{ line: 1, why: '빈 파일이에요' }] };

  const header = rows[0];
  // 첫 후보는 **내보내기가 적는 이름**이다 (위 `COLS`) — 뒤는 옛 파일 별명
  const C = COLS.workouts;
  const iDate = at(header, C[0], 'date');
  const iName = at(header, C[1], '운동', 'exercise');
  const iWeight = at(header, C[2], 'weight');
  const iSets = at(header, C[3], 'sets');
  const iReps = at(header, C[4], 'reps');
  // 2026-10-05 — 슈퍼세트 · 드롭세트 표시. 옛 파일에는 이 칸이 없다(그러면 -1)
  const iLink = at(header, C[5], 'link');
  // 2026-11-05 — 유산소의 시간 · 거리. 옛 파일에는 이 칸이 없다(그러면 -1)
  const iMin = at(header, C[6], '시간', 'minutes');
  const iKm = at(header, C[7], '거리', 'distance_km', 'distance');
  // 2026-11-18 — 한 줄 메모 · 여유 횟수. 옛 파일에는 없다(-1)
  const iNote = at(header, C[8], 'note');
  const iRir = at(header, C[9], 'rir');
  // 2026-11-19 — 한쪽씩 하는 운동. 옛 파일에는 없다(-1)
  const iWeightR = at(header, C[10], 'weight_r');
  const iRepsR = at(header, C[11], 'reps_r');
  // ── ★ **무게 칸이 「없는 것」과 「빈 것」은 다르다** ── (2026-11-17 · 정석)
  //
  // 위 머리글이 막은 것은 **머리줄이 갈리는 것**이고, 그것은 `COLS` 한 벌로 막혔다.
  // 그런데 **열이 아예 없는 파일**은 그대로 지나고 있었다 —
  //
  //     날짜,운동명,세트,횟수          ← 무게 열이 없다 (손으로 만든 파일)
  //     2026-11-17,벤치프레스,5,8      → weight:"맨몸" · 거절 0
  //
  // `normalizeWeight('')` 는 **맨몸**을 내준다. 화면이 맨몸을 그렇게 저장하기 때문에
  // 맞는 자다. 하지만 그것은 **무게 열이 있고 값이 비었을 때**의 뜻이다. 열이 없는
  // 파일은 「무게를 안 담았다」일 뿐인데, 그것을 **「전부 맨몸」으로 단정**하면
  // **60kg 벤치가 맨몸 벤치로 들어오고 거절 줄은 0** 이다. 파일은 멀쩡해 보인다.
  //
  // 날짜 · 운동명은 위에서 막혔고, 세트 · 횟수는 값 검사(`c.ok`)에 걸려 **간접으로**
  // 막혔다. 무게만 **아무 데도 안 걸렸다.**
  //
  // 이 앱이 내보낸 파일에는 **늘 무게 열이 있다**(맨몸이면 비어 있다 — `headerOf`).
  // 그러니 거절해도 제 파일을 되넣는 사람은 안 막힌다. 손으로 만든 파일만 막히고,
  // 그것이 맞다 — **조용히 망가지는 것보다 한 번 막히는 것이 낫다**(모를 때는 우는 쪽).
  if (iDate < 0 || iName < 0) {
    return { rows: [], bad: [{ line: 1, why: '「날짜」와 「운동명」 칸이 있어야 해요' }] };
  }
  if (iWeight < 0) {
    return { rows: [], bad: [{ line: 1,
      why: '「무게」 칸을 못 찾았어요 — 맨몸이면 칸은 두고 값만 비워주세요' }] };
  }

  const out = [];
  const bad = [];
  for (let r = 1; r < rows.length; r++) {
    const line = r + 1;                     // 사람이 보는 줄 수 (머리글이 1줄)
    const cells = rows[r];
    // **엑셀이 바꿔 쓴 날짜를 되읽는다** (위 `normalizeDay` 머리글)
    const date = normalizeDay(cells[iDate] || '');
    // **저장하는 쪽과 같은 자로** 다듬는다 (2026-10-22).
    // 여태 여기서는 「비었나」만 봤고, 가져오는 라우트가 뒤에서 `cleanName` 을 불러
    // **`null` 이 되면 그대로 넣었다** — `<<<>>>` 처럼 새니타이즈하면 아무것도 안
    // 남는 이름이 그렇다. 손으로 적는 길은 같은 값을 400 으로 막는다
    // **조용히 잘리지 않는다** (2026-11-17) — 꺾쇠 뒤에 글자가 붙은 이름은 그 뒤가
    // 통째로 사라진다(`utils/sanitize.js` 의 `tagLike`). 파일로 들어오는 길도 같은
    // 선이다: 그 줄만 거절하고 **몇째 줄이 왜 걸렸는지** 적는다(나머지는 들어간다)
    if (tagLike(cells[iName])) { bad.push({ line, why: ANGLE_WHY }); continue; }
    const exercise = cleanExerciseName(cells[iName]);
    const sets = num(iSets >= 0 ? cells[iSets] : '');
    const reps = num(iReps >= 0 ? cells[iReps] : '');
    // 무게 칸은 자유 입력이다 — '60' · '20kg' · '맨몸' · '밴드' 가 다 들어온다.
    // 비어 있으면 맨몸으로 본다 (화면이 그렇게 저장한다)
    // 무게도 같은 자다. **음수를 막는 것이 여기 없었다** — 저장하는 쪽은 400 을
    // 주는데 파일로는 `-50` 이 그대로 들어왔다. 볼륨을 세는 쪽이 부호를 못 본다
    // 위에서 `iWeight < 0` 을 막았으므로 여기 삼항은 없다 — 열은 반드시 있다
    const w = normalizeWeight(cells[iWeight]);

    if (!isRecordDay(date)) {
      bad.push({ line, why: `날짜가 이상해요 (${date || '빈 칸'}) — 2026-11-03 처럼 적어주세요` });
      continue;
    }
    if (!exercise) { bad.push({ line, why: '운동명이 비어 있어요' }); continue; }
    if (!w.ok) { bad.push({ line, why: w.why }); continue; }

    // ── 유산소 줄인가 ── (2026-11-05)
    //
    // 시간이나 거리가 적혀 있으면 유산소 줄이고, 그때는 **세트 · 횟수를 묻지 않는다.**
    // 안 그러면 내보낸 유산소 줄을 **우리 손으로 거절한다** — 세트 칸이 비어 있으니까
    const c = normalizeCardio(
      iMin >= 0 ? (cells[iMin] || '') : '',
      iKm >= 0 ? (cells[iKm] || '') : '',
    );
    if (!c.ok) { bad.push({ line, why: c.why }); continue; }
    if (!c.cardio) {
      if (!Number.isInteger(sets) || !Number.isInteger(reps) || sets < 1 || reps < 1) {
        bad.push({ line, why: '세트와 횟수는 1 이상의 정수여야 해요' });
        continue;
      }
      if (sets > 100 || reps > 1000) { bad.push({ line, why: '세트나 횟수가 너무 커요' }); continue; }
    }

    // **아는 말만 받는다.** 모르는 글자가 들어오면 화면이 못 그리는 딱지가 생긴다.
    // **없으면 칸을 안 만든다** — 옛 파일에서 읽은 줄과 모양이 같아야 한다
    // (db 가 `link` 를 그렇게 저장하는 것과 같은 결이다)
    const linkRaw = (iLink >= 0 ? (cells[iLink] || '') : '').trim();
    const link = linkRaw === '드롭' || linkRaw === 'drop' ? 'drop'
      : linkRaw === '슈퍼' || linkRaw === 'super' ? 'super' : null;

    // 메모 · 여유 — **손으로 적는 길과 같은 자**(`utils/workoutFields.js`). 걸리면 그 줄만 거절
    const n = normalizeNote(iNote >= 0 ? (cells[iNote] || '') : '');
    if (!n.ok) { bad.push({ line, why: n.why }); continue; }
    const rr = normalizeRir(iRir >= 0 ? (cells[iRir] || '') : '');
    if (!rr.ok) { bad.push({ line, why: rr.why }); continue; }

    // 오른쪽 칸 — **손으로 적는 길과 같은 자**(`utils/workoutFields.js`).
    // 유산소 줄에는 담지 않으므로 그 줄에서 값이 오면 **그 줄만 거절**한다
    const wrc = normalizeSideWeight(iWeightR >= 0 ? (cells[iWeightR] || '') : '', w.value, c.cardio);
    if (!wrc.ok) { bad.push({ line, why: wrc.why }); continue; }
    const rrc = normalizeSideReps(iRepsR >= 0 ? (cells[iRepsR] || '') : '', c.cardio ? null : reps, c.cardio);
    if (!rrc.ok) { bad.push({ line, why: rrc.why }); continue; }

    const weight = w.value;
    // 유산소 줄은 **세트 · 횟수를 담지 않는다** (지어낸 「1세트 1회」가 그 거짓이다)
    const row = c.cardio
      ? { date, exercise, weight, sets: null, reps: null, minutes: c.minutes, distanceKm: c.distanceKm }
      : { date, exercise, weight, sets, reps };
    // 없으면 칸을 안 만든다 — 옛 파일에서 읽은 줄과 모양이 같아야 한다
    if (link) row.link = link;
    if (n.value) row.note = n.value;
    if (rr.value) row.rir = rr.value;
    // 2026-11-19 — 좌우가 다를 때만 담긴다 (자가 같으면 `null` 을 준다)
    if (wrc.value != null) row.weight_r = wrc.value;
    if (rrc.value != null) row.reps_r = rrc.value;
    out.push(row);
  }
  return { rows: out, bad };
}

/** 인바디 CSV → 넣을 줄. 체중만 있으면 받는다 (화면도 그렇다) */
function readInbody(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return { rows: [], bad: [{ line: 1, why: '빈 파일이에요' }] };

  const header = rows[0];
  const C = COLS.inbody;
  const iDate = at(header, C[0], 'date');
  const iH = at(header, C[1], '키', 'height');
  const iW = at(header, C[2], '체중', 'weight');
  const iF = at(header, C[3], '체지방률', 'fat_pct');
  const iM = at(header, C[4], '골격근량', 'muscle_kg');
  const iL = at(header, C[5], '체수분', 'water_l');
  if (iDate < 0 || iW < 0) {
    return { rows: [], bad: [{ line: 1, why: '「날짜」와 「체중(kg)」 칸이 있어야 해요' }] };
  }

  // 화면·서버가 쓰는 것과 **진짜로 같은** 테두리 — `utils/inbodyRange.js` 한 자리에서
  // 온다. 여태 이 줄이 그 말을 적어두고 **체지방률만 100 으로 느슨했다**(화면은 60) —
  // 파일로 넣는 길만 61~100 을 통과시키고 있었다 (2026-10-28)
  const { RANGE } = require('./inbodyRange');
  // **거절하는 말에 영어 칸 이름이 나가고 있었다** (2026-10-28) —
  // 「fat_pct 값이 범위를 벗어났어요」. 파일을 넣은 사람이 읽는 글이고, 그 사람은
  // 제 파일에 **「체지방률(%)」**이라고 적어 보냈다. 몇 줄이 왜 빠졌는지 알려주는
  // 자리에서 모르는 낱말을 쓰면 고칠 수가 없다. 테두리와 함께 **이름도 한 자리**에 둔다
  const LABEL = {
    height: '키(cm)', weight: '체중(kg)', fat_pct: '체지방률(%)',
    muscle_kg: '골격근량(kg)', water_l: '체수분(L)',
  };
  const pick = (cells, i, key, bad, line) => {
    if (i < 0) return null;
    const n = num(cells[i]);
    const name = LABEL[key] || key;
    if (n == null) return null;
    if (Number.isNaN(n)) { bad.push({ line, why: `${name} 칸이 숫자가 아니에요` }); return undefined; }
    const [lo, hi] = RANGE[key];
    if (n < lo || n > hi) {
      // **조사를 붙이지 않는다** — 이름이 괄호로 끝난다(「체지방률(%)」).
      // 「…(%) 는」처럼 적으면 조사가 어긋나는데, 이 앱은 조사를 자리마다 맞추는
      // 자리가 따로 있다(`data/particle.js`). 여기서는 **조사가 필요 없는 꼴**로 적는다
      bad.push({ line, why: `${name} — ${lo}~${hi} 사이로 적어주세요 (${n} 이라고 적혀 있어요)` });
      return undefined;
    }
    return n;
  };

  const out = [];
  const bad = [];
  for (let r = 1; r < rows.length; r++) {
    const line = r + 1;
    const cells = rows[r];
    // **엑셀이 바꿔 쓴 날짜를 되읽는다** (위 `normalizeDay` 머리글)
    const date = normalizeDay(cells[iDate] || '');
    if (!isRecordDay(date)) {
      bad.push({ line, why: `날짜가 이상해요 (${date || '빈 칸'}) — 2026-11-03 처럼 적어주세요` });
      continue;
    }

    const before = bad.length;
    const weight = pick(cells, iW, 'weight', bad, line);
    const height = pick(cells, iH, 'height', bad, line);
    const fat_pct = pick(cells, iF, 'fat_pct', bad, line);
    const muscle_kg = pick(cells, iM, 'muscle_kg', bad, line);
    const water_l = pick(cells, iL, 'water_l', bad, line);
    if (bad.length > before) continue;                     // 이 줄에서 하나라도 걸렸다
    if (weight == null) { bad.push({ line, why: '체중이 비어 있어요' }); continue; }

    // BMI 는 **다시 센다.** 파일에 적힌 값을 믿으면 키를 고쳐 넣은 파일에서 어긋난다
    const bmi = height ? +(weight / ((height / 100) ** 2)).toFixed(1) : null;
    out.push({ date, height, weight, fat_pct, muscle_kg, water_l, bmi });
  }
  return { rows: out, bad };
}

/**
 * 측정 CSV → 넣을 줄.
 *
 * 내보내기는 **한 줄에 한 항목**으로 길게 편다 (`날짜,종류,항목,값`) — 종류마다 칸이
 * 달라서 넓은 표로 만들면 빈 칸이 대부분인 서른 열짜리가 된다.
 * 그래서 되읽을 때 **(날짜 · 종류)로 다시 묶는다.**
 */
function readMeasures(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return { rows: [], bad: [{ line: 1, why: '빈 파일이에요' }] };

  const header = rows[0];
  const C = COLS.measures;
  const iDate = at(header, C[0], 'date');
  const iType = at(header, C[1], 'type');
  const iNo = at(header, C[2], 'no');
  const iField = at(header, C[3], 'field');
  const iValue = at(header, C[4], 'value');
  if (iDate < 0 || iType < 0 || iField < 0 || iValue < 0) {
    return { rows: [], bad: [{ line: 1, why: '「날짜 · 종류 · 항목 · 값」 칸이 있어야 해요' }] };
  }

  const bag = new Map();     // `날짜|종류|번호` → { date, type, data }
  const firstLine = new Map(); // 같은 열쇠 → 그 기록이 **처음 나온 줄 번호**
  // 「번호」가 없는 옛 파일을 위해, 그 자리(날짜|종류)에서 지금 몇 번째를 쌓고 있는지 기억한다
  const runNo = new Map();
  const bad = [];
  for (let r = 1; r < rows.length; r++) {
    const line = r + 1;
    const cells = rows[r];
    // **엑셀이 바꿔 쓴 날짜를 되읽는다** (위 `normalizeDay` 머리글)
    const date = normalizeDay(cells[iDate] || '');
    const label = cells[iType] || '';
    const field = cells[iField] || '';
    const raw = cells[iValue] || '';

    if (!isRecordDay(date)) {
      bad.push({ line, why: `날짜가 이상해요 (${date || '빈 칸'}) — 2026-11-03 처럼 적어주세요` });
      continue;
    }
    // **모르는 종류는 지어내지 않는다.** 이름표에 없으면 그 줄만 건너뛴다
    const type = MEASURE_TYPE_OF[label] || (Object.values(MEASURE_TYPE_OF).includes(label) ? label : null);
    if (!type) { bad.push({ line, why: `모르는 종류예요 (${label || '빈 칸'})` }); continue; }
    const key = FIELD_KEY_OF[field] || field;
    if (!key) { bad.push({ line, why: '항목이 비어 있어요' }); continue; }
    if (raw === '') continue;                              // 빈 값은 원래 안 내보낸다

    // 숫자로 적힌 것은 숫자로 되돌린다 — 글자로 넣으면 그래프가 못 읽는다.
    // `JSON` 으로 내보낸 것(랩 목록)은 되돌려 놓는다
    let value = raw;
    if (/^[[{]/.test(raw)) {
      try { value = JSON.parse(raw); } catch { value = raw; }
    } else if (raw !== '' && !Number.isNaN(Number(raw))) {
      value = Number(raw);
    }

    // ── 같은 날 같은 종류가 여러 줄일 수 있다 ── (2026-09-18 에 고쳤다)
    //
    // 아침·저녁 둘레, 스톱워치 두 판. 여태 (날짜 · 종류)로만 묶어서 그 둘이
    // **있지도 않던 한 줄로 합쳐졌다** — 가슴은 아침 것, 허리는 저녁 것.
    // 지우는 것보다 나쁘다(없던 값을 만들어낸다).
    //
    // 내보내기가 「번호」를 같이 적으므로 그것으로 가른다. **옛 파일에는 그 칸이 없다** —
    // 그때는 **같은 항목이 다시 나오면 다음 줄로 본다**. 한 줄에 같은 항목이 두 번
    // 나올 일은 없으니, 다시 나온 것은 다음 줄이라는 뜻이다
    const slot = `${date}|${type}`;
    let no;
    if (iNo >= 0 && String(cells[iNo] || '').trim() !== '') {
      const n = Number(cells[iNo]);
      no = Number.isInteger(n) && n > 0 ? n : 1;
    } else {
      no = runNo.get(slot) || 1;
      const holder = bag.get(`${slot}|${no}`);
      // 그 줄에 이 항목이 이미 있으면 다음 줄로 넘긴다
      if (holder && Object.prototype.hasOwnProperty.call(holder.data, key)) {
        no += 1;
        runNo.set(slot, no);
      } else {
        runNo.set(slot, no);
      }
    }

    const id = `${slot}|${no}`;
    // **그 줄이 몇째 줄이었는지 기억한다** — 여러 줄이 한 기록으로 묶이므로,
    // 테두리를 벗어났다고 말할 때 짚을 자리가 없으면 고칠 수가 없다.
    // 기록 자체에는 안 담는다(저장되는 모양이 달라진다)
    if (!bag.has(id)) { bag.set(id, { date, type, data: {} }); firstLine.set(id, line); }
    bag.get(id).data[key] = value;
  }

  // ── **말이 되는 범위인가** ── (2026-10-31)
  //
  // 여태 측정 줄은 **값의 범위를 아예 안 봤다.** 날짜와 종류만 보고 담았다 —
  // 10/28 에 인바디에서 고친 **「파일로 넣는 길만 다른 테두리를 쓰던」** 그 자리가
  // 여기에 그대로 남아 있었다. 테두리는 화면·서버와 **같은 한 자리**에서 온다.
  //
  // 한 칸이 테두리를 벗어나면 **그 줄만** 빼고 까닭을 적는다 — 파일 전체를
  // 물리면 멀쩡한 줄까지 사라진다 (인바디 쪽과 같은 결)
  const { checkMeasure } = require('./measureRange');
  const out = [];
  for (const [id, m] of bag) {
    if (Object.keys(m.data).length === 0) continue;
    const r = checkMeasure(m.type, m.data);
    if (!r.ok) { bad.push({ line: firstLine.get(id), why: r.why }); continue; }
    out.push(m);
  }
  return { rows: out, bad };
}


/** 이 줄이 이미 있는 것과 같은가 — **다시 넣어도 안 늘어나게** 하는 열쇠 */
// **유산소 줄도 가를 수 있어야 한다** (2026-11-05) — 세트 · 횟수가 둘 다 비어
// 있어서, 시간 · 거리를 열쇠에 안 넣으면 같은 날 30분과 60분이 **같은 줄**이 되어
// 뒤엣것이 「이미 있어서 건너뛰었어요」로 사라진다
// ── ★ **열쇠는 내보내는 열을 전부 본다** ── (2026-11-24 · 정석)
//
// 위 11/05 의 교훈이 유산소에서 멈춰 있었다. 같은 날 · 같은 운동 · 왼쪽이 같고
// **오른쪽만 다른** 두 줄(원팔 로우 오른쪽 18 ↔ 22.5)은 열쇠가 같아서, 다시 넣을 때
// 뒤엣것이 **「이미 있어서 건너뛰었어요」로 사라졌다.** 메모만 다른 두 줄도 같다 —
// 띄워서 재 보니 **네 줄이 두 줄**이 됐다(`added 2 · skipped 2`).
//
// 열쇠에 안 든 열은 **그 열만 다른 줄을 뭉갠다.** 그래서 한 열을 더할 때마다 여기도
// 더하는 것이 아니라, **내보내는 열 전부**(`COLS.workouts` 열두 개)를 본다 —
// 날짜 · 운동명 · 무게 · 세트 · 횟수 · 묶음 · 시간 · 거리 · 메모 · 여유 · 오른쪽 둘.
// 그러면 열이 늘어도 이 자리는 **이미 그 열을 본다.**
//
// 이름이 두 꼴로 온다 — 파일에서 읽은 줄은 `distanceKm`, DB 줄은 `distance_km` 다.
// 둘 다 받는다(아래 `??`). **같은 줄이 두 꼴로 보이면 열쇠가 갈려 겹침이 안 걸린다.**
const workoutKey = (w) => [w.date, String(w.exercise).trim(), String(w.weight).trim(),
  w.sets, w.reps, w.link ?? '', w.minutes ?? '', w.distanceKm ?? w.distance_km ?? '',
  w.note ?? '', w.rir ?? '', w.weightR ?? w.weight_r ?? '', w.repsR ?? w.reps_r ?? ''].join('|');
const inbodyKey = (r) => [r.date, r.weight, r.height ?? '', r.fat_pct ?? '', r.muscle_kg ?? '', r.water_l ?? ''].join('|');
/**
 * 측정 열쇠 — **값까지 본다** (2026-09-18 에 고쳤다).
 *
 * 처음에는 (날짜 · 종류)만 봤다. 그러면 같은 날 같은 종류를 두 번 잰 사람의 둘째 줄이
 * 「이미 있다」로 건너뛰어져 **되돌릴 때 사라진다.** 값이 다르면 다른 줄이다.
 *
 * 값이 **똑같은** 두 줄은 가를 방법이 없다(파일에 그 이상이 안 적혀 있다) —
 * 그때는 하나로 본다. 같은 값을 두 번 적어둔 것을 하나로 만드는 쪽이,
 * 같은 파일을 두 번 넣을 때마다 줄이 불어나는 것보다 낫다.
 */
//
// ── ★ **파일이 되돌려 주는 꼴로 맞춰 본다** ── (2026-11-25 · 근호)
//
// 담긴 줄과 파일에서 읽은 줄이 **같은 측정인데 지문이 달랐다** — 셋이 어긋났다:
//
//   · `date` — 치수 화면은 `{ ...values, date }` 로 보내서 `data` 안에 날짜가 들어 있다.
//     내보내기(`routes/export.js`)는 첫 칸에 있다고 **그 열쇠를 빼고** 쓴다
//   · 빈 값 — 내보내기는 `null` · `''` 을 안 쓴다. 담긴 줄에는 남아 있을 수 있다
//   · 글자 숫자 — 칸에서 온 `"100"` 이 담기고, 읽는 손(`readMeasures`)은 `100` 으로 되돌린다
//
// 그래서 같은 측정 CSV 를 다시 넣으면 **매번 `skipped 0` 으로 두 벌**이 됐다.
// 지문을 **파일이 되돌려 주는 꼴**로 만든다 — 내보내기가 빼는 것은 빼고, 읽는 손이
// 바꾸는 것은 같은 자로 바꾼다. 그러면 담긴 줄과 파일 줄이 같은 지문이 된다
const measureValue = (v) => {
  if (typeof v !== 'string') return v;
  if (/^[[{]/.test(v)) { try { return JSON.parse(v); } catch { return v; } }
  return v !== '' && !Number.isNaN(Number(v)) ? Number(v) : v;
};
const measureKey = (m) => {
  const data = m.data && typeof m.data === 'object' ? m.data : {};
  // 열쇠의 차례가 달라도 같은 지문이 나오게 정렬한다
  const print = Object.keys(data).sort()
    .filter((k) => k !== 'date' && data[k] !== null && data[k] !== undefined && data[k] !== '')
    .map((k) => `${k}=${JSON.stringify(measureValue(data[k]))}`).join(',');
  return `${m.date}|${m.type}|${print}`;
};

module.exports = {
  parseCsv, readWorkouts, readInbody, readMeasures,
  workoutKey, inbodyKey, measureKey,
  // 내보내기가 머리줄을 짓는 데 쓴다 — 이름은 **한 자리**에만 있다 (2026-11-17)
  COLS, headerOf,
};
