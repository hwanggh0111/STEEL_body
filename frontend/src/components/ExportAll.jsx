// **내 기록 전부 받기** (2026-11-19 · 맵시 · 시안 ⑥)
//
// ── 왜 ──
//
// 받을 수 있는 것이 **셋**이었다 — 운동 기록 · 인바디 · 측정(`data/exportCsv.js`).
// 메모 · 내 루틴 · 기구 세팅 · 사진은 **받을 길이 아예 없었다.** 통째로 뜨는 길은
// 있지만(`/export/backup`) 그것은 관리자 것이고 남의 기록까지 담는다.
//
// 이 칸이 필요한 자리는 **계정을 지우기 전**이다. 지우면 30일 유예 뒤에 사라지니
// (8/31 주인 결정 · `AccountDeleteModal` 이 「기록 화면에서 내려받기」로 안내한다)
// 그 전에 **전부** 받아둘 길이 있어야 한다. 셋만 받고 지우면 메모와 루틴은 사라진다.
//
// ── 무엇이 담기는지 보여주고 누르게 한다 ──
//
// 「전부 받기」 한 단추로 두면 **무엇이 담겼는지 받아 본 뒤에야** 안다. 그래서 목록을
// 펼쳐 두고 고르게 한다 — 설정 화면의 원칙이 **「접지 않고 숨기지 않는다」**라서
// (`SettingsPage` 의 `Group` 머리글) 아코디언으로 접지 않는다.
//
// ── 묶음을 **둘로 가른다** ── (2026-11-19 · 좁은 폭을 재고 고쳤다)
//
// 처음에는 일곱을 한 줄씩 늘어놓고 줄마다 꼬리표(「여태 받을 길이 없었어요」)를
// 붙였다. **320px 폰에서 그 꼬리표가 이름을 밀어낸다** — 이름 98px + 꼬리표 142px
// 이면 쓸 수 있는 223px 을 넘고, 꼬리표가 `flexShrink: 0` 이라 **이름이 잘린다**
// (「메모 · 그날…」). 무엇을 받는지가 이름인데 설명 때문에 그 이름이 깎이는 꼴이다.
//
// 그래서 **시안대로 묶음을 둘로** 둔다 — 「지금 받을 수 있는 것」과 「받을 길이 없던
// 것」. 설명이 **묶음 제목 한 줄로 올라가니** 줄마다 적을 것이 없어지고, 꼬리표는
// 「CSV」·「새로」처럼 짧은 것만 남아 320 에서도 안 겹친다.
//
// ── **몇 장인지 모른 채 켜게 두지 않는다** ── (2026-11-20 · 맵시 · 벼림 요청)
//
// 11/20 에 벼림이 **「사진」을 켜고 받으면 0장이 나가던 것**을 고쳤다(사진은
// `photos.json` 에 따로 산다). 그 버그가 무서운 까닭은 **사람이 그것을 백업으로
// 믿고 계정을 지우는** 자리이기 때문이다 — 그리고 이 화면은 **담기는 수를 한 번도
// 보여주지 않고 있었다.** 서버는 이제 `parts` 없이 부르면 목록과 줄 수를 준다.
//
// 그래서 **수를 적는다.** 적지 않는 쪽도 생각했지만(한 줄이 길어진다) 이 카드의
// 본일이 「받아 보고서야 무엇이 담겼는지 아는 것」을 막는 데 있고, **수는 그 본일의
// 일부**다. 「사진 0장」이 보이면 그 사람은 지우기 전에 멈춘다.
//
// ★ **없으면 지금과 똑같다.** 미리 보기를 못 받아도(로그인 끊김 · 신호 없음) 카드는
// 그대로 돌아가고 수 자리만 빈다. 설정 화면 길목에 **막는 것을 두지 않는다.**
//
// ── **담지 않는 것도 적는다** ──
//
// 서버는 일부러 빼는 둘(로그인 유지 열쇠 · 알림 기기 주소)에 **까닭**을 달아 준다.
// 받는 묶음 안에도 그 줄이 들어 있지만(`exportAll.js` 의 `설명:`), 그것은 **받은
// 뒤에** 읽는 글이다. 지우기 전에 받는 자리에서는 **누르기 전에** 보여야 한다.
// 서버가 주는 글을 **그대로 적는다** — 내가 다시 쓰면 한쪽만 고쳐지는 날이 온다.

