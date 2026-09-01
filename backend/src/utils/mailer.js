// SMTP 이메일 발송 — 환경변수 SMTP_USER/SMTP_PASS 설정 시에만 활성화.
// 미설정 시 dev에서는 콘솔 출력, prod에서는 에러를 던져 호출 측이 분기 가능.

const SMTP_CONFIGURED = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
let _transporter = null;

function getTransporter() {
  if (!SMTP_CONFIGURED) return null;
  if (_transporter) return _transporter;
  const nodemailer = require('nodemailer');
  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return _transporter;
}

// 인증번호 메일 발송. 성공 시 true, 실패/미설정 시 false.
const APP_NAME = 'BLACK IRON';
// 메일은 CSS 변수를 못 쓴다(메일 프로그램이 안 읽는다). 그래서 값을 적는데,
// **앱의 `--accent` 와 같은 값이어야 한다.** 8/28 에 앱은 검정+금으로 바꿨는데
// 메일만 옛 주황(#ff6b1a)으로 남아 있었다 — 앱을 쓰다 메일을 받으면 다른 서비스 같다.
// 여기 한 곳에만 적고 두 통이 같이 쓴다
const ACCENT = '#eeb77d';
const INK = '#1a1a1a';

async function sendVerificationCode(email, code) {
  const t = getTransporter();
  if (!t) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[MAIL:DEV] To: ${email} | Code: ${code}`);
    }
    return false;
  }
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: `[${APP_NAME}] 인증번호`,
      text: `인증번호: ${code}\n\n5분 안에 입력해주세요. 본인이 요청하지 않았다면 이 메일을 무시하세요.`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #fafafa;">
          <h2 style="color: ${ACCENT}; letter-spacing: 4px; margin: 0 0 16px;">${APP_NAME}</h2>
          <p style="color: #333; font-size: 14px; line-height: 1.6;">인증번호를 안내드립니다. 5분 이내에 입력해주세요.</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 20px; background: #fff; border: 2px solid ${ACCENT}; border-radius: 8px; color: ${INK}; margin: 16px 0;">${code}</div>
          <p style="color: #999; font-size: 12px;">본인이 요청하지 않았다면 이 메일을 무시하세요.</p>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error('[MAIL] 발송 실패:', err.message);
    return false;
  }
}

// ── 관리자에게 알림 ──
//
// 제보나 욕설 기록은 사람이 봐야 하는 것인데, 지금까지는 관리자가 화면을 열어봐야만
// 알 수 있었다. 며칠 안 들어가면 며칠 동안 아무도 답을 안 단다.
//
// 메일이 안 나가도 앱은 아무 영향이 없어야 한다 — SMTP 가 없으면 조용히 건너뛰고,
// 실패해도 삼킨다. 알림 때문에 제보 접수가 실패하면 본말이 전도된다.
//
// 너무 자주 보내지 않는다. 제보가 몰리면 메일함이 터진다 — 같은 종류는 최소 간격을 둔다.
const NOTICE_GAP_MS = 10 * 60 * 1000;
const _lastNotice = new Map();

function shouldSend(kind) {
  const now = Date.now();
  const last = _lastNotice.get(kind) || 0;
  if (now - last < NOTICE_GAP_MS) return false;
  _lastNotice.set(kind, now);
  return true;
}

/**
 * 관리자에게 한 통 보낸다. 기다리지 않는다 (호출부는 await 하지 않는다).
 *
 * @param {string} kind    같은 종류를 묶는 이름 ('report' · 'abuse')
 * @param {string} subject 제목
 * @param {string[]} lines 본문 줄들
 * @param {boolean} always 간격을 무시하고 꼭 보낼지 (비하·정지처럼 놓치면 안 되는 것)
 */
function notifyAdmin(kind, subject, lines, always = false) {
  const to = process.env.ADMIN_EMAIL;
  if (!to || !SMTP_CONFIGURED) return;
  if (!always && !shouldSend(kind)) return;

  const t = getTransporter();
  if (!t) return;

  const text = lines.join(String.fromCharCode(10));
  t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: `[${APP_NAME}] ${subject}`,
    text,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; background: #fafafa;">
        <h2 style="color: ${ACCENT}; letter-spacing: 4px; margin: 0 0 4px;">${APP_NAME}</h2>
        <p style="color: #666; font-size: 12px; margin: 0 0 16px;">${subject}</p>
        <div style="background: #fff; border: 1px solid #eee; border-radius: 8px; padding: 16px; color: #333; font-size: 14px; line-height: 1.8; white-space: pre-wrap;">${
          lines.map(l => String(l).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))).join('<br>')
        }</div>
        <p style="color: #999; font-size: 12px; margin-top: 14px;">관리자 화면의 <b>제보 관리</b> 탭에서 확인하고 답을 달 수 있습니다.</p>
      </div>
    `,
  }).catch(err => console.error('[MAIL] 관리자 알림 실패:', err.message));
}

module.exports = { sendVerificationCode, notifyAdmin, SMTP_CONFIGURED };
