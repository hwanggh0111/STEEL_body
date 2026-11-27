// **임시 DB 를 나가는 길에 치운다** (2026-10-28).
//
//   const TMP = path.join(__dirname, '..', '.check-나.json');
//   process.env.DB_FILE = TMP;
//   const db = require('../src/db');        // ← 이 줄 **뒤에** 부른다
//   require('./_tmpdb.cjs')(TMP);
//
// ── 왜 ──
//
// 검사들이 끝에서 `fs.unlinkSync(TMP)` 로 제 임시 DB 를 지우는데도 **파일이
// 남아 있었다** (10/27 전체 검사 뒤에 넷). 지우는 쪽은 멀쩡했다 — 다시 만든 것은
// **나가는 쪽**이다: `db.js` 가 `process.on('exit')` 에서 `_flushImmediate()` ·
// `_flushPhotosSync()` 를 돌려, 안 쓴 것이 남아 있으면 **지운 파일을 되살린다.**
//
// 자리마다 「지우기 전에 flushNow 를 부른다」로 고칠 수도 있지만, 그러면 **새 검사를
// 쓰는 사람이 그것을 기억해야 한다**(10/27 에 사진 쪽에서 똑같이 잊었다).
// 그래서 **차례**로 푼다 — 나가는 자리의 손은 **등록한 순서대로** 돈다.
// `db.js` 를 require 한 뒤에 걸면, db 가 되살린 것을 **그 다음에 지운다.**
const fs = require('fs');

/**
 * ── ★ **이미 깔아둔 판은 두는 길** ── (2026-11-27 · 정석)
 *
 * 들어올 때 거는 비질이 **검사가 미리 깔아둔 판을 지우는 자리**가 있다 —
 * `check-rate` 는 관리자 계정 하나를 `DB_FILE` 에 써 두고 `aiGuard`(→ `db.js`) 를
 * 들인다. 그런데 손은 **`db.js` 보다 뒤에** 걸려야 하므로(아래 까닭) 그 뒤로
 * 밀면 **깔아둔 판이 그 자리에서 지워진다**(11/27 에 그렇게 2건이 빨개졌다).
 *
 * 그래서 `{ 판은두기: true }` 를 주면 **본 판은 건드리지 않고** 지난 판이 남긴
 * 찌꺼기(`.writing` · `.writing.sync`)만 걷는다 — 그 둘은 **어느 경우에도
 * 원하는 것이 아니다.** 나가는 길의 비질은 그대로 네 꼴 전부다.
 */
module.exports = function tidyAtExit(TMP, opts = {}) {
  const main = [TMP, String(TMP).replace(/\.json$/, '.photos.json')];
  // **쓰다 만 임시 파일도 치운다** (2026-11-24). 검사가 중간에 죽으면 `.writing` 이
  // 남는데 아무도 안 지웠다 — 11/24 에 트리에 둘이 남아 있었다
  // (`.check-order.json.writing` · `.check-tag.json.writing`). 남은 임시 파일은
  // 다음 쓰기가 덮어 쓸 뿐이지만, **지워진 줄 알고 보는 사람에게는 거짓 자취**다
  const files = [...main, ...main.map((f) => f + '.writing'), ...main.map((f) => f + '.writing.sync')];
  const rm = () => {
    for (const f of files) {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch { /* 지우지 못해도 검사를 깨지 않는다 */ }
    }
  };
  if (opts.판은두기) {
    // 찌꺼기만 걷는다 — 깔아둔 판은 그대로 둔다
    for (const f of files.filter((x) => /\.writing(\.sync)?$/.test(x))) {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch { /* 못 지워도 검사를 깨지 않는다 */ }
    }
  } else {
    rm();                     // 지난 판이 남겨둔 것 (검사는 **빈 DB 로** 시작해야 한다)
  }
  process.on('exit', rm);     // db.js 의 손보다 **뒤에** 돈다 — 되살린 것을 지운다
  return rm;
};
