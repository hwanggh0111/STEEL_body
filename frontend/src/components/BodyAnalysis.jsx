import { useState, useMemo } from 'react';

// 부위별 분석 로직
function analyzeBody(record) {
  if (!record) return null;
  const { weight, height, fat_pct, muscle_kg, water_l, bmi } = record;
  const parts = [];

  // BMI 기반 전체 분석
  if (bmi) {
    if (bmi >= 25) {
      parts.push({ id: 'torso', label: '복부/상체', color: '#e84040', status: 'bad',
        title: '과체중 상태', desc: `BMI ${bmi}로 과체중입니다. 복부에 지방이 축적되기 쉬운 상태로, 유산소 운동과 식단 조절이 필요합니다.` });
    } else if (bmi < 18.5) {
      parts.push({ id: 'torso', label: '복부/상체', color: '#4a9aff', status: 'warning',
        title: '저체중 상태', desc: `BMI ${bmi}로 저체중입니다. 충분한 영양 섭취와 근력 운동으로 체중을 늘리는 것이 좋습니다.` });
    } else {
      parts.push({ id: 'torso', label: '복부/상체', color: '#3a9e3a', status: 'good',
        title: '정상 체중', desc: `BMI ${bmi}로 정상 범위입니다. 현재 상태를 잘 유지하고 있어요!` });
    }
  }

  // 체지방률 분석
  if (fat_pct) {
    if (fat_pct >= 25) {
      parts.push({ id: 'belly', label: '복부 지방', color: '#e84040', status: 'bad',
        title: '체지방률 높음', desc: `체지방률 ${fat_pct}%로 높은 편입니다. 내장지방 위험이 있으며, 유산소 운동(주 3-5회, 30분 이상)과 탄수화물 섭취 조절을 권장합니다.` });
    } else if (fat_pct >= 20) {
      parts.push({ id: 'belly', label: '복부 지방', color: '#e8a020', status: 'warning',
        title: '체지방률 주의', desc: `체지방률 ${fat_pct}%로 약간 높은 편입니다. 꾸준한 운동으로 관리하면 충분히 개선할 수 있습니다.` });
    } else if (fat_pct < 10) {
      parts.push({ id: 'belly', label: '복부 지방', color: '#4a9aff', status: 'warning',
        title: '체지방률 매우 낮음', desc: `체지방률 ${fat_pct}%로 매우 낮습니다. 호르몬 불균형이나 면역력 저하 위험이 있으니 적정 수준을 유지하세요.` });
    } else {
      parts.push({ id: 'belly', label: '복부 지방', color: '#3a9e3a', status: 'good',
        title: '체지방률 정상', desc: `체지방률 ${fat_pct}%로 건강한 범위입니다. 잘 관리하고 있어요!` });
    }
  }

  // 골격근량 분석
  if (muscle_kg && weight) {
    const muscleRatio = (muscle_kg / weight) * 100;
    if (muscleRatio < 35) {
      parts.push({ id: 'arms', label: '팔 근육', color: '#e84040', status: 'bad',
        title: '상체 근육 부족', desc: `골격근 비율 ${muscleRatio.toFixed(1)}%로 낮습니다. 팔, 어깨, 가슴 등 상체 근력 운동을 강화하세요. 벤치프레스, 덤벨 컬, 숄더프레스를 추천합니다.` });
      parts.push({ id: 'legs', label: '하체 근육', color: '#e8a020', status: 'warning',
        title: '하체 근육 보강 필요', desc: `전체 근육량이 부족합니다. 스쿼트, 레그프레스, 런지 등 하체 운동을 병행하면 기초대사량이 크게 올라갑니다.` });
    } else if (muscleRatio < 40) {
      parts.push({ id: 'arms', label: '팔 근육', color: '#e8a020', status: 'warning',
        title: '상체 근육 보통', desc: `골격근 비율 ${muscleRatio.toFixed(1)}%로 평균적입니다. 점진적 과부하 원칙으로 근력을 키워보세요.` });
      parts.push({ id: 'legs', label: '하체 근육', color: '#3a9e3a', status: 'good',
        title: '하체 근육 양호', desc: '하체 근육은 양호한 편입니다. 현재 루틴을 유지하세요.' });
    } else {
      parts.push({ id: 'arms', label: '팔 근육', color: '#3a9e3a', status: 'good',
        title: '상체 근육 우수', desc: `골격근 비율 ${muscleRatio.toFixed(1)}%로 우수합니다! 멋진 근육량이에요.` });
      parts.push({ id: 'legs', label: '하체 근육', color: '#3a9e3a', status: 'good',
        title: '하체 근육 우수', desc: '전체적으로 근육량이 훌륭합니다. 꾸준히 유지하세요!' });
    }
  }

  // 체수분 분석
  if (water_l && weight) {
    const waterPct = (water_l / weight) * 100;
    if (waterPct < 50) {
      parts.push({ id: 'water', label: '체수분', color: '#e8a020', status: 'warning',
        title: '수분 부족', desc: `체수분 비율 ${waterPct.toFixed(1)}%로 부족합니다. 하루 2L 이상 물을 마시고, 운동 전후 수분 보충을 신경 쓰세요. 수분 부족은 근육 회복을 방해합니다.` });
    } else if (waterPct < 55) {
      parts.push({ id: 'water', label: '체수분', color: '#3a9e3a', status: 'good',
        title: '수분 상태 양호', desc: `체수분 비율 ${waterPct.toFixed(1)}%로 적정 범위입니다.` });
    } else {
      parts.push({ id: 'water', label: '체수분', color: '#3a9e3a', status: 'good',
        title: '수분 상태 우수', desc: `체수분 비율 ${waterPct.toFixed(1)}%로 충분합니다!` });
    }
  }

  return parts;
}

