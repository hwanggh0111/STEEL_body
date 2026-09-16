import { useState, useEffect, useRef } from 'react';
import {
  SHOT_RATIO, OPACITY_MIN, OPACITY_MAX, OPACITY_DEFAULT,
  clampOpacity, coverCrop, shotSize,
} from '../data/overlayShot';

// 겹쳐 찍기 — 카메라 화면.
//
// 지난 사진을 반투명으로 겹쳐놓고 그 위에 몸을 맞춰 찍는다. 계산은
// `data/overlayShot.js` 가 하고 여기서는 카메라를 다룬다.
//
// **거울처럼 뒤집지 않는다.** 앞면 카메라는 대개 미리보기를 좌우로 뒤집어 보여주는데
// (거울처럼 보여야 자연스러워서), 그러면 **보이는 것과 찍히는 것이 좌우로 다르다.**
// 겹쳐 맞추는 화면에서 그건 치명적이다 — 왼쪽 어깨를 맞췄는데 오른쪽 어깨가 찍힌다.
// 그래서 어느 카메라든 그대로 보여주고 그대로 찍는다.
//
// **보이는 대로 찍힌다.** 카메라가 주는 그림은 4:3 이나 16:9 인데 사진 칸은 3:4 라,
// 화면은 넘치는 쪽을 잘라 보여준다. 저장할 때 원본을 통째로 그리면 눈으로 맞춘 자리와
// 찍힌 자리가 달라진다 — 화면이 자르는 것과 같은 계산으로 오려낸다(`coverCrop`).
//
// **안 되는 자리가 있다.** 카메라는 https(또는 localhost)에서만 열린다. 권한을 막았거나
// 카메라가 없으면 **그렇다고 말하고 닫는다** — 빈 검은 화면을 띄워두지 않는다.

export default function OverlayCamera({ reference, label, onShot, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [opacity, setOpacity] = useState(OPACITY_DEFAULT);
  const [facing, setFacing] = useState('environment');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let dead = false;

    const stop = () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };

    const open = async () => {
      setReady(false);
      stop();
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('이 브라우저에서는 카메라를 못 열어요. 사진을 골라서 올려주세요.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1440 }, height: { ideal: 1920 } },
          audio: false,
        });
        if (dead) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setError('');
        setReady(true);
      } catch (err) {
        // 권한을 막은 것과 카메라가 없는 것은 다르다. 할 수 있는 일이 다르기 때문이다
        const name = err?.name || '';
        if (name === 'NotAllowedError') setError('카메라를 못 쓰게 막혀 있어요. 브라우저 설정에서 허용해주세요.');
        else if (name === 'NotFoundError') setError('쓸 수 있는 카메라가 없어요.');
        else setError('카메라를 열지 못했어요.');
      }
    };

    open();
    return () => { dead = true; stop(); };
  }, [facing]);

  // Esc 로 닫는다 — 자판만 쓰는 사람에게 나갈 길이 있어야 한다
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const shoot = () => {
    const video = videoRef.current;
    if (!video || !ready) return;
    const srcW = video.videoWidth;
    const srcH = video.videoHeight;
    const crop = coverCrop(srcW, srcH, SHOT_RATIO);
    if (!crop) return;

    const { width, height } = shotSize(SHOT_RATIO);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height);
    // 0.85 는 `shrinkImage` 가 처음 굽는 화질과 같다. 대개 200~400KB 로 떨어진다
    onShot(canvas.toDataURL('image/jpeg', 0.85));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="겹쳐 찍기"
      style={{
        position: 'fixed', inset: 0, zIndex: 9996, background: '#080705',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* 머리 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <span className="label" style={{ marginBottom: 0, letterSpacing: 2 }}>겹쳐 찍기</span>
        {label && <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{label}</span>}
        <button
          onClick={onClose}
          style={{
            marginLeft: 'auto', background: 'none', border: '1px solid var(--border-hover)',
            color: 'var(--text-secondary)', fontFamily: 'inherit', fontSize: 12.5,
            padding: '6px 13px', borderRadius: 'var(--radius)', cursor: 'pointer',
          }}
        >닫기</button>
      </div>

      {/* 보이는 자리 */}
      <div style={{
        flexGrow: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 14,
      }}>
        <div style={{
          position: 'relative', width: '100%', maxWidth: 420, aspectRatio: '3 / 4',
          background: '#0d0b09', border: '1px solid var(--border)', overflow: 'hidden',
        }}>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />

          {/* 겹친 지난 사진 */}
          {reference && (
            <img
              src={reference}
              alt=""
              aria-hidden="true"
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                objectFit: 'cover', opacity, pointerEvents: 'none',
              }}
            />
          )}

          {/* 가운데를 잡아주는 금 실선. 사진이 없어도 수평은 맞출 수 있다 */}
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(238,183,125,0.25)' }} />
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(238,183,125,0.25)' }} />
          </div>

          {error && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', padding: 24, textAlign: 'center',
              fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.8,
              background: 'rgba(8,7,5,0.9)',
            }}>{error}</div>
          )}
        </div>
      </div>

      {/* 다루는 자리 */}
      <div style={{ padding: '0 18px 26px', flexShrink: 0 }}>
        {reference && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <span className="label" style={{ marginBottom: 0, flexShrink: 0 }}>겹친 정도</span>
            <input
              type="range"
              min={OPACITY_MIN}
              max={OPACITY_MAX}
              step="0.01"
              value={opacity}
              onChange={(e) => setOpacity(clampOpacity(e.target.value))}
              aria-label="지난 사진 겹친 정도"
              style={{ flexGrow: 1, minWidth: 0, accentColor: '#eeb77d' }}
            />
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
            style={{
              flexShrink: 0, minHeight: 48, padding: '0 16px', cursor: 'pointer',
              background: 'none', border: '1px solid var(--border-hover)',
              color: 'var(--text-secondary)', fontFamily: 'inherit', fontSize: 12.5,
              borderRadius: 'var(--radius)',
            }}
          >{facing === 'environment' ? '앞면으로' : '뒷면으로'}</button>

          {/* 찍는 단추 — 이 화면에서 제일 큰 것 하나 */}
          <button
            onClick={shoot}
            disabled={!ready}
            aria-label="찍기"
            style={{
              flexGrow: 1, minHeight: 56, cursor: ready ? 'pointer' : 'not-allowed',
              background: ready ? 'var(--accent)' : 'var(--bg-tertiary)',
              border: 'none', color: ready ? 'var(--on-accent)' : 'var(--text-muted)',
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 2.5,
              borderRadius: 'var(--radius)',
            }}
          >찍기</button>
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.7 }}>
          {reference
            ? '지난 사진에 몸을 겹쳐 맞추고 찍으세요. 보이는 그대로 저장됩니다.'
            : '겹칠 지난 사진이 없어요. 이번에 찍은 것이 다음번의 기준이 됩니다.'}
        </div>
      </div>
    </div>
  );
}