// **사진만 기본으로 꺼져 있다.** 한 장이 수십~수백 KB 이고 여러 해 쌓이면 묶음이
// 수십 MB 가 된다 — 폰에서 받다 끊기면 **왜 끊겼는지 알 수 없다.** 그래서 고른
// 사람만 담는다. 「무겁습니다」를 그 줄에 적어 둔다.

import { useEffect, useState } from 'react';
import { exportAll, 받을것미리본다 } from '../data/exportCsv';
import { toast } from './Toast';

// 담을 것 — **이름과 열쇠를 한 자리에 둔다.** 서버가 받는 열쇠(`parts=`)와 화면에
// 적는 이름이 갈리면, 한쪽을 고치는 날 **빠진 줄을 아무도 모른다**
// (서버 쪽 짝은 `backend/src/routes/exportAll.js`)
//
// `tag` 는 **짧은 것만** 적는다 — 긴 설명은 묶음 제목이 맡는다(위 머리글의 그 까닭)
export const PARTS = [
  { key: 'workouts', group: 'now', name: '운동 기록', tag: 'CSV', on: true },
  { key: 'inbody', group: 'now', name: '인바디', tag: 'CSV', on: true },
  { key: 'measures', group: 'now', name: '측정 기록', tag: 'CSV', on: true },
  { key: 'notes', group: 'new', name: '메모 · 그날 메모', tag: '새로', on: true },
  { key: 'routines', group: 'new', name: '내 루틴', tag: '새로', on: true },
  { key: 'gym', group: 'new', name: '기구 세팅', tag: '새로', on: true },
  // 기본으로 꺼두는 **유일한 줄**이다 — 위 머리글의 그 까닭
  { key: 'photos', group: 'new', name: '사진', tag: '무겁습니다', on: false },
];

const 묶음이름 = {
  now: '지금 받을 수 있는 것',
  new: '받을 길이 없던 것',
};

