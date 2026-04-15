import { useState } from 'react';
import { useLangStore } from '../store/langStore';
import { isAdmin } from '../data/admin';

const T = {
  ko: {
    stage: 'STAGE',
    workouts: '회 운동',
    next: '다음',
    maxStage: 'MAX STAGE',
    viewAll: '전체 단계 보기',
    close: '접기',
    threshold: '필요 운동',
  },
  en: {
    stage: 'STAGE',
    workouts: 'workouts',
    next: 'Next',
    maxStage: 'MAX STAGE',
    viewAll: 'View All Stages',
    close: 'Close',
    threshold: 'Required',
  },
};

function getStage(totalWorkouts) {
  if (totalWorkouts >= 500) return 5;
  if (totalWorkouts >= 200) return 4;
  if (totalWorkouts >= 80)  return 3;
  if (totalWorkouts >= 30)  return 2;
  if (totalWorkouts >= 5)   return 1;
  return 0;
}

const STAGES = [
  { name: { ko: '시작 단계', en: 'Starter' }, desc: { ko: '운동을 시작한 마른 체형', en: 'Just started, lean body type' }, color: '#888',
    head: 19, neck: 8, shoulderW: 52, chestH: 50, waist: 32, armW: 8, armBulge: 0, legW: 13, calfW: 10, trapH: 0, absLines: 0, pecLine: false, veinLines: false },
  { name: { ko: '입문자', en: 'Beginner' }, desc: { ko: '조금씩 근육이 붙기 시작', en: 'Starting to build some muscle' }, color: '#aaa',
    head: 19, neck: 9, shoulderW: 58, chestH: 52, waist: 34, armW: 10, armBulge: 2, legW: 15, calfW: 11, trapH: 2, absLines: 0, pecLine: false, veinLines: false },
  { name: { ko: '중급자', en: 'Intermediate' }, desc: { ko: '눈에 띄는 근육 발달', en: 'Noticeable muscle development' }, color: '#e8a020',
    head: 19, neck: 10, shoulderW: 68, chestH: 55, waist: 36, armW: 13, armBulge: 4, legW: 18, calfW: 13, trapH: 4, absLines: 2, pecLine: true, veinLines: false },
  { name: { ko: '상급자', en: 'Advanced' }, desc: { ko: '탄탄한 근육질 체형', en: 'Solid muscular build' }, color: '#ff6b1a',
    head: 19, neck: 11, shoulderW: 78, chestH: 58, waist: 38, armW: 16, armBulge: 6, legW: 21, calfW: 15, trapH: 6, absLines: 3, pecLine: true, veinLines: true },
  { name: { ko: '마스터', en: 'Master' }, desc: { ko: '인상적인 근육량', en: 'Impressive muscle mass' }, color: '#4a9aff',
    head: 19, neck: 12, shoulderW: 88, chestH: 60, waist: 40, armW: 19, armBulge: 8, legW: 24, calfW: 17, trapH: 8, absLines: 3, pecLine: true, veinLines: true },
  { name: { ko: '전설', en: 'Legend' }, desc: { ko: '최종 형태 달성', en: 'Final form achieved' }, color: '#ffd700',
    head: 19, neck: 13, shoulderW: 96, chestH: 62, waist: 42, armW: 22, armBulge: 10, legW: 27, calfW: 19, trapH: 10, absLines: 3, pecLine: true, veinLines: true },
];

