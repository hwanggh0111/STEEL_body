import { useMemo, useEffect, useState, useRef } from 'react';
import { useWorkoutStore } from '../store/workoutStore';
import { useInbodyStore } from '../store/inbodyStore';
import { useToday } from '../data/useToday';
import { buildShapeRead, mergeShape } from '../data/shapeRead';
import { buildRatios, ratioLines } from '../data/shapeRatio';
import { readPose } from '../data/poseModel';
import ShapeSilhouette from '../components/ShapeSilhouette';
import OverlayCamera from '../components/OverlayCamera';
import { pickShapeReference } from '../data/overlayShot';
import { pushShape, pickPrev, pickFirst, shapeSpan, slimShape, SHAPE_MAX } from '../data/shapeHistory';
import { readLS, saveLS } from '../data/safeStorage';
import { SHAPE_RATIOS_KEY, SHAPE_LOG_KEY, COMPARE_PHOTOS_KEY } from '../data/localKeys';

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
//
// ── 04 단계: 지난 번과 견주기 (2026-09-29) ──
//
// 잰 값을 **이력으로 쌓는다**(`data/shapeHistory.js`). 그래서 견줄 상대를 고를 수
// 있다 — 지난 번 · 처음. 그리고 **겹쳐 찍기와 이었다**: 비교 화면에 이미 있는 전·후
// 사진을 반투명으로 겹쳐놓고 그 위에 맞춰 찍는다(`OverlayCamera`). 같은 자리에서
// 찍힌 것끼리여야 「좁아졌다」가 몸의 이야기가 된다.
//
// **찍은 사진도 저장하지 않는다.** 비율을 재고 버린다 — 이 화면의 규칙은 그대로다.
//
// 잰 값을 두는 이름은 **여기서 짓지 않는다** — `data/localKeys.js` 에 둔다.
// 거기 있어야 로그아웃할 때 저절로 지워진다(`PER_USER_KEYS`). 사진이 아니라 숫자
// 몇 개지만 **그 사람의 몸**이라, 다음에 로그인한 사람에게 남으면 안 된다.

/**
 * 잰 값의 이력. **사진이 아니라 잰 값만** 둔다 — 이 화면은 사진을 안 들고 있는다.
 *
 * 03 까지 쓰던 **한 칸(`SHAPE_RATIOS_KEY`)을 옮겨 담는다.** 안 그러면 9/22 에 찍어둔
 * 사람의 「지난 번」이 04 를 붙인 날 사라진다 — 두 번 찍어야 다시 견줄 수 있게 된다.
 */
function loadLog() {
  try {
    const raw = readLS(SHAPE_LOG_KEY);
    const list = raw ? JSON.parse(raw) : null;
    if (Array.isArray(list) && list.length > 0) return list.slice(-SHAPE_MAX);
  } catch { /* 깨진 것은 없는 것으로 본다 */ }
  try {
    const one = readLS(SHAPE_RATIOS_KEY);
    const r = one ? JSON.parse(one) : null;
    // 날짜가 없으면 언제 찍은 것인지 모른다 — 「며칠 만」을 지어내지 않으려고 버린다
    if (r && r.date) return [slimShape(r)];
  } catch { /* 없으면 없는 것이다 */ }
  return [];
}
function saveLog(list) {
  saveLS(SHAPE_LOG_KEY, JSON.stringify(list));   // 저장 못 해도 화면은 돈다
}

/** 비교 화면이 기기에 둔 전·후 사진. **읽기만 한다** — 체형은 사진을 안 만든다. */
function loadComparePhotos() {
  try { return JSON.parse(readLS(COMPARE_PHOTOS_KEY)) || {}; } catch { return {}; }
}

