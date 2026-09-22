import { useMemo, useEffect, useState, useRef } from 'react';
import { useWorkoutStore } from '../store/workoutStore';
import { useInbodyStore } from '../store/inbodyStore';
import { useToday } from '../data/useToday';
import { buildShapeRead, mergeShape } from '../data/shapeRead';
import { buildRatios, ratioLines } from '../data/shapeRatio';
import { readPose } from '../data/poseModel';
import ShapeSilhouette from '../components/ShapeSilhouette';

// 체형 — 사진을 올리면 **그 사진에서 잰 비율로 실루엣을 다시 그리고**, 기록 · 인바디와
// 합쳐 어디가 좋고 어디가 덜 했는지 말한다 (2026-09-22, 계획은 `docs/SHAPE-READ-2026-09-19.md`).
//
// 계산은 전부 `data/` 가 한다 — 비율은 `shapeRatio.js`, 판단은 `shapeRead.js`,
// 모델은 `poseModel.js`. 여기는 **사진을 받아 넘기고 그리는 일**만 한다.
//
// ── 사진에 대해 지키는 것 ──
//
// 1. **분석은 폰을 안 떠난다.** 자세 인식을 브라우저에서 돌린다(9/19 A안).
//    잰 비율만 남기고 **사진 자체는 아무 데도 안 보낸다** — 이 화면은 저장도 안 한다.
// 2. **못 잰 것은 못 쟀다고 한다.** 허리는 관절이 아니라 아예 못 잰다. 옆으로 선
//    사진은 어깨가 좁게 찍히므로 그 숫자로 단정하지 않는다.
// 3. **한 장으로는 단정하지 않는다.** 견줄 상대는 지난 번의 나다.
const LAST_KEY = 'shape:lastRatios';