function CharBody({ s, stageIdx, size }) {
  const w = size === 'big' ? 200 : 80;
  const h = size === 'big' ? 360 : 140;
  const vw = 200;
  const vh = 360;
  const cx = 100;
  const c = s.color;

  // 주요 좌표
  const headY = 32;
  const neckTop = headY + s.head + 2;
  const neckBot = neckTop + 12;
  const shoulderY = neckBot;
  const chestBot = shoulderY + s.chestH;
  const waistBot = chestBot + 40;
  const hipBot = waistBot + 8;
  const kneeY = hipBot + 70;
  const ankleY = kneeY + 50;
  const footY = ankleY + 8;

  const sL = cx - s.shoulderW / 2; // 어깨 왼쪽
  const sR = cx + s.shoulderW / 2; // 어깨 오른쪽
  const wL = cx - s.waist / 2;
  const wR = cx + s.waist / 2;

  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} width={w} height={h}>
      {/* 글��우 */}
      {stageIdx >= 4 && (
        <ellipse cx={cx} cy="180" rx={s.shoulderW / 2 + 15} ry="120"
          fill="none" stroke={c} strokeWidth="0.5" opacity="0.15">
          <animate attributeName="opacity" values="0.1;0.25;0.1" dur="3s" repeatCount="indefinite" />
        </ellipse>
      )}

      {/* ── 머리 ── */}
      <ellipse cx={cx} cy={headY} rx={s.head} ry={s.head + 2}
        fill={`${c}20`} stroke={c} strokeWidth="1.5" />
      {/* 눈 */}
      <ellipse cx={cx - 6} cy={headY - 1} rx="2.5" ry="2" fill={c} opacity="0.5" />
      <ellipse cx={cx + 6} cy={headY - 1} rx="2.5" ry="2" fill={c} opacity="0.5" />
      {/* 입 */}
      <path d={`M${cx - 4} ${headY + 6} Q${cx} ${headY + 9} ${cx + 4} ${headY + 6}`}
        fill="none" stroke={c} strokeWidth="0.8" opacity="0.3" />
      {/* 귀 */}
      <ellipse cx={cx - s.head} cy={headY} rx="3" ry="5" fill={`${c}15`} stroke={c} strokeWidth="0.8" />
      <ellipse cx={cx + s.head} cy={headY} rx="3" ry="5" fill={`${c}15`} stroke={c} strokeWidth="0.8" />

      {/* ── 목 ── */}
      <path d={`M${cx - s.neck / 2} ${neckTop} L${cx - s.neck / 2 - 1} ${neckBot} L${cx + s.neck / 2 + 1} ${neckBot} L${cx + s.neck / 2} ${neckTop} Z`}
        fill={`${c}18`} stroke={c} strokeWidth="1.2" />

      {/* ── 승모근 ── */}
      {s.trapH > 0 && (
        <>
          <path d={`M${cx - s.neck / 2 - 1} ${neckBot - 2} Q${cx - s.neck / 2 - s.trapH} ${shoulderY + 2} ${sL + 5} ${shoulderY + 4}`}
            fill="none" stroke={c} strokeWidth="1.2" opacity="0.35" />
          <path d={`M${cx + s.neck / 2 + 1} ${neckBot - 2} Q${cx + s.neck / 2 + s.trapH} ${shoulderY + 2} ${sR - 5} ${shoulderY + 4}`}
            fill="none" stroke={c} strokeWidth="1.2" opacity="0.35" />
        </>
      )}

      {/* ── 어깨 (둥근 삼각근) ── */}
      <path d={`
        M${cx - s.neck / 2 - 2} ${shoulderY}
        Q${sL - 4} ${shoulderY - 8} ${sL} ${shoulderY + 10}
        L${sL + 6} ${shoulderY + 14}
        Z
      `} fill={`${c}22`} stroke={c} strokeWidth="1.2" />
      <path d={`
        M${cx + s.neck / 2 + 2} ${shoulderY}
        Q${sR + 4} ${shoulderY - 8} ${sR} ${shoulderY + 10}
        L${sR - 6} ${shoulderY + 14}
        Z
      `} fill={`${c}22`} stroke={c} strokeWidth="1.2" />

      {/* ── 가슴 ── */}
      <path d={`
        M${sL + 6} ${shoulderY + 10}
        Q${sL + 4} ${shoulderY + s.chestH * 0.5} ${wL} ${chestBot}
        L${wR} ${chestBot}
        Q${sR - 4} ${shoulderY + s.chestH * 0.5} ${sR - 6} ${shoulderY + 10}
        Z
      `} fill={`${c}18`} stroke={c} strokeWidth="1.5" />

      {/* 가슴 중앙선 */}
      {s.pecLine && (
        <line x1={cx} y1={shoulderY + 12} x2={cx} y2={chestBot - 5}
          stroke={c} strokeWidth="0.8" opacity="0.3" />
      )}

      {/* 가슴 하단 곡선 (펙라인) */}
      {s.pecLine && (
        <>
          <path d={`M${cx - 2} ${shoulderY + s.chestH * 0.55} Q${cx - s.waist / 2 - 4} ${shoulderY + s.chestH * 0.45} ${sL + 8} ${shoulderY + 18}`}
            fill="none" stroke={c} strokeWidth="0.8" opacity="0.25" />
          <path d={`M${cx + 2} ${shoulderY + s.chestH * 0.55} Q${cx + s.waist / 2 + 4} ${shoulderY + s.chestH * 0.45} ${sR - 8} ${shoulderY + 18}`}
            fill="none" stroke={c} strokeWidth="0.8" opacity="0.25" />
        </>
      )}

      {/* ── 복부 ── */}
      <path d={`
        M${wL} ${chestBot}
        L${wL + 2} ${waistBot}
        Q${cx} ${waistBot + 8} ${wR - 2} ${waistBot}
        L${wR} ${chestBot}
        Z
      `} fill={`${c}12`} stroke={c} strokeWidth="1.2" />

      {/* 복근 라인 */}
      {s.absLines >= 2 && (
        <>
          <line x1={cx} y1={chestBot + 2} x2={cx} y2={waistBot - 4} stroke={c} strokeWidth="0.6" opacity="0.25" />
          <line x1={wL + 4} y1={chestBot + 10} x2={wR - 4} y2={chestBot + 10} stroke={c} strokeWidth="0.5" opacity="0.2" />
          <line x1={wL + 4} y1={chestBot + 22} x2={wR - 4} y2={chestBot + 22} stroke={c} strokeWidth="0.5" opacity="0.2" />
        </>
      )}
      {s.absLines >= 3 && (
        <line x1={wL + 4} y1={chestBot + 34} x2={wR - 4} y2={chestBot + 34} stroke={c} strokeWidth="0.5" opacity="0.2" />
      )}

      {/* V라인 (옆구리) */}
      {stageIdx >= 3 && (
        <>
          <line x1={wL + 2} y1={waistBot - 8} x2={wL - 4} y2={waistBot + 6} stroke={c} strokeWidth="0.6" opacity="0.2" />
          <line x1={wR - 2} y1={waistBot - 8} x2={wR + 4} y2={waistBot + 6} stroke={c} strokeWidth="0.6" opacity="0.2" />
        </>
      )}

      {/* ── 왼팔 (위팔) ── */}
      <path d={`
        M${sL} ${shoulderY + 10}
        Q${sL - s.armW - 2} ${shoulderY + 25 + s.armBulge}
         ${sL - s.armW + 2} ${shoulderY + s.chestH + 10}
        L${sL - s.armW + 2 + s.armW * 0.7} ${shoulderY + s.chestH + 10}
        Q${sL + 2} ${shoulderY + 25 - s.armBulge / 2}
         ${sL + 6} ${shoulderY + 14}
        Z
      `} fill={`${c}16`} stroke={c} strokeWidth="1.2" />
      {/* 이두 볼록 */}
      {s.armBulge >= 4 && (
        <ellipse cx={sL - s.armW / 2 + 2} cy={shoulderY + 30}
          rx={s.armBulge / 1.8} ry={s.armBulge + 2} fill={c} opacity="0.08" />
      )}

      {/* 왼팔 (전완) */}
      <path d={`
        M${sL - s.armW + 2} ${shoulderY + s.chestH + 10}
        L${sL - s.armW + 4} ${shoulderY + s.chestH + 42}
        L${sL - s.armW + 4 + s.armW * 0.55} ${shoulderY + s.chestH + 42}
        L${sL - s.armW + 2 + s.armW * 0.7} ${shoulderY + s.chestH + 10}
        Z
      `} fill={`${c}13`} stroke={c} strokeWidth="1" />

      {/* 왼손 */}
      <ellipse cx={sL - s.armW + 4 + s.armW * 0.27} cy={shoulderY + s.chestH + 48}
        rx={s.armW * 0.25 + 1} ry="6" fill={`${c}12`} stroke={c} strokeWidth="0.8" />

      {/* ── 오른팔 (위팔) ── */}
      <path d={`
        M${sR} ${shoulderY + 10}
        Q${sR + s.armW + 2} ${shoulderY + 25 + s.armBulge}
         ${sR + s.armW - 2} ${shoulderY + s.chestH + 10}
        L${sR + s.armW - 2 - s.armW * 0.7} ${shoulderY + s.chestH + 10}
        Q${sR - 2} ${shoulderY + 25 - s.armBulge / 2}
         ${sR - 6} ${shoulderY + 14}
        Z
      `} fill={`${c}16`} stroke={c} strokeWidth="1.2" />
      {s.armBulge >= 4 && (
        <ellipse cx={sR + s.armW / 2 - 2} cy={shoulderY + 30}
          rx={s.armBulge / 1.8} ry={s.armBulge + 2} fill={c} opacity="0.08" />
      )}

      {/* 오른팔 (전완) */}
      <path d={`
        M${sR + s.armW - 2} ${shoulderY + s.chestH + 10}
        L${sR + s.armW - 4} ${shoulderY + s.chestH + 42}
        L${sR + s.armW - 4 - s.armW * 0.55} ${shoulderY + s.chestH + 42}
        L${sR + s.armW - 2 - s.armW * 0.7} ${shoulderY + s.chestH + 10}
        Z
      `} fill={`${c}13`} stroke={c} strokeWidth="1" />

      <ellipse cx={sR + s.armW - 4 - s.armW * 0.27} cy={shoulderY + s.chestH + 48}
        rx={s.armW * 0.25 + 1} ry="6" fill={`${c}12`} stroke={c} strokeWidth="0.8" />

      {/* 혈관 (상급 이상) */}
      {s.veinLines && (
        <>
          <path d={`M${sL - s.armW + 6} ${shoulderY + s.chestH + 14} Q${sL - s.armW + 3} ${shoulderY + s.chestH + 25} ${sL - s.armW + 7} ${shoulderY + s.chestH + 35}`}
            fill="none" stroke={c} strokeWidth="0.4" opacity="0.15" />
          <path d={`M${sR + s.armW - 6} ${shoulderY + s.chestH + 14} Q${sR + s.armW - 3} ${shoulderY + s.chestH + 25} ${sR + s.armW - 7} ${shoulderY + s.chestH + 35}`}
            fill="none" stroke={c} strokeWidth="0.4" opacity="0.15" />
        </>
      )}

      {/* ── 골반 ── */}
      <path d={`
        M${wL + 2} ${waistBot}
        Q${wL - 2} ${hipBot} ${cx - s.legW / 2 - 6} ${hipBot + 4}
        L${cx + s.legW / 2 + 6} ${hipBot + 4}
        Q${wR + 2} ${hipBot} ${wR - 2} ${waistBot}
        Z
      `} fill={`${c}10`} stroke={c} strokeWidth="1" />

      {/* ── 왼쪽 허벅지 ── */}
      <path d={`
        M${cx - s.legW / 2 - 6} ${hipBot + 4}
        Q${cx - s.legW / 2 - 8} ${hipBot + 35} ${cx - s.legW / 2 - 2} ${kneeY}
        L${cx - s.legW / 2 - 2 + s.legW} ${kneeY}
        Q${cx - 2} ${hipBot + 10} ${cx - 3} ${hipBot + 4}
        Z
      `} fill={`${c}14`} stroke={c} strokeWidth="1.3" />
      {/* 대퇴 근육 라인 */}
      {stageIdx >= 3 && (
        <path d={`M${cx - s.legW / 2} ${hipBot + 15} Q${cx - s.legW / 2 - 3} ${hipBot + 40} ${cx - s.legW / 2 + 1} ${kneeY - 5}`}
          fill="none" stroke={c} strokeWidth="0.5" opacity="0.18" />
      )}

      {/* ── 오른쪽 허벅지 ── */}
      <path d={`
        M${cx + 3} ${hipBot + 4}
        Q${cx + 2} ${hipBot + 10} ${cx + s.legW / 2 + 2 - s.legW} ${kneeY}
        L${cx + s.legW / 2 + 2} ${kneeY}
        Q${cx + s.legW / 2 + 8} ${hipBot + 35} ${cx + s.legW / 2 + 6} ${hipBot + 4}
        Z
      `} fill={`${c}14`} stroke={c} strokeWidth="1.3" />
      {stageIdx >= 3 && (
        <path d={`M${cx + s.legW / 2} ${hipBot + 15} Q${cx + s.legW / 2 + 3} ${hipBot + 40} ${cx + s.legW / 2 - 1} ${kneeY - 5}`}
          fill="none" stroke={c} strokeWidth="0.5" opacity="0.18" />
      )}

      {/* ── 왼쪽 종아리 ── */}
      <path d={`
        M${cx - s.legW / 2 - 2} ${kneeY}
        Q${cx - s.calfW / 2 - 4} ${kneeY + 20} ${cx - s.calfW / 2} ${ankleY}
        L${cx - s.calfW / 2 + s.calfW} ${ankleY}
        Q${cx - s.legW / 2 - 2 + s.legW + 2} ${kneeY + 15} ${cx - s.legW / 2 - 2 + s.legW} ${kneeY}
        Z
      `} fill={`${c}11`} stroke={c} strokeWidth="1" />
      {/* 종아리 근육 볼록 */}
      {stageIdx >= 2 && (
        <ellipse cx={cx - s.calfW / 2 + s.calfW * 0.4} cy={kneeY + 14}
          rx={s.calfW * 0.3} ry="8" fill={c} opacity="0.06" />
      )}

      {/* ── 오른쪽 종아리 ── */}
      <path d={`
        M${cx + s.legW / 2 + 2 - s.legW} ${kneeY}
        Q${cx + s.calfW / 2 - s.calfW - 2} ${kneeY + 15} ${cx + s.calfW / 2 - s.calfW} ${ankleY}
        L${cx + s.calfW / 2} ${ankleY}
        Q${cx + s.calfW / 2 + 4} ${kneeY + 20} ${cx + s.legW / 2 + 2} ${kneeY}
        Z
      `} fill={`${c}11`} stroke={c} strokeWidth="1" />
      {stageIdx >= 2 && (
        <ellipse cx={cx + s.calfW / 2 - s.calfW * 0.4} cy={kneeY + 14}
          rx={s.calfW * 0.3} ry="8" fill={c} opacity="0.06" />
      )}

      {/* ── 발 ── */}
      <ellipse cx={cx - s.calfW / 2 + s.calfW * 0.5} cy={footY}
        rx={s.calfW * 0.55 + 2} ry="5" fill={`${c}10`} stroke={c} strokeWidth="0.8" />
      <ellipse cx={cx + s.calfW / 2 - s.calfW * 0.5} cy={footY}
        rx={s.calfW * 0.55 + 2} ry="5" fill={`${c}10`} stroke={c} strokeWidth="0.8" />

      {/* 전설 왕관 */}
      {stageIdx >= 5 && (
        <text x={cx} y={headY - s.head - 8} textAnchor="middle" fontSize="16"
          style={{ filter: `drop-shadow(0 0 4px ${c})` }}>
          {'👑'}
        </text>
      )}
    </svg>
  );
}

