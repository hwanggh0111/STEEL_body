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
      subject: '[STEEL BODY] 인증번호',
      text: `인증번호: ${code}\n\n5분 안에 입력해주세요. 본인이 요청하지 않았다면 이 메일을 무시하세요.`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #fafafa;">
          <h2 style="color: #ff6b1a; letter-spacing: 4px; margin: 0 0 16px;">STEEL BODY</h2>
          <p style="color: #333; font-size: 14px; line-height: 1.6;">인증번호를 안내드립니다. 5분 이내에 입력해주세요.</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 20px; background: #fff; border: 2px solid #ff6b1a; border-radius: 8px; color: #ff6b1a; margin: 16px 0;">${code}</div>
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

module.exports = { sendVerificationCode, SMTP_CONFIGURED };