/** 지난 번 비율. **사진이 아니라 잰 값만** 둔다 — 이 화면은 사진을 안 들고 있는다. */
function loadLast() {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveLast(r, today) {
  try { localStorage.setItem(LAST_KEY, JSON.stringify({ ...r, date: today })); } catch { /* 저장 못 해도 화면은 돈다 */ }
}

const STAGE_LABEL = {
  download: '자세 인식을 처음 받는 중이에요 (한 번만 받아요)',
  prepare: '준비하는 중…',
  read: '사진에서 관절을 찾는 중…',
};

export default function ShapePage({ embedded = false }) {
  const today = useToday();
  const workouts = useWorkoutStore((s) => s.workouts);
  const fetchAll = useWorkoutStore((s) => s.fetchAll);
  const records = useInbodyStore((s) => s.records);
  const fetchInbody = useInbodyStore((s) => s.fetchAll);

  const [ratios, setRatios] = useState(null);
  const [prev, setPrev] = useState(() => loadLast());
  const [stage, setStage] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => { fetchAll?.(); fetchInbody?.(); }, [fetchAll, fetchInbody]);

  const read = useMemo(
    () => buildShapeRead(workouts, records, today),
    [workouts, records, today],
  );

  // 사진이 없으면 01 단계 그대로다 — **사진 없이도 말이 된다**는 것이 그날의 조건이었다
  const merged = useMemo(() => mergeShape(read, ratios, prev), [read, ratios, prev]);
  const photoLines = useMemo(() => ratioLines(ratios), [ratios]);

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';                 // 같은 사진을 다시 고를 수 있어야 한다
    if (!file) return;
    setError(null);
    setStage('download');

    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      // **다 그려진 뒤에 넘긴다.** 안 기다리면 모델이 빈 그림을 읽고 아무도 못 찾는다
      await img.decode();

      const marks = await readPose(img, setStage);
      if (!marks) {
        setError('사진에서 사람을 못 찾았어요. 온몸이 다 나오게, 발끝까지 찍어주세요.');
        setStage(null);
        return;
      }
      const r = buildRatios(marks, { width: img.naturalWidth, height: img.naturalHeight });
      if (!r.ok) {
        setError(`비율을 못 쟀어요 (${r.missing.join(' · ')}가 안 보여요).`);
        setStage(null);
        return;
      }
      // **지난 번은 이번 것을 덮기 전에 챙긴다** — 안 그러면 방금 올린 것과 자기
      // 자신을 견주게 되어 늘 「거의 같아요」가 된다
      setPrev(loadLast());
      setRatios(r);
      saveLast(r, today);
      setStage(null);
    } catch (err) {
      setError('사진을 읽다가 막혔어요. 인터넷이 잠깐 끊겼다면 다시 해보세요.');
      setStage(null);
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const busy = stage !== null;
  const maxSets = read.parts.reduce((n, p) => Math.max(n, p.sets), 0);

  return (
    <div>
      {!embedded && (
        <div className="section-title">
          <div className="accent-bar" />
          체형
        </div>
      )}

      {/* ── 사진 ──
          **맨 위에 둔다.** 이 화면에 오는 까닭이 그것이다 */}
      <div className="card" style={{ marginBottom: 14 }}>
        {ratios ? (
          <>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ flex: '0 0 42%' }}>
                <ShapeSilhouette ratios={ratios} compare={prev} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, color: 'var(--accent)', letterSpacing: 1, marginBottom: 9 }}>
                  이 사진에서 잰 것
                </div>
                {photoLines.map((l) => (
                  <div key={l.key} style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: 4 }}>
                    {l.text}
                  </div>
                ))}
                {prev && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.6 }}>
                    점선은 <b>지난 번</b>{prev.date ? ` (${prev.date})` : ''}이에요.
                  </div>
                )}
              </div>
            </div>

            {/* 옆으로 선 사진이면 **먼저 밝힌다.** 이 줄이 없으면 아래 숫자를
                그대로 믿게 되는데, 몸을 틀면 어깨는 반드시 좁게 찍힌다 */}
            {ratios.facing === 'side' && (
              <div style={{
                fontSize: 12, color: 'var(--warning)', lineHeight: 1.65,
                marginTop: 12, paddingTop: 11, borderTop: '1px solid var(--border)',
              }}>
                정면이 아닌 것 같아요. 몸을 틀면 어깨가 실제보다 좁게 찍혀요 — 숫자는 참고만 해주세요.
              </div>
            )}
            {ratios.missing.length > 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 9 }}>
                못 본 자리: {ratios.missing.join(' · ')}
              </div>
            )}

            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="btn-secondary"
              style={{ width: '100%', marginTop: 12, minHeight: 40, fontFamily: 'inherit', cursor: 'pointer' }}
            >다른 사진으로</button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: 5 }}>
              사진을 올리면 <b>그 사진에서 잰 비율로 실루엣</b>을 그려요.
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 13 }}>
              온몸이 다 나오게, 정면으로. <b>분석은 폰 안에서 끝나고 사진은 아무 데도 안 보내요.</b>
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="btn-primary"
              style={{ width: '100%', minHeight: 46, fontFamily: 'inherit', cursor: busy ? 'default' : 'pointer' }}
            >{busy ? (STAGE_LABEL[stage] || '읽는 중…') : '사진 고르기'}</button>
          </>
        )}

        {busy && ratios && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 9 }}>
            {STAGE_LABEL[stage] || '읽는 중…'}
          </div>
        )}
        {error && (
          <div style={{ fontSize: 12.5, color: 'var(--danger)', marginTop: 10, lineHeight: 1.65 }}>
            {error}
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={onPick}
          style={{ display: 'none' }}
        />
      </div>

      {/* ── 자료가 모자라면 아무 말도 안 한다 ── */}
      {!read.ready ? (
        <div className="card">
          <div style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.7 }}>{read.need}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 7 }}>
            여기는 <b>최근 8주</b>를 봐요. 앞 4주와 지난 4주를 견줍니다.
          </div>
        </div>
      ) : (
        <>
          {/* ── 머리 한 줄 ──
              단정한 것과 「두고 보자」를 색으로 가른다. 사진까지 같은 곳을 가리키면
              (`sure`) 한 줄이 더 붙는다 */}
          <div
            className="card"
            style={{
              marginBottom: 14,
              borderColor: merged.verdict === 'rising' ? 'var(--border-hover)' : 'var(--accent)',
              background: merged.verdict === 'rising' ? 'none' : 'var(--accent-dim)',
            }}
          >
            <div style={{
              fontSize: 11.5, letterSpacing: 1, marginBottom: 7,
              color: merged.verdict === 'rising' ? 'var(--text-muted)' : 'var(--accent)',
            }}>
              최근 8주
            </div>
            <div style={{ fontSize: 17, color: 'var(--text-primary)', lineHeight: 1.6 }}>
              {merged.verdict === 'rising'
                ? <><b>{read.least.part}</b>가 가장 적지만, 늘고 있어요.</>
                : <>덜 한 곳은 <b>{read.least.part}</b>예요.</>}
            </div>
            {/* **가장 챙긴 곳도 말한다.** 덜 한 곳만 말하면 지적만 하는 자리가 된다 */}
            {read.most && read.most.part !== read.least.part && read.most.sets > 0 && (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
                가장 챙긴 곳은 <b style={{ color: 'var(--text-primary)' }}>{read.most.part}</b>예요 ({read.most.sets}세트).
              </div>
            )}
          </div>

          {/* ── 근거 ──
              줄마다 어디서 온 말인지 붙인다. 사진 줄에는 확실하지 않으면
              **「각도일 수 있어요」**가 따라붙는다 (9/19 에 정한 것) */}
          <div className="card" style={{ marginBottom: 14 }}>
            {merged.lines.map((line, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', gap: 9, alignItems: 'flex-start',
                  padding: '9px 0',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                }}
              >
                <span style={{
                  flexShrink: 0, marginTop: 1,
                  fontSize: 10.5, letterSpacing: 0.5, whiteSpace: 'nowrap',
                  padding: '3px 7px', borderRadius: 4,
                  border: `1px solid ${line.basis.includes('사진') ? 'var(--accent)' : 'var(--border-hover)'}`,
                  color: line.basis.includes('사진') ? 'var(--accent)' : 'var(--text-muted)',
                }}>{line.basis}</span>
                <span style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.65 }}>
                  {line.text}
                  {line.sure === false && line.basis === '사진' && (
                    <span style={{ color: 'var(--text-muted)' }}> 각도일 수 있어요.</span>
                  )}
                </span>
              </div>
            ))}
          </div>

          {/* ── 부위별 8주 ── */}
          <div className="card">
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 11 }}>
              8주 세트 — 적은 곳부터
            </div>
            {read.parts.map((p) => (
              <div key={p.part} style={{ marginBottom: 11 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: 12.5, marginBottom: 5,
                  color: p.part === read.least.part ? 'var(--accent)' : 'var(--text-secondary)',
                }}>
                  <span>{p.part}</span>
                  <span>
                    {p.sets}세트
                    {p.dir === 'up' && <span style={{ color: 'var(--text-muted)' }}> · 지난 4주 늘어남</span>}
                    {p.dir === 'down' && <span style={{ color: 'var(--text-muted)' }}> · 지난 4주 줄어듦</span>}
                  </span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: maxSets > 0 ? `${Math.round((p.sets / maxSets) * 100)}%` : '0%',
                    background: p.part === read.least.part ? 'var(--accent)' : 'var(--border-hover)',
                    borderRadius: 3,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── 꼭 적는 것 ── */}
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.75, marginTop: 14 }}>
        <b>진단이 아니에요.</b> 사진은 각도 · 옷 · 조명에 흔들려요 — 같은 자리·같은 옷으로
        찍은 것끼리 견줍니다.<br />
        <b>허리는 못 재요</b> (관절이 아니라서요). 어깨:골반으로 재고, 사진으로 근육량 ·
        체지방률은 말하지 않아요 — 그건 인바디 칸이 갖고 있어요.<br />
        견주는 상대는 <b>지난 번의 나</b>예요.
      </div>
    </div>
  );
}
