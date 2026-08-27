import { useState, useEffect, useRef } from 'react';
import { useInbodyStore } from '../store/inbodyStore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { toast } from '../components/Toast';
import client from '../api/client';
import { readLS, saveLS } from '../data/safeStorage';
import { PHOTO_MAX_BASE64, PHOTO_MAX_LABEL } from '../data/photoLimit';
import { shrinkImage } from '../data/shrinkImage';
import { scaleFor, positionOn } from '../data/bodyRanges';

const PHOTO_KEY = 'ironlog_photos';

function loadPhotos() {
  try { return JSON.parse(readLS(PHOTO_KEY)) || {}; } catch { return {}; }
}
function savePhotos(photos) {
  saveLS(PHOTO_KEY, JSON.stringify(photos));
}

// BMI 를 뭐라고 부를지.
//
// 「저체중 · 정상 · 과체중 · 비만」이 앱 안에 **네 군데** 복붙돼 있었다 —
// 인바디 입력 폼 · 인바디 목록 카드 · 여기, 그리고 눈금(`data/bodyRanges.js`).
// 8/25 에 몸에 등급을 안 매기기로 하고 눈금만 고쳤더니 나머지 셋이 다른 말을 했다.
// 이제 넷 다 눈금 하나를 본다.
function getBmiInfo(bmi) {
  if (!bmi) return { label: '-', color: 'var(--text-muted)' };
  const scale = scaleFor('bmi');
  const pos = scale ? positionOn(scale, Number(bmi)) : null;
  if (!pos?.band) return { label: '-', color: 'var(--text-muted)' };
  const tone = pos.band.tone;
  return {
    label: pos.band.label,
    color: tone === 'low' ? 'var(--info)' : tone === 'high' ? 'var(--warning)' : 'var(--success)',
  };
}

// 늘고 줆에 좋고 나쁨을 매기지 않는다. **방향만** 색으로 나눈다.
//
// 예전에는 항목마다 `reverse` 를 줘서 좋은 쪽 초록 · 나쁜 쪽 빨강으로 칠했다.
// 그런데 **체중은 `reverse={false}`** 였다 — 체중이 늘면 초록, 줄면 빨강이라는 뜻이다.
// 빼려고 오신 분에게는 정확히 거꾸로 말하고 있었다.
//
// 인바디 「얼마나 달라졌나」는 8/25 에 이미 방향만 칠하기로 했는데, 같은 앱의 「비교」가
// 반대로 하고 있었다. 무엇이 어느 쪽으로 갔는지만 보여준다.
function DiffValue({ label, before, after, unit }) {
  if (before == null || after == null) return null;
  const diff = (after - before).toFixed(1);
  const num = Number(diff);
  let color = 'var(--text-muted)';
  if (num > 0) color = 'var(--accent)';
  if (num < 0) color = 'var(--info)';

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{before}{unit}</span>
        <span style={{ fontSize: 16, color: 'var(--text-muted)' }}>→</span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{after}{unit}</span>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, color, letterSpacing: 1, minWidth: 55, textAlign: 'right' }}>
          {num > 0 ? '+' : ''}{diff}{unit}
        </span>
      </div>
    </div>
  );
}

