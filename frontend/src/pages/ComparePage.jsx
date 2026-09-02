import { useState, useEffect, useRef } from 'react';
import { useInbodyStore } from '../store/inbodyStore';
import RadarChart from '../components/charts/Radar';
import { toast } from '../components/Toast';
import client from '../api/client';
import { readLS, saveLS } from '../data/safeStorage';
import { PHOTO_MAX_BASE64, PHOTO_MAX_LABEL } from '../data/photoLimit';
import { COMPARE_PHOTOS_KEY } from '../data/localKeys';
import { shrinkImage } from '../data/shrinkImage';
import { CHART } from '../data/chartColors';
import { orderPick, daysBetween, spanLabel, changes, diffLabel } from '../data/compare';

// ─────────────────────────────────────────────────────────────
// 비교 — 2026-09-02 에 다시 짰다.
//
// 이 화면은 **앱이 틀린 말을 하는 유일한 자리**였다.
//
//   · 「종합 평가」가 몸에 등급을 매겼다. 8/25 에 「등급을 안 매긴다」고 정했고 바로 위
//     표는 방향만 칠하는데, 그 아래 카드는 **체중 증가를 주황(주의) · 체지방 증가를
//     빨강(위험)**으로 칠했다. 벌크업 중인 사람에게 「체중 2kg 증가」를 경고로 줬다.
//     한 화면이 두 말을 했다 → **걷어냈다.** 무엇이 어느 쪽으로 갔는지만 적는다
//   · 과거와 현재를 **거꾸로 고를 수 있었다.** 칸 둘이 서로를 안 봐서, 5kg 뺀 사람의
//     화면에 「체중 5kg 증가」가 떴다 → 고르면 **알아서 앞뒤를 맞춘다**(`orderPick`)
//   · **같은 다섯 숫자를 세 번 그렸다** — 표 · 묶음 막대 · 오각형. 그중 **막대**가
//     체중(73) · 골격근(33) · 체지방(16) · BMI(23.5) · 체수분(41)을 **0부터 시작하는
//     한 눈금**에 세웠다. 0부터 시작하는 공통 축은 **같은 단위끼리일 때만** 맞다 —
//     73 짜리 눈금에서 체지방 1.5% 변화는 픽셀 두어 개다. **사람이 보러 온 바로 그
//     변화를 그림이 뭉갰다** → 막대를 뺐다.
//     오각형은 **축마다 눈금이 따로**고 그 사실을 그림에 적어둔다 — 이 화면이 보려는
//     「두 시점의 차이」에 맞는 그림이라 남겼다. 이름만 고쳤다: 「밸런스 비교」는
//     균형을 재는 그림이라는 뜻인데 그런 그림이 아니다
//   · **얼마 만에 달라졌는지가 아무 데도 없었다.** 3kg 을 2주에 뺀 것과 반년에 뺀 것은
//     다른 이야기다 → 고른 두 날짜 사이를 적는다
//   · 사진과 숫자가 서로 몰랐다. 사진은 전 · 후 한 장씩 고정이고 숫자는 날짜를 고른다 →
//     사진에 **언제 올린 것인지**를 적는다. 날짜를 지어내지 않고, 다른 것은 다르다고 적는다
//
// 덩어리 다섯(사진 · 상세 · 종합 평가 · 과거vs현재 · 밸런스)을 **셋**으로 줄였다 —
// 언제와 언제를 고른다 → 사진 → 얼마나 달라졌나(표 + 오각형).
// ─────────────────────────────────────────────────────────────

const PHOTO_KEY = COMPARE_PHOTOS_KEY;

function loadPhotos() {
  try { return JSON.parse(readLS(PHOTO_KEY)) || {}; } catch { return {}; }
}
function savePhotos(photos) {
  saveLS(PHOTO_KEY, JSON.stringify(photos));
}

/** '2026-06-14T…' → '6월 14일'. 못 읽으면 빈 문자열 (화면은 그 줄을 안 그린다) */
function shortDay(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// 늘고 줆에 **좋고 나쁨을 매기지 않는다. 방향만** 색으로 나눈다.
//
// 예전에는 항목마다 `reverse` 를 줘서 좋은 쪽 초록 · 나쁜 쪽 빨강으로 칠했다.
// 그런데 체중은 `reverse={false}` 였다 — 체중이 늘면 초록, 줄면 빨강이라는 뜻이다.
// 빼려고 오신 분에게는 정확히 거꾸로 말하고 있었다.
const dirColor = (dir) =>
  dir > 0 ? 'var(--accent)' : dir < 0 ? 'var(--info)' : 'var(--text-muted)';

function ChangeRow({ c }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '11px 0', borderBottom: '1px solid var(--border)', gap: 10,
    }}>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)', flexShrink: 0 }}>{c.label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{c.before}{c.unit}</span>
        <span style={{ fontSize: 15, color: 'var(--text-muted)' }}>&#8594;</span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{c.after}{c.unit}</span>
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 1,
          color: dirColor(c.dir), minWidth: 58, textAlign: 'right', flexShrink: 0,
        }}>{diffLabel(c)}</span>
      </div>
    </div>
  );
}

