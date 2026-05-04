import { useState } from 'react';
import { DIET_DATA, MEAL_TYPES } from '../data/dietData';

export default function DietSection() {
  const [goal, setGoal] = useState('벌크업');
  const [openMeal, setOpenMeal] = useState(null);

  const diet = DIET_DATA[goal];

  return (
    <div style={{ marginBottom: 20 }}>
      <div className="section-title">
        <div className="accent-bar" />
        식단 추천
      </div>

      {/* 목적 선택 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {Object.keys(DIET_DATA).map((g) => (
          <button
            key={g}
            className={`btn-secondary${goal === g ? ' active' : ''}`}
            onClick={() => { setGoal(g); setOpenMeal(null); }}
            style={{ fontSize: 12, padding: '6px 14px' }}
          >
            {g}
          </button>
        ))}
      </div>

      {/* 목표 정보 */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
          🎯 {diet.목표}
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12 }}>
          <span>📊 {diet.칼로리}</span>
          <span>⚖️ {diet.비율}</span>
        </div>
      </div>

      {/* 끼니별 추천 */}
      {MEAL_TYPES.map((meal) => {
        const isOpen = openMeal === meal;
        const items = diet.meals[meal];
        // 랜덤 대신 날짜 기반으로 오늘의 추천 선택
        // 날짜 + 끼니 조합으로 매일 다른 메뉴
        const day = new Date().getDate();
        const mealOffset = { '아침': 0, '점심': 3, '저녁': 7, '간식': 5 }[meal] || 0;
        const todayIdx = (day + mealOffset) % items.length;
        const todayPick = items[todayIdx];

        return (
          <div key={meal} className="card" style={{ marginBottom: 6, borderColor: isOpen ? 'var(--accent)' : 'var(--border)', cursor: 'pointer' }}>
            <div onClick={() => setOpenMeal(isOpen ? null : meal)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 1.5 }}>{meal}</span>
                  <span className="badge badge-accent">{todayPick.cal}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {todayPick.name}
                </div>
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▼</span>
            </div>

            {isOpen && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                {items.map((item, i) => (
                  <div key={i} style={{ padding: '8px 0', borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: i === todayIdx ? 600 : 400, color: i === todayIdx ? 'var(--accent)' : 'var(--text-primary)' }}>
                        {i === todayIdx ? '⭐ ' : ''}{item.name}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.cal}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