function PhotoUpload({ label, photoKey, photos, setPhotos, accentBorder }) {
  const inputRef = useRef(null);
  const photo = photos[photoKey] || null;

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
    <div style={{ flex: 1 }}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 1.5, color: accentBorder ? 'var(--accent)' : 'var(--text-muted)', marginBottom: 6, textAlign: 'center' }}>
        {label}
      </div>
      {photo ? (
        <div style={{ position: 'relative' }}>
          <img
            src={photo}
            alt={label}
            style={{
              width: '100%',
              aspectRatio: '3/4',
              objectFit: 'cover',
              borderRadius: 'var(--radius)',
              border: `1px solid ${accentBorder ? 'var(--accent)' : 'var(--border)'}`,
            }}
          />
          <button
            className="delete-btn"
            onClick={handleDelete}
            style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.7)', borderRadius: 'var(--radius)', padding: '2px 6px' }}
          >
            ✕
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          style={{
            width: '100%',
            aspectRatio: '3/4',
            background: 'var(--bg-tertiary)',
            border: `1px dashed ${accentBorder ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 'var(--radius)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'pointer',
            transition: 'border-color 0.2s',
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

// 예시 데이터 (인바디 기록 없을 때 그래프용)
const SAMPLE_BEFORE = { weight: 78, fat_pct: 22, muscle_kg: 30, bmi: 25.1, water_l: 38 };
const SAMPLE_AFTER = { weight: 73, fat_pct: 16, muscle_kg: 33, bmi: 23.5, water_l: 41 };

export default function ComparePage() {
  const { records, loading, fetchAll } = useInbodyStore();
  const [beforeIdx, setBeforeIdx] = useState(null);
  const [afterIdx, setAfterIdx] = useState(null);
  const [photos, setPhotos] = useState(loadPhotos());

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    client.get('/photos').then(({ data }) => {
      if (!Array.isArray(data)) return;
      const before = data.find(p => p.type === 'before');
      const after = data.find(p => p.type === 'after');
      const serverPhotos = {};
      if (before) serverPhotos.before = before.data;
      if (after) serverPhotos.after = after.data;
      if (Object.keys(serverPhotos).length > 0) {
        setPhotos(serverPhotos);
        savePhotos(serverPhotos);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (records.length >= 2) {
      setBeforeIdx(records.length - 1);
      setAfterIdx(0);
    }
  }, [records]);

  const hasData = records.length >= 2;
  const before = hasData && beforeIdx !== null ? records[beforeIdx] : null;
  const after = hasData && afterIdx !== null ? records[afterIdx] : null;

  // 그래프용 데이터 (실제 데이터 or 예시)
  const graphBefore = before || SAMPLE_BEFORE;
  const graphAfter = after || SAMPLE_AFTER;
  const isExample = !before || !after;

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        로딩 중...
      </div>
    );
  }

  return (
    <div>
      <div className="section-title">
        <div className="accent-bar" />
        사진 비교
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <PhotoUpload label="BEFORE" photoKey="before" photos={photos} setPhotos={setPhotos} accentBorder={false} />
        <PhotoUpload label="AFTER" photoKey="after" photos={photos} setPhotos={setPhotos} accentBorder={true} />
      </div>

      {/* 인바디 데이터 있을 때: 날짜 선택 + 상세 비교 */}
      {hasData && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <label className="label">기존 (BEFORE)</label>
              <select className="input" value={beforeIdx ?? ''} onChange={(e) => setBeforeIdx(Number(e.target.value))}>
                {records.map((r, i) => (
                  <option key={`b-${r.id}`} value={i}>{r.date} ({r.weight}kg)</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="label">현재 (AFTER)</label>
              <select className="input" value={afterIdx ?? ''} onChange={(e) => setAfterIdx(Number(e.target.value))}>
                {records.map((r, i) => (
                  <option key={`a-${r.id}`} value={i}>{r.date} ({r.weight}kg)</option>
                ))}
              </select>
            </div>
          </div>

          {before && after && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
                <div className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 1.5, color: 'var(--text-muted)', marginBottom: 8 }}>BEFORE</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{before.date}</div>
                  <div className="stat-number" style={{ fontSize: 32 }}>{before.weight}<span style={{ fontSize: 14, color: 'var(--text-muted)' }}>kg</span></div>
                  {before.bmi && <div style={{ marginTop: 4 }}><span style={{ fontSize: 12, color: getBmiInfo(before.bmi).color }}>BMI {before.bmi} ({getBmiInfo(before.bmi).label})</span></div>}
                </div>
                <div className="card" style={{ textAlign: 'center', borderColor: 'var(--accent)' }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 1.5, color: 'var(--accent)', marginBottom: 8 }}>AFTER</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{after.date}</div>
                  <div className="stat-number" style={{ fontSize: 32 }}>{after.weight}<span style={{ fontSize: 14, color: 'var(--text-muted)' }}>kg</span></div>
                  {after.bmi && <div style={{ marginTop: 4 }}><span style={{ fontSize: 12, color: getBmiInfo(after.bmi).color }}>BMI {after.bmi} ({getBmiInfo(after.bmi).label})</span></div>}
                </div>
              </div>

              <div className="section-title">
                <div className="accent-bar" />
                상세 비교
              </div>
              <div className="card" style={{ marginBottom: 20 }}>
                <DiffValue label="체중" before={before.weight} after={after.weight} unit="kg" />
                <DiffValue label="체지방률" before={before.fat_pct} after={after.fat_pct} unit="%" />
                <DiffValue label="골격근량" before={before.muscle_kg} after={after.muscle_kg} unit="kg" />
                <DiffValue label="체수분" before={before.water_l} after={after.water_l} unit="L" />
                <DiffValue label="BMI" before={before.bmi} after={after.bmi} unit="" />
              </div>

              <div className="section-title">
                <div className="accent-bar" />
                종합 평가
              </div>
              <div className="card" style={{ marginBottom: 20 }}>
                {(() => {
                  const results = [];
                  if (before.weight != null && after.weight != null) {
                    const d = after.weight - before.weight;
                    if (d < -1) results.push({ text: `체중 ${Math.abs(d).toFixed(1)}kg 감량`, color: 'var(--success)' });
                    else if (d > 1) results.push({ text: `체중 ${d.toFixed(1)}kg 증가`, color: 'var(--warning)' });
                    else results.push({ text: '체중 유지', color: 'var(--text-secondary)' });
                  }
                  if (before.muscle_kg != null && after.muscle_kg != null) {
                    const d = after.muscle_kg - before.muscle_kg;
                    if (d > 0.5) results.push({ text: `골격근 ${d.toFixed(1)}kg 증가`, color: 'var(--success)' });
                    else if (d < -0.5) results.push({ text: `골격근 ${Math.abs(d).toFixed(1)}kg 감소`, color: 'var(--danger)' });
                    else results.push({ text: '골격근 유지', color: 'var(--text-secondary)' });
                  }
                  if (before.fat_pct != null && after.fat_pct != null) {
                    const d = after.fat_pct - before.fat_pct;
                    if (d < -1) results.push({ text: `체지방률 ${Math.abs(d).toFixed(1)}% 감소`, color: 'var(--success)' });
                    else if (d > 1) results.push({ text: `체지방률 ${d.toFixed(1)}% 증가`, color: 'var(--danger)' });
                    else results.push({ text: '체지방률 유지', color: 'var(--text-secondary)' });
                  }
                  if (results.length === 0) return <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>상세 데이터가 부족해요</div>;
                  return results.map((r, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 14, color: r.color, fontWeight: 500 }}>{r.text}</span>
                    </div>
                  ));
                })()}
              </div>
            </>
          )}
        </>
      )}

      {/* ── 그래프 ──
          기록이 두 개 미만이면 예시 숫자로 그린다. **그건 내 몸이 아니다.**
          예전에는 그래프를 다 그린 **뒤에** 작게 「예시」라고 붙였다 —
          다 보고 나서야 남의 숫자였다는 것을 알게 된다. 위로 올리고 분명히 적는다 */}
      <div className="section-title">
        <div className="accent-bar" />
        {isExample ? '이렇게 보입니다 (예시)' : '과거 vs 현재 수치 비교'}
      </div>

      {isExample && (
        <div className="card" style={{ borderLeft: '3px solid var(--warning)', marginBottom: 10 }}>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>
            아래 숫자는 제 것이 아닙니다
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            인바디를 두 번 이상 넣으시면 실제 기록으로 바뀝니다.
            지금은 화면이 어떻게 보이는지만 보여드리는 예시입니다.
          </div>
        </div>
      )}
      <div className="card" style={{ marginBottom: 20, padding: 12 }}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={[
            { name: '체중(kg)', before: graphBefore.weight, after: graphAfter.weight },
            ...(graphBefore.muscle_kg != null && graphAfter.muscle_kg != null ? [{ name: '골격근(kg)', before: graphBefore.muscle_kg, after: graphAfter.muscle_kg }] : []),
            ...(graphBefore.fat_pct != null && graphAfter.fat_pct != null ? [{ name: '체지방(%)', before: graphBefore.fat_pct, after: graphAfter.fat_pct }] : []),
            ...(graphBefore.bmi != null && graphAfter.bmi != null ? [{ name: 'BMI', before: graphBefore.bmi, after: graphAfter.bmi }] : []),
            ...(graphBefore.water_l != null && graphAfter.water_l != null ? [{ name: '체수분(L)', before: graphBefore.water_l, after: graphAfter.water_l }] : []),
          ]}>
            <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13 }} />
            <Legend formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{value === 'before' ? '과거' : '현재'}</span>} />
            <Bar dataKey="before" fill="#555" name="before" radius={[2, 2, 0, 0]} />
            <Bar dataKey="after" fill="#ff6b1a" name="after" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="section-title">
        <div className="accent-bar" />
        밸런스 비교
      </div>
      <div className="card" style={{ marginBottom: 20, padding: 12 }}>
        <ResponsiveContainer width="100%" height={260}>
          <RadarChart data={[
            { subject: '체중', before: graphBefore.weight, after: graphAfter.weight },
            ...(graphBefore.muscle_kg != null && graphAfter.muscle_kg != null ? [{ subject: '골격근', before: graphBefore.muscle_kg, after: graphAfter.muscle_kg }] : []),
            ...(graphBefore.fat_pct != null && graphAfter.fat_pct != null ? [{ subject: '체지방', before: graphBefore.fat_pct, after: graphAfter.fat_pct }] : []),
            ...(graphBefore.bmi != null && graphAfter.bmi != null ? [{ subject: 'BMI', before: graphBefore.bmi, after: graphAfter.bmi }] : []),
            ...(graphBefore.water_l != null && graphAfter.water_l != null ? [{ subject: '체수분', before: graphBefore.water_l, after: graphAfter.water_l }] : []),
          ]}>
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
            <PolarRadiusAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
            <Radar name="과거" dataKey="before" stroke="#555" fill="#555" fillOpacity={0.3} />
            <Radar name="현재" dataKey="after" stroke="#ff6b1a" fill="#ff6b1a" fillOpacity={0.3} />
            <Legend formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{value}</span>} />
            <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13 }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>


    </div>
  );
}