function PhotoUpload({ label, photoKey, photos, takenAt, setPhotos }) {
  const inputRef = useRef(null);
  const photo = photos[photoKey] || null;
  const accentBorder = photoKey === 'after';

  // 폰에서 고른 사진은 대개 3~8MB 다. 거절하지 않고 줄여서 올린다
  // (shrinkImage 주석 참고)
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    let data;
    let shrunk = false;
    try {
      ({ data, shrunk } = await shrinkImage(file));
    } catch {
      toast('사진을 읽지 못했어요', 'error');
      return;
    }
    if (typeof data !== 'string' || data.length > PHOTO_MAX_BASE64) {
      toast(`사진은 ${PHOTO_MAX_LABEL} 이하만 가능해요`);
      return;
    }
    const updated = { ...photos, [photoKey]: data };
    savePhotos(updated);
    setPhotos(updated);
    // 서버 저장 실패를 삼키고 '사진 저장!' 을 띄우고 있었다.
    // 이 기기 localStorage 에만 남으므로 기기를 바꾸면 사진이 사라지는데,
    // 사용자는 저장된 줄 안다. 어디에 저장됐는지를 그대로 말한다
    client.post('/photos', { type: photoKey, data })
      .then(() => toast(shrunk ? '사진 저장! (올리기 좋게 줄였어요)' : '사진 저장!'))
      .catch(() => toast('이 기기에만 저장됐어요 — 서버 저장에 실패했습니다', 'error'));
  };

  const handleDelete = () => {
    const updated = { ...photos };
    delete updated[photoKey];
    savePhotos(updated);
    setPhotos(updated);
    // 올릴 때는 「이 기기에만 저장됐어요」라고 정직하게 말하면서, 지울 때는
    // 서버 실패를 삼키고 「삭제!」만 띄우고 있었다. 서버에 남아 있으면
    // **다음에 열 때 사진이 되살아난다** — 지운 줄 알았는데 그대로다
    client.delete(`/photos/${photoKey}`)
      .then(() => toast('사진 삭제!'))
      .catch(() => toast('이 기기에서만 지워졌어요 — 다시 열면 되살아납니다', 'error'));
  };

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 1.5,
        color: accentBorder ? 'var(--accent)' : 'var(--text-muted)',
        marginBottom: 4, textAlign: 'center',
      }}>{label}</div>
      {/* **언제 올린 사진인지 적는다.** 사진에는 날짜가 없어서, 반년 전 사진을 놓고
          「많이 달라졌다」고 보게 된다. 서버가 주는 `updated_at` 을 그대로 쓴다 */}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 6, minHeight: 16 }}>
        {photo ? (takenAt ? `${shortDay(takenAt)}에 올림` : '올린 날짜 모름') : ''}
      </div>
      {photo ? (
        <div style={{ position: 'relative' }}>
          <img
            src={photo}
            alt={label}
            style={{
              width: '100%', aspectRatio: '3/4', objectFit: 'cover',
              borderRadius: 'var(--radius)',
              border: `1px solid ${accentBorder ? 'var(--accent)' : 'var(--border)'}`,
            }}
          />
          <button
            className="delete-btn"
            onClick={handleDelete}
            aria-label={`${label} 사진 지우기`}
            style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.7)', borderRadius: 'var(--radius)', padding: '2px 6px' }}
          >&#10005;</button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
          style={{
            width: '100%', aspectRatio: '3/4',
            background: 'var(--bg-tertiary)',
            border: `1px dashed ${accentBorder ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 'var(--radius)',
            display: 'flex', flexDirection: 'column',
            justifyContent: 'center', alignItems: 'center', cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 28, color: 'var(--text-muted)', marginBottom: 4 }}>+</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>사진 추가</div>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
    </div>
  );
}

// 인바디를 두 번 넣기 전에는 그래프에 그릴 것이 없다. 예시로 그리되
// **그것이 내 숫자가 아니라는 것을 그래프 위에 먼저** 적는다 (아래에 작게 적으면
// 다 보고 나서야 남의 숫자였다는 것을 알게 된다)
const SAMPLE_BEFORE = { date: '2026-06-10', weight: 78, fat_pct: 22, muscle_kg: 30, bmi: 25.1, water_l: 38 };
const SAMPLE_AFTER = { date: '2026-09-02', weight: 73, fat_pct: 16, muscle_kg: 33, bmi: 23.5, water_l: 41 };

export default function ComparePage() {
  const { records, loading, fetchAll } = useInbodyStore();
  const [beforeIdx, setBeforeIdx] = useState(null);
  const [afterIdx, setAfterIdx] = useState(null);
  const [photos, setPhotos] = useState(loadPhotos());
  const [photoAt, setPhotoAt] = useState({});

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    // **서버가 답했으면 서버가 진실이다** — 「한 장도 없다」는 답도 답이다.
    //
    // 예전에는 사진이 하나라도 있을 때만 맞췄다. 그래서 다른 기기에서 전 · 후를 둘 다
    // 지우면, 이쪽은 브라우저에 남은 옛 사진을 **계속 띄웠다.** 지운 줄 아는데 그대로
    // 보이는 것은 몸 사진에서 특히 나쁘다.
    //
    // 못 불러왔을 때(catch)만 있던 것을 지킨다 — 인터넷이 끊긴 것과 지운 것은 다르다
    client.get('/photos').then(({ data }) => {
      if (!Array.isArray(data)) return;
      const before = data.find(p => p.type === 'before');
      const after = data.find(p => p.type === 'after');
      const serverPhotos = {};
      const at = {};
      if (before) { serverPhotos.before = before.data; at.before = before.updated_at || before.created_at; }
      if (after) { serverPhotos.after = after.data; at.after = after.updated_at || after.created_at; }
      setPhotos(serverPhotos);
      setPhotoAt(at);
      savePhotos(serverPhotos);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (records.length >= 2) {
      setBeforeIdx(records.length - 1);
      setAfterIdx(0);
    }
  }, [records]);

  // **고른 두 날짜를 늘 과거 → 현재로 바로잡는다.** 막지 않고 앞뒤를 맞춘다
  const picked = orderPick(beforeIdx, afterIdx);
  const hasData = records.length >= 2 && beforeIdx !== null && afterIdx !== null && !picked.same;
  const before = hasData ? records[picked.before] : null;
  const after = hasData ? records[picked.after] : null;

  const graphBefore = before || SAMPLE_BEFORE;
  const graphAfter = after || SAMPLE_AFTER;
  const isExample = !before || !after;
  // 같은 날을 두 번 고르면 견줄 것이 없다. 예시 숫자로 바꿔 그리면 「내 것」으로 읽는다
  const sameDay = records.length >= 2 && picked.same;
  const list = sameDay ? [] : changes(graphBefore, graphAfter);
  const days = daysBetween(graphBefore.date, graphAfter.date);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        로딩 중...
      </div>
    );
  }

  const selectRow = (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <label className="label" htmlFor="cmp-before">과거</label>
        <select
          id="cmp-before" className="input" value={beforeIdx ?? ''}
          onChange={(e) => setBeforeIdx(Number(e.target.value))}
        >
          {records.map((r, i) => (
            <option key={`b-${r.id}`} value={i}>{r.date} ({r.weight}kg)</option>
          ))}
        </select>
      </div>
      <div style={{ fontSize: 15, color: 'var(--text-muted)', paddingBottom: 11, flexShrink: 0 }}>&#8594;</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <label className="label" htmlFor="cmp-after">현재</label>
        <select
          id="cmp-after" className="input" value={afterIdx ?? ''}
          onChange={(e) => setAfterIdx(Number(e.target.value))}
        >
          {records.map((r, i) => (
            <option key={`a-${r.id}`} value={i}>{r.date} ({r.weight}kg)</option>
          ))}
        </select>
      </div>
    </div>
  );

  return (
    <div>
      <div className="section-title">
        <div className="accent-bar" />
        비교
      </div>

      {/* ── 1. 언제와 언제 ──
          예전에는 날짜 고르는 자리가 사진 **아래**에 있었다. 무엇과 무엇을 견주는지가
          화면 중간에서야 정해졌다. 먼저 고르고 그 아래를 다 그린다 */}
      {records.length >= 2 && (
        <div style={{ marginBottom: 16 }}>
          {selectRow}
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.7 }}>
            {picked.same
              ? '같은 날을 두 번 고르셨어요. 다른 날을 골라주세요.'
              : `${graphBefore.date} → ${graphAfter.date}${days != null ? ` · ${spanLabel(days)}` : ''}`}
            {/* 거꾸로 고른 것을 조용히 바꿔놓으면 사람은 자기가 잘못 본 줄 안다 */}
            {picked.swapped && !picked.same && (
              <span style={{ color: 'var(--accent)' }}> · 앞뒤를 바꿔 놓았어요</span>
            )}
          </div>
        </div>
      )}

      {records.length < 2 && (
        <div className="card" style={{ borderLeft: '3px solid var(--warning)', marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>
            아래 숫자는 제 것이 아닙니다
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            인바디를 두 번 이상 넣으시면 실제 기록으로 바뀝니다.
            지금은 화면이 어떻게 보이는지만 보여드리는 예시입니다.
          </div>
        </div>
      )}

      {/* ── 2. 사진 ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <PhotoUpload label="BEFORE" photoKey="before" photos={photos} takenAt={photoAt.before} setPhotos={setPhotos} />
        <PhotoUpload label="AFTER" photoKey="after" photos={photos} takenAt={photoAt.after} setPhotos={setPhotos} />
      </div>
      {/* **사진은 위에서 고른 날짜를 따라가지 않는다.** 없는 날짜를 지어내지 않고
          다른 것은 다르다고 적는다 — 안 적으면 사람은 같은 날의 것으로 읽는다 */}
      {(photos.before || photos.after) && (
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.7 }}>
          사진은 마지막에 올린 두 장입니다 — 위에서 고른 날짜와는 별개예요.
        </div>
      )}
      {!photos.before && !photos.after && <div style={{ marginBottom: 20 }} />}

      {/* ── 3. 얼마나 달라졌나 ──
          예전에는 이 자리에 「상세 비교」 표와 「종합 평가」 카드가 따로 있었고,
          표는 판단을 안 하는데 카드는 등급을 매겼다. 한 덩어리로 합치고 등급을 걷었다 */}
      <div className="section-title">
        <div className="accent-bar" />
        {sameDay ? '얼마나 달라졌나' : isExample ? '이렇게 보입니다 (예시)' : '얼마나 달라졌나'}
      </div>

      {list.length > 0 ? (
        <div className="card" style={{ marginBottom: 10 }}>
          {!isExample && days != null && (
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 6 }}>
              {spanLabel(days)}
            </div>
          )}
          {list.map((c) => <ChangeRow key={c.key} c={c} />)}
          {/* **판단하지 않는다고 말한다.** 색만 다르게 칠해두면 사람은 그 색을
              점수로 읽는다 — 초록이 없어도 주황이 있으면 주의로 읽는다 */}
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.7 }}>
            늘고 줆에 좋고 나쁨을 매기지 않습니다. 무엇이 어느 쪽으로 갔는지만 적어요 —
            <span style={{ color: 'var(--accent)' }}> 늘어난 것</span>과
            <span style={{ color: 'var(--info)' }}> 줄어든 것</span>.
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 10, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>
          {sameDay
            ? '위에서 서로 다른 두 날을 골라주세요.'
            : '견줄 항목이 없어요. 인바디에 체중 말고 다른 값도 넣어보세요.'}
        </div>
      )}

      {/* 표는 얼마나 달라졌는지를 숫자로, 이 그림은 **어느 쪽으로 갔는지를 한눈에** 준다.
          축마다 눈금이 따로라(그 말이 그림에 적혀 있다) 단위가 달라도 서로 안 뭉갠다.
          **묶음 막대는 뺐다** — 0부터 시작하는 한 눈금에 체중(73)과 체지방(16)을 같이
          세워서, 사람이 보러 온 1.5% 변화가 픽셀 두어 개로 뭉개졌다.
          제목도 「밸런스 비교」에서 고쳤다 — 균형을 재는 그림이 아니다 */}
      {list.length >= 3 && (
        <>
          <div className="section-title">
            <div className="accent-bar" />
            한눈에 — 두 시점의 차이
          </div>
          <div className="card" style={{ marginBottom: 20, padding: 12 }}>
            <RadarChart
              height={260}
              series={[
                { key: 'before', label: '과거', color: CHART.muted },
                { key: 'after', label: '현재', color: CHART.accent },
              ]}
              data={list.map((c) => ({ subject: c.label, before: c.before, after: c.after }))}
            />
          </div>
        </>
      )}
    </div>
  );
}
