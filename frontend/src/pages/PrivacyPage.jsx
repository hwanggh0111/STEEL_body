import { useNavigate } from 'react-router-dom';
import { LogoMark } from '../components/Logo';

// 개인정보처리방침 — **로그인 밖(공개)이다.**
//
// 플레이스토어는 올릴 때 **아무나 열 수 있는 방침 주소**를 요구한다 (심사 필수 항목).
// 로그인 뒤에 있으면 구글 심사자가 열지 못해 그 자리에서 반려된다. 그래서 `/site` ·
// `/login` 과 같은 자리(PrivateRoute 밖)에 둔다 (2026-10-09).
//
// **지어내지 않는다.** 아래 적힌 항목은 전부 `backend/src/db.js` 가 실제로 담는 것이고,
// 맡기는 곳도 실제로 쓰는 곳(Render · 지메일 SMTP · 소셜 로그인 제공자)뿐이다.
// 코드가 담는 것을 늘리면 **이 장도 같이 고쳐야 한다** — 방침과 실제가 다르면
// 그것 자체가 위반이다.

const MAX = 760;
const UPDATED = '2026년 10월 9일';

function Sec({ title, children }) {
  return (
    <section style={{ marginBottom: 26 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
        <span style={{ width: 3, height: 15, background: 'var(--accent)', flexShrink: 0 }} />
        <h2 style={{
          fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif", fontSize: 16, letterSpacing: 1.5,
          color: 'var(--text-primary)', margin: 0, fontWeight: 400,
        }}>{title}</h2>
      </div>
      <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.85 }}>{children}</div>
    </section>
  );
}

// 항목 표 한 줄
function Row({ what, why }) {
  return (
    <div style={{
      display: 'flex', gap: 12, padding: '8px 0',
      borderTop: '1px solid var(--border)', alignItems: 'baseline',
    }}>
      <div style={{ flex: '0 0 34%', color: 'var(--text-primary)', fontSize: 13 }}>{what}</div>
      <div style={{ flex: 1, fontSize: 13 }}>{why}</div>
    </div>
  );
}

