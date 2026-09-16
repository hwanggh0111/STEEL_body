import { useState, useEffect, useRef } from 'react';
import { parseSpoken, spokenLabel, speechSupported } from '../data/voiceLog';

// 목소리로 적기.
//
// 운동 중에 흐름이 제일 많이 끊기는 자리가 기록이다 — 땀 묻은 손으로, 숨이 찬 채로
// 숫자 칸 셋을 두드린다. 「팔십 여덟개」 한마디면 되는 일이다.
//
// **들은 것을 먼저 보여준다. 누르면 그때 채운다.**
// 헬스장은 시끄럽고 알아듣기는 틀린다. 곧바로 저장하면 틀린 기록이 조용히 쌓이고,
// 그러면 이 앱의 모든 숫자를 못 믿게 된다 — 기록 앱에서 그것보다 나쁜 것은 없다.
// 그래서 여기서 하는 일은 **폼을 채우는 것까지**다. 저장은 늘 그랬듯 사람이 누른다.
//
// 옮기는 규칙은 `data/voiceLog.js` 에 있다(거기는 화면 없이 확인된다).
// 이 파일은 마이크를 다룬다 — 눈과 귀로만 확인되는 자리다.
//
// **되는 곳에서만 보인다.** 알아듣기(Web Speech)는 크롬 계열에만 있다. 없는 브라우저에
// 단추만 띄워두면 눌러보고 아무 일도 안 일어난다.

export default function VoiceSet({ onFill }) {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');       // 듣는 도중의 말
  const [result, setResult] = useState(null);   // 다 듣고 옮긴 것
  const [error, setError] = useState('');
  const recRef = useRef(null);

  const supported = speechSupported();

  // 화면을 떠날 때 마이크를 반드시 놓는다 — 안 놓으면 폰에서 녹음 표시가 남는다
  useEffect(() => () => { try { recRef.current?.abort(); } catch { /* 이미 멎었다 */ } }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const close = () => {
    try { recRef.current?.abort(); } catch { /* 이미 멎었다 */ }
    recRef.current = null;
    setOpen(false);
    setListening(false);
    setHeard('');
    setResult(null);
    setError('');
  };

  const listen = () => {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec) { setError('이 브라우저에서는 알아듣기를 못 해요.'); return; }

    setHeard('');
    setResult(null);
    setError('');

    const rec = new Rec();
    recRef.current = rec;
    rec.lang = 'ko-KR';
    // **한 마디만 듣는다.** 계속 켜두면 옆 사람 말까지 들어온다
    rec.continuous = false;
    // 듣는 동안 글자를 띄워준다 — 마이크가 살아 있다는 것을 그것으로 안다
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i += 1) text += e.results[i][0].transcript;
      setHeard(text);
      if (e.results[e.results.length - 1].isFinal) setResult(parseSpoken(text));
    };
    rec.onerror = (e) => {
      // 할 수 있는 일이 다르므로 갈라서 말한다
      if (e.error === 'not-allowed') setError('마이크를 못 쓰게 막혀 있어요. 브라우저 설정에서 허용해주세요.');
      else if (e.error === 'no-speech') setError('아무 말도 못 들었어요.');
      else if (e.error === 'audio-capture') setError('쓸 수 있는 마이크가 없어요.');
      else setError('못 알아들었어요.');
      setListening(false);
    };
    rec.onend = () => setListening(false);

    try {
      rec.start();
      setListening(true);
    } catch {
      setError('마이크를 열지 못했어요.');
    }
  };

  const start = () => { setOpen(true); listen(); };

  if (!supported) return null;

  return (
    <>
      <button
        className="btn-secondary"
        style={{ width: '100%', padding: '9px 0', fontSize: 12 }}
        onClick={start}
      >말로 적기</button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="말로 적기"
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9996, background: 'rgba(8,7,5,0.94)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div style={{
            width: '100%', maxWidth: 420, background: 'var(--bg-secondary)',
            borderTop: '1px solid var(--accent)', padding: '22px 22px 28px',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="label" style={{ marginBottom: 0, letterSpacing: 2 }}>말로 적기</span>
              <button
                onClick={close}
                style={{
                  marginLeft: 'auto', background: 'none', border: '1px solid var(--border-hover)',
                  color: 'var(--text-secondary)', fontFamily: 'inherit', fontSize: 12.5,
                  padding: '5px 12px', borderRadius: 'var(--radius)', cursor: 'pointer',
                }}
              >닫기</button>
            </div>

            {/* 듣는 중 */}
            {listening && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="heat-breathe" style={{
                  width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0,
                }} />
                <span style={{ fontSize: 14, color: 'var(--text-primary)', minWidth: 0 }}>
                  {heard || '듣고 있어요… 「팔십 여덟개」처럼 말해보세요'}
                </span>
              </div>
            )}

            {/* 다 듣고 옮긴 것 — **먼저 보여주고 누르면 채운다** */}
            {!listening && result?.ok && (
              <>
                <div>
                  <div className="label" style={{ marginBottom: 6 }}>이렇게 들었어요</div>
                  <div className="serif-display" style={{ fontSize: 22 }}>{spokenLabel(result)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                    「{result.raw}」{result.sets === null ? ' · 세트는 안 들려서 비워뒀어요' : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={() => { onFill(result); close(); }}>
                    이대로 넣기
                  </button>
                  <button className="btn-secondary" style={{ flex: 1 }} onClick={listen}>다시 말하기</button>
                </div>
              </>
            )}

            {/* 들었는데 숫자가 없다 — **지어내지 않는다** */}
            {!listening && result && !result.ok && !error && (
              <>
                <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                  「{result.raw}」에서 숫자를 못 찾았어요.<br />
                  「팔십 여덟개」 · 「60 12개 3세트」처럼 말해보세요.
                </div>
                <button className="btn-secondary" onClick={listen}>다시 말하기</button>
              </>
            )}

            {!listening && error && (
              <>
                <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.8 }}>{error}</div>
                <button className="btn-secondary" onClick={listen}>다시 해보기</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