function getOverallGrade(parts) {
  if (!parts || parts.length === 0) return null;
  const badCount = parts.filter(p => p.status === 'bad').length;
  const warningCount = parts.filter(p => p.status === 'warning').length;
  if (badCount >= 2) return { grade: 'D', color: '#e84040', msg: '개선이 많이 필요해요. 운동과 식단을 함께 관리하세요!' };
  if (badCount >= 1) return { grade: 'C', color: '#e8a020', msg: '일부 항목이 좋지 않아요. 집중 관리가 필요합니다.' };
  if (warningCount >= 2) return { grade: 'B', color: '#e8a020', msg: '나쁘지 않지만 개선의 여지가 있어요.' };
  if (warningCount >= 1) return { grade: 'B+', color: '#4a9aff', msg: '전반적으로 양호합니다. 조금만 더 신경 쓰세요!' };
  return { grade: 'A', color: '#3a9e3a', msg: '훌륭한 상태입니다! 지금처럼 유지하세요!' };
}

export default function BodyAnalysis({ record }) {
  const [selected, setSelected] = useState(null);
  const parts = useMemo(() => analyzeBody(record), [record]);
  const overall = useMemo(() => getOverallGrade(parts), [parts]);

  if (!parts || parts.length === 0) return null;

  // 부위별 색상 매핑
  const colorMap = useMemo(() => {
    const map = {};
    parts.forEach(p => { map[p.id] = p.color; });
    return map;
  }, [parts]);

  const headColor = colorMap['torso'] || '#555';
  const torsoColor = colorMap['torso'] || '#555';
  const bellyColor = colorMap['belly'] || torsoColor;
  const armColor = colorMap['arms'] || '#555';
  const legColor = colorMap['legs'] || '#555';

  const selectedPart = selected ? parts.find(p => p.id === selected) : null;

  return (
    <div>
      {/* 종합 등급 */}
      {overall && (
        <div className="card" style={{ marginBottom: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${overall.color}20`, border: `2px solid ${overall.color}`,
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: overall.color, letterSpacing: 1,
          }}>
            {overall.grade}
          </div>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1.5, color: overall.color, marginBottom: 2 }}>
              BODY SCORE
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{overall.msg}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* SVG 사람 형상 */}
        <div style={{ flex: '0 0 160px', display: 'flex', justifyContent: 'center' }}>
          <svg viewBox="0 0 200 420" width="160" height="380">
            {/* 머리 */}
            <ellipse cx="100" cy="40" rx="28" ry="32"
              fill={`${headColor}30`} stroke={headColor} strokeWidth="2"
              style={{ cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => setSelected('torso')}
            />

            {/* 목 */}
            <rect x="90" y="70" width="20" height="15" rx="4"
              fill={`${torsoColor}30`} stroke={torsoColor} strokeWidth="1.5" />

            {/* 어깨~상체 */}
            <path d="M60 85 Q60 95 50 105 L50 170 Q50 180 60 180 L80 180 L80 85 Z"
              fill={`${armColor}25`} stroke={armColor} strokeWidth="1.5"
              style={{ cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => setSelected('arms')}
            />
            <path d="M140 85 Q140 95 150 105 L150 170 Q150 180 140 180 L120 180 L120 85 Z"
              fill={`${armColor}25`} stroke={armColor} strokeWidth="1.5"
              style={{ cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => setSelected('arms')}
            />

            {/* 몸통 (상체) */}
            <path d="M80 85 L120 85 Q125 85 125 90 L125 160 Q125 165 120 165 L80 165 Q75 165 75 160 L75 90 Q75 85 80 85 Z"
              fill={`${torsoColor}25`} stroke={torsoColor} strokeWidth="2"
              style={{ cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => setSelected('torso')}
            />

            {/* 복부 */}
            <path d="M78 165 L122 165 Q125 165 125 170 L122 220 Q115 230 100 230 Q85 230 78 220 L75 170 Q75 165 78 165 Z"
              fill={`${bellyColor}30`} stroke={bellyColor} strokeWidth="2"
              style={{ cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => setSelected('belly')}
            />

            {/* 팔 (전완) */}
            <path d="M46 180 L54 180 L52 240 Q50 248 48 240 Z"
              fill={`${armColor}25`} stroke={armColor} strokeWidth="1.5"
              style={{ cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => setSelected('arms')}
            />
            <path d="M146 180 L154 180 L152 240 Q150 248 148 240 Z"
              fill={`${armColor}25`} stroke={armColor} strokeWidth="1.5"
              style={{ cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => setSelected('arms')}
            />

            {/* 손 */}
            <ellipse cx="50" cy="248" rx="7" ry="9" fill={`${armColor}20`} stroke={armColor} strokeWidth="1" />
            <ellipse cx="150" cy="248" rx="7" ry="9" fill={`${armColor}20`} stroke={armColor} strokeWidth="1" />

            {/* 허벅지 */}
            <path d="M82 230 L98 230 L95 310 Q92 318 85 310 Z"
              fill={`${legColor}25`} stroke={legColor} strokeWidth="1.5"
              style={{ cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => setSelected('legs')}
            />
            <path d="M102 230 L118 230 L115 310 Q112 318 105 310 Z"
              fill={`${legColor}25`} stroke={legColor} strokeWidth="1.5"
              style={{ cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => setSelected('legs')}
            />

            {/* 종아리 */}
            <path d="M86 315 L96 315 L94 380 Q92 385 88 380 Z"
              fill={`${legColor}20`} stroke={legColor} strokeWidth="1.5"
              style={{ cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => setSelected('legs')}
            />
            <path d="M106 315 L116 315 L114 380 Q112 385 108 380 Z"
              fill={`${legColor}20`} stroke={legColor} strokeWidth="1.5"
              style={{ cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => setSelected('legs')}
            />

            {/* 발 */}
            <ellipse cx="91" cy="390" rx="10" ry="6" fill={`${legColor}15`} stroke={legColor} strokeWidth="1" />
            <ellipse cx="111" cy="390" rx="10" ry="6" fill={`${legColor}15`} stroke={legColor} strokeWidth="1" />

            {/* 체수분 표시 (물방울 아이콘) */}
            {colorMap['water'] && (
              <g onClick={() => setSelected('water')} style={{ cursor: 'pointer' }}>
                <path d="M170 130 Q170 120 175 110 Q180 120 180 130 Q180 137 175 137 Q170 137 170 130 Z"
                  fill={colorMap['water']} opacity="0.6" />
                <text x="175" y="155" textAnchor="middle" fill={colorMap['water']} fontSize="9"
                  fontFamily="Barlow, sans-serif" fontWeight="600">H2O</text>
              </g>
            )}
          </svg>
        </div>

        {/* 부위별 상태 리스트 */}
        <div style={{ flex: 1 }}>
          {parts.map((part, i) => (
            <div key={i}
              className="card"
              onClick={() => setSelected(selected === part.id ? null : part.id)}
              style={{
                marginBottom: 6, padding: '10px 12px', cursor: 'pointer',
                borderColor: selected === part.id ? part.color : 'var(--border)',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', background: part.color,
                  boxShadow: `0 0 6px ${part.color}80`,
                }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
                  {part.label}
                </span>
                <span style={{
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: 11, letterSpacing: 1,
                  color: part.color, padding: '2px 8px',
                  background: `${part.color}15`, borderRadius: 'var(--radius)',
                }}>
                  {part.status === 'good' ? 'GOOD' : part.status === 'warning' ? 'WARN' : 'BAD'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 선택된 부위 상세 설명 */}
      {selectedPart && (
        <div className="card" style={{
          marginTop: 12, padding: 16,
          borderColor: selectedPart.color,
          borderLeft: `3px solid ${selectedPart.color}`,
          animation: 'pageIn 0.2s ease',
        }}>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1.5,
            color: selectedPart.color, marginBottom: 6,
          }}>
            {selectedPart.title}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            {selectedPart.desc}
          </div>
        </div>
      )}
    </div>
  );
}