export default function PrivacyPage() {
  const nav = useNavigate();
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '24px 16px 56px' }}>
      <div style={{ maxWidth: MAX, margin: '0 auto' }}>

        <button
          onClick={() => nav('/site')}
          style={{
            display: 'flex', alignItems: 'center', gap: 9, background: 'none', border: 'none',
            cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginBottom: 22,
            color: 'var(--text-muted)', fontSize: 12.5,
          }}
        >
          <LogoMark size={16} /> BLACK IRON
        </button>

        <h1 style={{
          fontFamily: "'Bebas Neue', 'IBM Plex Sans KR', sans-serif", fontSize: 26, letterSpacing: 2,
          color: 'var(--text-primary)', margin: '0 0 6px', fontWeight: 400,
        }}>개인정보처리방침</h1>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 30 }}>
          마지막으로 고친 날: {UPDATED}
        </div>

        <Sec title="한 줄로">
          BLACK IRON 은 <strong style={{ color: 'var(--text-primary)' }}>운동기록을 남기는 데 필요한 것만</strong> 받습니다.
          광고를 붙이지 않고, 받은 것을 팔거나 광고에 쓰지 않습니다.
        </Sec>

        <Sec title="무엇을 받나">
          <Row what="이메일 · 비밀번호" why="로그인에 쓰입니다. 비밀번호는 되돌릴 수 없는 형태(해시)로만 담고, 원문은 어디에도 남기지 않습니다." />
          <Row what="닉네임 · 아이디" why="화면에 표시하고 다른 사람과 구분하는 데 쓰입니다." />
          <Row what="소셜 로그인 정보" why="구글 · 네이버 · 카카오 등으로 들어올 때 제공자가 주는 식별번호와 이름입니다. 비밀번호는 받지 않습니다." />
          <Row what="운동기록" why="한 세트마다 적는 운동 · 무게 · 횟수 · 날짜 · 메모입니다. 이 앱의 본체입니다." />
          <Row what="몸 정보" why="직접 적은 체중 · 인바디 수치 · 둘레 · 목표입니다. 적지 않으면 받지 않습니다." />
          <Row what="사진" why="겹쳐 찍기로 직접 올린 사진만 담습니다. 올린 사람만 봅니다 — 홈페이지에 거는 것은 따로 고른 것뿐입니다." />
          <Row what="알림 받을 주소" why="알림을 켠 분에게만 있습니다. 브라우저가 발급한 주소 한 줄이고, 끄면 지웁니다." />
          <Row what="접속 기록" why="IP 주소와 브라우저 종류를 짧게 둡니다. 자동 가입 · 도배 · 욕설을 막는 데만 쓰고 다른 데 쓰지 않습니다." />
        </Sec>

        <Sec title="카메라를 쓰는 까닭">
          겹쳐 찍기에서 <strong style={{ color: 'var(--text-primary)' }}>그 순간에만</strong> 카메라를 엽니다.
          앱은 사진 저장소를 읽지 않고, 찍지 않는 동안 카메라를 켜두지 않습니다.
          앱을 깐 것만으로는 아무 사진도 올라가지 않습니다.
        </Sec>

        <Sec title="어디에 맡기나">
          <Row what="Render" why="서버와 기록이 놓인 곳입니다 (미국)." />
          <Row what="지메일 SMTP" why="가입 확인 메일과 비밀번호 찾기 메일을 보냅니다." />
          <Row what="소셜 로그인 제공자" why="구글 · 네이버 등. 그쪽으로는 로그인에 필요한 것만 오갑니다." />
          <div style={{ marginTop: 12 }}>
            이 밖의 어디에도 넘기지 않습니다. 법으로 내놓아야 하는 경우가 아니면 팔지도, 빌려주지도 않습니다.
          </div>
        </Sec>

        <Sec title="얼마나 두나">
          계정을 쓰는 동안 둡니다. 계정을 지우면 <strong style={{ color: 'var(--text-primary)' }}>30일 뒤에 기록까지 함께 사라집니다</strong> —
          그 안에 다시 로그인하면 되살아납니다. 실수로 지운 것을 되돌릴 틈을 두려고 그렇게 했습니다.
          30일이 지나면 되돌릴 수 없습니다. 접속 기록은 그보다 짧게 두고 저절로 지워집니다.
        </Sec>

        <Sec title="직접 할 수 있는 것">
          <Row what="보기 · 고치기" why="앱 안의 기록은 모두 그 자리에서 고치고 지울 수 있습니다." />
          <Row what="내려받기" why="설정에서 내 기록을 파일로 받을 수 있습니다." />
          <Row what="계정 지우기" why="설정에서 직접 지웁니다. 메일로 부탁하지 않아도 됩니다." />
          <Row what="알림 끄기" why="설정에서 끄면 받을 주소도 함께 지웁니다." />
        </Sec>

        <Sec title="만 14세 미만">
          만 14세 미만은 가입 대상이 아닙니다. 그 나이의 계정임을 알게 되면 기록을 지웁니다.
        </Sec>

        <Sec title="물어볼 곳">
          <a href="mailto:withpapa.002@gmail.com" style={{ color: 'var(--accent)' }}>withpapa.002@gmail.com</a>
          {' '}또는 앱 안의 <a href="/support" style={{ color: 'var(--accent)' }}>고객센터</a>로 알려주세요.
        </Sec>

        <Sec title="고칠 때">
          이 방침이 바뀌면 바뀐 날을 위에 적고 앱의 소식으로 알립니다. 크게 바뀔 때는 앱을 열 때 한 번 보여드립니다.
        </Sec>

        <hr className="rule-beam" style={{ margin: '30px 0 16px' }} />
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <a href="/site" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>홈페이지</a>
          <a href="/support" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>고객센터</a>
          <span style={{ marginLeft: 'auto' }}>BLACK IRON</span>
        </div>
      </div>
    </div>
  );
}
