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
const { isRecordDay } = require('./dayRange');

/**
 * CSV 한 장을 줄과 칸으로 쪼갠다.
 *
 * 우리가 내보낸 것을 되읽는 것이 본디 일이라 규칙은 내보내기와 짝이다 —
 *   · 맨 앞의 BOM(`﻿`)을 걷는다. 한글 엑셀을 위해 우리가 붙인 것이다
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
    .map((r) => r.map((v) => v.trim()))
    .filter((r) => r.some((v) => v !== ''));
}

// 엑셀에서 열을 지우거나 순서를 바꿔놓고 넣는 사람이 있다. **머리글을 보고 자리를 찾는다** —
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
  const iDate = at(header, '날짜', 'date');
  const iName = at(header, '운동명', '운동', 'exercise');
  const iWeight = at(header, '무게', 'weight');
  const iSets = at(header, '세트', 'sets');
  const iReps = at(header, '횟수', 'reps');
  if (iDate < 0 || iName < 0) {
    return { rows: [], bad: [{ line: 1, why: '「날짜」와 「운동명」 칸이 있어야 해요' }] };
  }

  const out = [];
  const bad = [];
  for (let r = 1; r < rows.length; r++) {
    const line = r + 1;                     // 사람이 보는 줄 수 (머리글이 1줄)
    const cells = rows[r];
    const date = cells[iDate] || '';
    const exercise = (cells[iName] || '').slice(0, 100).trim();
    const sets = num(iSets >= 0 ? cells[iSets] : '');
    const reps = num(iReps >= 0 ? cells[iReps] : '');
    // 무게 칸은 자유 입력이다 — '60' · '20kg' · '맨몸' · '밴드' 가 다 들어온다.
    // 비어 있으면 맨몸으로 본다 (화면이 그렇게 저장한다)
    const weight = (iWeight >= 0 ? (cells[iWeight] || '') : '').slice(0, 20).trim() || '맨몸';

    if (!isRecordDay(date)) { bad.push({ line, why: `날짜가 이상해요 (${date || '빈 칸'})` }); continue; }
    if (!exercise) { bad.push({ line, why: '운동명이 비어 있어요' }); continue; }
    if (!Number.isInteger(sets) || !Number.isInteger(reps) || sets < 1 || reps < 1) {
      bad.push({ line, why: '세트와 횟수는 1 이상의 정수여야 해요' });
      continue;
    }
    if (sets > 100 || reps > 1000) { bad.push({ line, why: '세트나 횟수가 너무 커요' }); continue; }

    out.push({ date, exercise, weight, sets, reps });
  }
  return { rows: out, bad };
}

/** 인바디 CSV → 넣을 줄. 체중만 있으면 받는다 (화면도 그렇다) */
function readInbody(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return { rows: [], bad: [{ line: 1, why: '빈 파일이에요' }] };

  const header = rows[0];
  const iDate = at(header, '날짜', 'date');
  const iH = at(header, '키(cm)', '키', 'height');
  const iW = at(header, '체중(kg)', '체중', 'weight');
  const iF = at(header, '체지방률(%)', '체지방률', 'fat_pct');
  const iM = at(header, '골격근량(kg)', '골격근량', 'muscle_kg');
  const iL = at(header, '체수분(L)', '체수분', 'water_l');
  if (iDate < 0 || iW < 0) {
    return { rows: [], bad: [{ line: 1, why: '「날짜」와 「체중(kg)」 칸이 있어야 해요' }] };
  }

  // 화면·서버가 쓰는 것과 같은 테두리. 여기서만 느슨하게 받으면 그래프가 망가진다
  const RANGE = { height: [1, 300], weight: [1, 500], fat_pct: [0, 100], muscle_kg: [0, 200], water_l: [0, 200] };
  const pick = (cells, i, key, bad, line) => {
    if (i < 0) return null;
    const n = num(cells[i]);
    if (n == null) return null;
    if (Number.isNaN(n)) { bad.push({ line, why: `${key} 칸이 숫자가 아니에요` }); return undefined; }
    const [lo, hi] = RANGE[key];
    if (n < lo || n > hi) { bad.push({ line, why: `${key} 값이 범위를 벗어났어요 (${n})` }); return undefined; }
    return n;
  };

  const out = [];
  const bad = [];
  for (let r = 1; r < rows.length; r++) {
    const line = r + 1;
    const cells = rows[r];
    const date = cells[iDate] || '';
    if (!isRecordDay(date)) { bad.push({ line, why: `날짜가 이상해요 (${date || '빈 칸'})` }); continue; }

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
  const iDate = at(header, '날짜', 'date');
  const iType = at(header, '종류', 'type');
  const iField = at(header, '항목', 'field');
  const iValue = at(header, '값', 'value');
  if (iDate < 0 || iType < 0 || iField < 0 || iValue < 0) {
    return { rows: [], bad: [{ line: 1, why: '「날짜 · 종류 · 항목 · 값」 칸이 있어야 해요' }] };
  }

  const bag = new Map();     // `날짜|종류` → { date, type, data }
  const bad = [];
  for (let r = 1; r < rows.length; r++) {
    const line = r + 1;
    const cells = rows[r];
    const date = cells[iDate] || '';
    const label = cells[iType] || '';
    const field = cells[iField] || '';
    const raw = cells[iValue] || '';

    if (!isRecordDay(date)) { bad.push({ line, why: `날짜가 이상해요 (${date || '빈 칸'})` }); continue; }
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

    const id = `${date}|${type}`;
    if (!bag.has(id)) bag.set(id, { date, type, data: {} });
    bag.get(id).data[key] = value;
  }

  const out = [...bag.values()].filter((m) => Object.keys(m.data).length > 0);
  return { rows: out, bad };
}

/** 이 줄이 이미 있는 것과 같은가 — **다시 넣어도 안 늘어나게** 하는 열쇠 */
const workoutKey = (w) => [w.date, String(w.exercise).trim(), String(w.weight).trim(), w.sets, w.reps].join('|');
const inbodyKey = (r) => [r.date, r.weight, r.height ?? '', r.fat_pct ?? '', r.muscle_kg ?? '', r.water_l ?? ''].join('|');
// 측정은 (날짜 · 종류) 하나에 한 줄이다 — 같은 날 같은 종류를 두 번 재는 일은 없다고 본다
const measureKey = (m) => `${m.date}|${m.type}`;

module.exports = {
  parseCsv, readWorkouts, readInbody, readMeasures,
  workoutKey, inbodyKey, measureKey,
};