export default function ExportAll() {
  const [pick, setPick] = useState(() => {
    const o = {};
    for (const p of PARTS) o[p.key] = p.on;
    return o;
  });
  const [busy, setBusy] = useState(false);
  // 무엇이 얼마나 담기는지 — 못 받으면 `null` 이고 그러면 수 자리가 빈다
  const [미리, set미리] = useState(null);
  useEffect(() => {
    let 살아있다 = true;
    받을것미리본다().then((r) => { if (살아있다) set미리(r); });
    return () => { 살아있다 = false; };
  }, []);
  // 열쇠 → 줄 수. 서버가 **안 준 열쇠는 안 적는다**(0 으로 적으면 거짓이 된다)
  const 줄수 = {};
  for (const r of (미리 && 미리.담기는것) || []) if (Number.isFinite(r['줄'])) 줄수[r['열쇠']] = r['줄'];

  const 고른것 = PARTS.filter((p) => pick[p.key]).map((p) => p.key);
  const 사진담김 = pick.photos;

  const 받기 = () => {
    if (!고른것.length || busy) return;
    setBusy(true);
    exportAll(고른것)
      .then((name) => toast(`${name} 으로 받았어요`, 'success'))
      // **무엇이 안 됐는지 말한다.** 「받지 못했어요」만 뜨면 다시 눌러야 할지
      // 기다려야 할지 알 수 없다 — 사진을 담았을 때는 그 줄을 같이 적는다
      .catch(() => toast(
        사진담김
          ? '받지 못했어요. 사진을 빼고 다시 해보세요 (묶음이 너무 클 수 있어요)'
          : '받지 못했어요. 잠시 뒤 다시 해보세요',
        'error',
      ))
      .finally(() => setBusy(false));
  };

  const 줄 = (p) => (
    <label
      key={p.key}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
        padding: '7px 0', fontSize: 13, color: 'var(--text-secondary)',
        // ── **글자를 키우면 꼬리표가 이름을 깎는다** ── (2026-11-20 · 맵시)
        //
        // 11/19 에 320px 에서 이름이 깎이던 것을 묶음 둘로 갈라 고쳤다. 거기에
        // 수를 더하니 같은 자리가 **글자 200% 에서 다시** 좁아진다 — 수 + 꼬리표가
        // 11px 에서 89px 이고 22px 에서는 179px 인데, 이름과 꼬리표가 나눠 쓸 폭이
        // 320px 폰에서 223px 이다. 꼬리표는 `flexShrink: 0` 이라 **이름이 깎인다.**
        //
        // 깎이면 안 되는 쪽이 **이름**이다(무엇을 받는지가 이름이다). 그래서 모자랄
        // 때는 꼬리표가 **아래 줄로 내려간다** — 폭을 숫자로 가르지 않고 브라우저가
        // 재게 한다(11/19 의 D안과 같은 손). 기본 크기에서는 한 줄 그대로다
        flexWrap: 'wrap',
      }}
    >
      <input
        type="checkbox"
        checked={!!pick[p.key]}
        onChange={(e) => setPick((v) => ({ ...v, [p.key]: e.target.checked }))}
        style={{ accentColor: 'var(--accent)', flexShrink: 0 }}
      />
      {/* 이름이 길어지는 날 꼬리표를 밀어내지 않게 — `minWidth: 0` 이 말줄임의 짝이다 */}
      <span style={{
        minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{p.name}</span>
      {/* 수와 꼬리표. **수가 먼저**다 — 고를지 말지를 가르는 것이 수다.
          320px 폭은 11/19 에 재뒀다(이름+꼬리표에 223px). 「1,204줄」이 11px 로
          ~44px 이고 사진은 「128장」이라 꼬리표를 합쳐도 그 안에 든다.
          서버가 수를 안 줬으면 **이 조각이 아예 안 그려진다** */}
      <span style={{
        marginLeft: 'auto', flexShrink: 0, fontSize: 11,
        display: 'flex', alignItems: 'baseline', gap: 6,
      }}>
        {줄수[p.key] != null && (
          <span style={{ color: 줄수[p.key] === 0 ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
            {줄수[p.key].toLocaleString('ko-KR')}{p.key === 'photos' ? '장' : '줄'}
          </span>
        )}
        <span style={{ color: p.key === 'photos' ? 'var(--warning)' : 'var(--text-muted)' }}>{p.tag}</span>
      </span>
    </label>
  );

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 11, marginTop: 2 }}>
      <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>
        내 기록 전부 받기
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 10 }}>
        고른 것을 <b style={{ color: 'var(--text-secondary)' }}>한 묶음</b>으로 받습니다.
        계정을 지우기 전에 받아두세요 — 지우면 30일 뒤에 사라집니다.
      </div>

      {/* 묶음마다 이름을 낭독기에도 알린다 — 체크 일곱이 무엇의 목록인지 안 들리면
          「운동 기록, 체크 상자」만 읽힌다 */}
      {['now', 'new'].map((g) => (
        <div key={g} role="group" aria-label={묶음이름[g]} style={{ marginBottom: 6 }}>
          <div style={{
            fontFamily: "'Bebas Neue', 'BI Sans KR', sans-serif", fontSize: 11, letterSpacing: 1.4,
            color: 'var(--text-muted)', paddingTop: 6,
          }}>{묶음이름[g]}</div>
          {PARTS.filter((p) => p.group === g).map(줄)}
        </div>
      ))}

      {/* ── 담지 않는 것 ── 서버가 준 까닭을 **그대로** 적는다 (위 머리글).
          못 받았으면 이 묶음이 안 그려진다 — 지금까지와 같다 */}
      {미리 && (미리['안담는것'] || []).length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
          <div style={{
            fontFamily: "'Bebas Neue', 'BI Sans KR', sans-serif", fontSize: 11, letterSpacing: 1.4,
            color: 'var(--text-muted)', marginBottom: 4,
          }}>담지 않는 것</div>
          {미리['안담는것'].map((x) => (
            <div key={x['갈래']} style={{
              fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 2,
            }}>{x['까닭']}</div>
          ))}
        </div>
      )}

      <button
        onClick={받기}
        disabled={busy || !고른것.length}
        className="btn-primary"
        // 흐려지는 꼴은 `.btn-primary:disabled` 가 이미 갖고 있다 — 인라인으로
        // 또 적으면 단추 꼴이 두 벌이 된다 (globals.css:276)
        style={{ width: '100%', marginTop: 8 }}
      >
        {busy ? '묶는 중…' : `한 묶음으로 받기 (${고른것.length}가지)`}
      </button>
      {/* **하나도 안 고르면 왜 안 눌리는지 말한다** — 흐려진 단추만 두면
          고장 난 것으로 읽힌다 */}
      {!고른것.length && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
          담을 것을 하나 이상 골라주세요.
        </div>
      )}
      {사진담김 && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.7 }}>
          사진이 들어가면 묶음이 커서 <b style={{ color: 'var(--text-secondary)' }}>시간이 걸립니다</b> —
          와이파이에서 받으시는 게 좋아요.
        </div>
      )}
    </div>
  );
}
