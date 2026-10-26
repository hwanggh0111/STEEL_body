// 서버가 보낸 글의 `**굵게**` 를 굵게 그린다 (2026-10-26).
//
// ── 왜 떼어냈나 ──
//
// 서버는 사람에게 가는 글에 `**…**` 로 강조를 적는다 — 정지 사유
// (`utils/abusePolicy.js` · `middleware/aiGuard.js` 의 `L4_NOTE`), 보안 규칙 설명
// (`routes/security.js` 의 policy) 이 그렇다.
//
// **그런데 그것을 그리는 자리가 관리자 화면 한 곳뿐이었다**(`AiAdminPanel` 안에
// `split('**')` 가 적혀 있었다). 그래서 **정지된 사람은 이렇게 읽었다** —
//
//     잘못 걸렸다고 생각되면 **풀린 뒤에** 고객센터 제보함으로 알려주세요.
//
// 10/24 에 만든 정지 안내 화면(`AccountBlocked`)과 관리자의 차단 목록
// (`HackingSecurityPanel` 의 「왜 막혔는지」)이 같은 글을 받는데, 둘 다 별표를
// 글자로 보여줬다. 벌받은 사람에게 가는 글이라 더 그렇다 — 까닭을 읽는 자리에
// 설명되지 않는 기호가 섞여 있으면 그 글 전체를 덜 믿는다.
//
// 그려주는 규칙을 **한 자리**에 둔다. 서버에서 강조를 하나 더 적는 날,
// 고칠 곳도 한 곳이다.
export default function Emphasis({ text }) {
  // 홀수 토막이 `**` 안쪽이다. 짝이 안 맞으면 마지막 토막은 그냥 글자로 남는다 —
  // 아무것도 안 그리는 것보다 낫다 (서버 글을 화면이 삼키면 안 된다)
  const parts = String(text ?? '').split('**');
  return (
    <>
      {parts.map((part, i) => (
        i % 2
          ? <b key={i} style={{ color: 'var(--text-primary)' }}>{part}</b>
          : <span key={i}>{part}</span>
      ))}
    </>
  );
}