/** 'YYYY-MM-DD' → '9월 22일'. 못 읽으면 그대로 보여준다 */
function shortDay(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key || '');
  return m ? `${Number(m[2])}월 ${Number(m[3])}일` : (key || '');
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
  const [log, setLog] = useState(() => loadLog());
  // 견줄 상대. **처음이 둘 이상 쌓였을 때만** 고를 수 있다 (`pickFirst`)
  const [against, setAgainst] = useState('prev');
  const [camOpen, setCamOpen] = useState(false);
  const [stage, setStage] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => { fetchAll?.(); fetchInbody?.(); }, [fetchAll, fetchInbody]);

  const read = useMemo(
    () => buildShapeRead(workouts, records, today),
    [workouts, records, today],
  );

  // 견줄 상대 — 오늘 것은 빼고 고른다(`shapeHistory`). 고를 것이 없으면 「지난 번」이다
  const lastOne = useMemo(() => pickPrev(log, today), [log, today]);
  const firstOne = useMemo(() => pickFirst(log, today), [log, today]);
  const prev = against === 'first' && firstOne ? firstOne : lastOne;
  const span = useMemo(() => shapeSpan(log, today), [log, today]);

  // 사진이 없으면 01 단계 그대로다 — **사진 없이도 말이 된다**는 것이 그날의 조건이었다
  const merged = useMemo(() => mergeShape(read, ratios, prev), [read, ratios, prev]);
  const photoLines = useMemo(() => ratioLines(ratios), [ratios]);
  // 기록이 모자랄 때 위 카드 아래에 따로 낼 것 — **사진에서 온 줄만** 추린다
  const photoOnly = useMemo(
    () => merged.lines.filter((l) => l.basis.includes('사진')),
    [merged],
  );

  /**
   * 사진 한 장 → 비율. **고른 것과 겹쳐 찍은 것이 같은 길을 쓴다.**
   * 두 벌로 두면 한쪽만 고치는 날이 오고, 그러면 같은 사진이 길에 따라 다르게 읽힌다
   * (`ComparePage` 의 `commit` 에 적힌 것과 같은 까닭이다).
   *
   * shot 은 'overlay'(겹쳐 찍은 것) · 'pick'(고른 것). **단정에 쓰이는 값**이라
   * 여기서 정직하게 붙인다 — 겹쳐 찍지 않은 것을 겹쳐 찍었다고 하면 04 가 거짓이 된다.
   */
  const measure = async (src, shot) => {
    setError(null);
    setStage('download');
    try {
      const img = new Image();
      img.src = src;
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
      // 이력에 더한다. **오늘 것은 견줄 상대에서 저절로 빠진다**(`pickPrev`) —
      // 03 때는 「덮기 전에 챙기는」 순서로 그것을 지켰는데, 순서에 기대는 것보다
      // 고르는 쪽이 오늘을 빼는 편이 안전하다
      const entry = { ...r, date: today, shot };
      const next = pushShape(log, entry);
      setLog(next);
      saveLog(next);
      setRatios(entry);
      setStage(null);
    } catch {
      setError('사진을 읽다가 막혔어요. 인터넷이 잠깐 끊겼다면 다시 해보세요.');
      setStage(null);
    }
  };

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';                 // 같은 사진을 다시 고를 수 있어야 한다
    if (!file) return;
    const url = URL.createObjectURL(file);
    try { await measure(url, 'pick'); } finally { URL.revokeObjectURL(url); }
  };

  // 겹쳐 찍은 것 — **저장하지 않는다.** 재고 버린다
  const onShot = async (dataUrl) => {
    setCamOpen(false);
    await measure(dataUrl, 'overlay');
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
                    점선은 <b>{against === 'first' && firstOne ? '처음' : '지난 번'}</b>
                    {prev.date ? ` (${shortDay(prev.date)})` : ''}이에요.
                    {prev.shot === 'overlay' && ' 겹쳐 찍은 것이에요.'}
                  </div>
                )}

                {/* ── 견줄 상대 고르기 (04) ──
                    **셋 이상 쌓였을 때만 낸다.** 둘이면 「지난 번」과 「처음」이 같은
                    것이고, 같은 것을 두 단추로 내놓으면 고를 것이 있는 줄 알게 된다 */}
                {firstOne && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    {[
                      { key: 'prev', label: `지난 번 (${shortDay(lastOne?.date)})` },
                      { key: 'first', label: `처음 (${shortDay(firstOne.date)})` },
                    ].map((o) => (
                      <button
                        key={o.key}
                        onClick={() => setAgainst(o.key)}
                        className={`btn-secondary${against === o.key ? ' active' : ''}`}
                        style={{ flex: 1, padding: '7px 0', fontSize: 11.5 }}
                      >{o.label}</button>
                    ))}
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

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={() => setCamOpen(true)}
                disabled={busy}
                className="btn-secondary"
                style={{ flex: 1, minHeight: 40, fontFamily: 'inherit', cursor: 'pointer' }}
              >겹쳐 찍기</button>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="btn-secondary"
                style={{ flex: 1, minHeight: 40, fontFamily: 'inherit', cursor: 'pointer' }}
              >다른 사진으로</button>
            </div>
            {/* 몇 번 찍었는지. **이력이 본체**라 눈에 보이는 자리가 있어야 한다 */}
            {span.count > 1 && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 9, lineHeight: 1.6 }}>
                여태 {span.count}번 쟀어요 · 처음은 {shortDay(span.first)}
                {span.days ? ` (${span.days}일 전)` : ''} · {SHAPE_MAX}번까지 들고 있어요.
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: 5 }}>
              사진을 올리면 <b>그 사진에서 잰 비율로 실루엣</b>을 그려요.
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 13 }}>
              온몸이 다 나오게, 정면으로. <b>분석은 폰 안에서 끝나고 사진은 아무 데도 안 보내요.</b>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="btn-primary"
                style={{ flex: 1, minHeight: 46, fontFamily: 'inherit', cursor: busy ? 'default' : 'pointer' }}
              >{busy ? (STAGE_LABEL[stage] || '읽는 중…') : '사진 고르기'}</button>
              {/* 겹쳐 찍기 — **같은 자리에서 찍히게 하는 길.** 04 에서 이었다.
                  기준이 없어도 열린다: 이번에 찍은 자리가 다음번의 기준이 된다 */}
              <button
                onClick={() => setCamOpen(true)}
                disabled={busy}
                className="btn-secondary"
                style={{ flex: '0 0 40%', minHeight: 46, fontFamily: 'inherit', cursor: busy ? 'default' : 'pointer' }}
              >겹쳐 찍기</button>
            </div>
            {span.count > 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.6 }}>
                지난번에 잰 것이 {span.count}개 있어요 (마지막은 {shortDay(span.last)}) — 새로 한 장 올리면 그것과 견줍니다.
              </div>
            )}
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

      {/* ── 자료가 모자라면 아무 말도 안 한다 ──
          **그래도 사진 줄은 보여준다.** 기록이 없는 사람이 사진을 올렸을 때
          아래를 통째로 안 그리면, 「견줄 것이 없어요」 같은 안내가 갈 곳이 없어져
          **사진을 올렸는데 아무 일도 안 일어난 것처럼** 보인다 */}
      {!read.ready ? (
        <div className="card">
          {photoOnly.map((line, i) => (
            <div key={i} style={{
              fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7,
              paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid var(--border)',
            }}>{line.text}</div>
          ))}
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

      {/* ── 겹쳐 찍기 ──
          겹칠 기준은 **비교 화면에 이미 있는 전·후 사진**을 빌린다(`pickShapeReference`).
          체형은 사진을 안 만들기 때문이다. 찍은 것은 비율만 재고 버린다 */}
      {camOpen && (
        <OverlayCamera
          reference={pickShapeReference(loadComparePhotos())?.data || null}
          label="체형 — 재고 나면 사진은 버려요"
          onShot={onShot}
          onClose={() => setCamOpen(false)}
        />
      )}

      {/* ── 꼭 적는 것 ── */}
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.75, marginTop: 14 }}>
        <b>진단이 아니에요.</b> 사진은 각도 · 옷 · 조명에 흔들려요 — 같은 자리·같은 옷으로
        찍은 것끼리 견줍니다.<br />
        <b>허리는 못 재요</b> (관절이 아니라서요). 어깨:골반으로 재고, 사진으로 근육량 ·
        체지방률은 말하지 않아요 — 그건 인바디 칸이 갖고 있어요.<br />
        견주는 상대는 <b>지난 번의 나</b>예요. 상체:다리가 달라졌으면 <b>카메라가
        움직인 것</b>이라 보고, 그때는 어깨 변화로 단정하지 않아요 (뼈 길이는 운동으로
        안 변해요).<br />
        <b>겹쳐 찍기로 찍은 사진도 저장하지 않아요</b> — 비율만 재고 버립니다.
      </div>
    </div>
  );
}