export default function CharacterAvatar({ totalWorkouts }) {
  const { lang } = useLangStore();
  const t = T[lang] || T.ko;
  const [showAll, setShowAll] = useState(false);

  const effectiveWorkouts = isAdmin() ? 9999 : totalWorkouts;
  const stageIdx = getStage(effectiveWorkouts);
  const s = STAGES[stageIdx];
  const nextStage = stageIdx < 5 ? STAGES[stageIdx + 1] : null;
  const thresholds = [5, 30, 80, 200, 500];
  const nextThreshold = stageIdx < 5 ? thresholds[stageIdx] : null;
  const prevThreshold = stageIdx > 0 ? thresholds[stageIdx - 1] : 0;
  const stageProgress = nextThreshold
    ? Math.min(((totalWorkouts - prevThreshold) / (nextThreshold - prevThreshold)) * 100, 100)
    : 100;

  return (
    <div className="card" style={{ marginBottom: 16, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: '0 0 130px', display: 'flex', justifyContent: 'center' }}>
          <CharBody s={s} stageIdx={stageIdx} size="big" />
        </div>

        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 2,
            color: s.color, marginBottom: 2,
          }}>
            {s.name[lang] || s.name.ko}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
            {s.desc[lang] || s.desc.ko}
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', fontSize: 10,
              color: 'var(--text-muted)', marginBottom: 4,
            }}>
              <span>{t.stage} {stageIdx + 1}/6</span>
              <span>{totalWorkouts} {t.workouts}</span>
            </div>
            <div style={{
              height: 6, borderRadius: 3, background: 'var(--bg-tertiary)', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 3,
                width: `${stageProgress}%`,
                background: s.color,
                transition: 'width 0.6s ease',
              }} />
            </div>
          </div>

          {nextStage && nextThreshold && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {t.next}: <span style={{ color: nextStage.color, fontWeight: 600 }}>{nextStage.name[lang] || nextStage.name.ko}</span>
              <span style={{ marginLeft: 4 }}>({nextThreshold - totalWorkouts}{lang === 'ko' ? '회 남음' : ' left'})</span>
            </div>
          )}
          {!nextStage && (
            <div style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{t.maxStage}</div>
          )}

          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {STAGES.map((st, i) => (
              <div key={i} style={{
                width: 14, height: 14, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 8,
                background: i <= stageIdx ? `${st.color}30` : 'var(--bg-tertiary)',
                border: `1px solid ${i <= stageIdx ? st.color : 'var(--border)'}`,
                color: i <= stageIdx ? st.color : 'var(--text-muted)',
              }}>
                {i + 1}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <button
          onClick={() => setShowAll(!showAll)}
          style={{
            background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
            padding: '4px 14px', fontSize: 11, borderRadius: 'var(--radius)',
            cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          {showAll ? t.close : t.viewAll}
        </button>
      </div>

      {showAll && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          {STAGES.map((st, i) => {
            const isCurrent = i === stageIdx;
            const thresholdVal = i === 0 ? 0 : [5, 30, 80, 200, 500][i - 1];
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 8px',
                borderRadius: 'var(--radius)',
                background: isCurrent ? `${st.color}12` : 'none',
                borderLeft: isCurrent ? `3px solid ${st.color}` : '3px solid transparent',
                marginBottom: 6,
              }}>
                <div style={{ flexShrink: 0 }}>
                  <CharBody s={st} stageIdx={i} size="small" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontFamily: "'Bebas Neue', sans-serif", fontSize: 12, letterSpacing: 1,
                      color: st.color,
                    }}>
                      {t.stage} {i + 1}
                    </span>
                    <span style={{
                      fontSize: 12, fontWeight: isCurrent ? 700 : 400,
                      color: isCurrent ? st.color : 'var(--text-secondary)',
                    }}>
                      {st.name[lang] || st.name.ko}
                    </span>
                    {isCurrent && (
                      <span style={{
                        fontSize: 9, padding: '1px 6px', borderRadius: 'var(--radius)',
                        background: st.color, color: '#000', fontWeight: 700,
                      }}>
                        {lang === 'ko' ? '현재' : 'Current'}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    {st.desc[lang] || st.desc.ko}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                    {t.threshold}: {thresholdVal}{lang === 'ko' ? '회' : ' workouts'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
