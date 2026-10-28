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

module.exports = function tidyAtExit(TMP) {
  const files = [TMP, String(TMP).replace(/\.json$/, '.photos.json')];
  const rm = () => {
    for (const f of files) {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch { /* 지우지 못해도 검사를 깨지 않는다 */ }
    }
  };
  rm();                       // 지난 판이 남겨둔 것 (검사는 **빈 DB 로** 시작해야 한다)
  process.on('exit', rm);     // db.js 의 손보다 **뒤에** 돈다 — 되살린 것을 지운다
  return rm;
};
