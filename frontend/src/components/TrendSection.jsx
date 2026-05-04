import { useState } from 'react';

const TRENDS = {
  '요즘 핫한 운동': [
    { name: '12-3-30 트레드밀', tag: '유산소', desc: '경사 12도, 속도 3마일, 30분 걷기. 틱톡에서 폭발한 저강도 유산소. 러닝보다 관절 부담 적고 지방 연소 효과 뛰어남.' },
    { name: '하이록스 (HYROX)', tag: '크로스핏', desc: '달리기 + 기능성 운동 8종목을 번갈아 수행하는 피트니스 대회. 전 세계 대회 개최 중. 누구나 참가 가능.' },
    { name: '존2 유산소', tag: '유산소', desc: '심박수 존2(최대심박 60~70%)를 유지하며 오래 걷기/달리기. 미토콘드리아 강화, 체지방 연소에 최적화.' },
    { name: '필라테스 리포머', tag: '필라테스', desc: '리포머 기구로 저항 운동. 코어 강화 + 자세 교정 + 유연성. 남녀 불문 인기 급상승.' },
    { name: '케틀벨 플로우', tag: '전신', desc: '케틀벨 동작을 끊김 없이 연결하는 플로우 운동. 근력 + 유산소 + 협응력을 한 번에.' },
  ],
  '챌린지': [
    { name: '75 하드 챌린지', tag: '멘탈', desc: '75일 동안 매일: 45분 실외운동 + 45분 실내운동 + 다이어트 + 물 4L + 독서 10페이지 + 프로그레스 사진. 정신력 극한 테스트.' },
    { name: '30일 플랭크 챌린지', tag: '코어', desc: '1일차 20초 → 30일차 5분까지 매일 플랭크 시간 늘리기. 코어 강화 입문자에게 최적.' },
    { name: '100일 스쿼트 챌린지', tag: '하체', desc: '매일 스쿼트 100개. 한 번에 안 해도 되고 나눠서 OK. 하체 근지구력 + 습관 형성.' },
    { name: '만보 챌린지', tag: '유산소', desc: '매일 10,000보 걷기. 활동량 부족한 현대인에게 가장 현실적인 유산소 방법.' },
    { name: '푸시업 프로그레션', tag: '상체', desc: '벽 푸시업 → 무릎 → 일반 → 다이아몬드 → 한 팔까지. 단계별로 올려가는 맨몸 상체 챌린지.' },
  ],
  '계절 추천': [
    { name: '아침 공복 걷기', tag: '봄', desc: '봄 날씨에 공복 30분 걷기. 존2 유산소 효과 + 비타민D 합성 + 기분 전환.' },
    { name: '수영', tag: '여름', desc: '전신 유산소 + 관절 부담 제로. 여름 시즌 체지방 커팅에 최적.' },
    { name: '등산/트레일러닝', tag: '가을', desc: '선선한 날씨에 산 타기. 하체 근력 + 심폐지구력 + 정신 건강.' },
    { name: '실내 로잉머신', tag: '겨울', desc: '추운 날 실내에서 전신 유산소. 등 + 하체 + 코어 동시 자극.' },
    { name: '요가/스트레칭', tag: '사계절', desc: '계절 무관 필수 루틴. 유연성 + 회복력 + 부상 예방. 운동 전후 10분이면 충분.' },
  ],
  '분야별 트렌드': [
    { name: '파워빌딩', tag: '헬스', desc: '파워리프팅(고중량) + 보디빌딩(고반복) 결합. 힘도 키우고 근육도 키우는 하이브리드 훈련.' },
    { name: '애니멀 플로우', tag: '맨몸', desc: '동물 움직임을 모방한 맨몸 운동. 유연성 + 근력 + 가동성을 동시에 발달.' },
    { name: '러닝 크루', tag: '러닝', desc: '함께 뛰는 러닝 크루 문화 확산. 사회성 + 동기부여 + 일관성 확보.' },
    { name: '마인드풀 리프팅', tag: '헬스', desc: '마인드-머슬 커넥션에 집중하는 훈련법. 무거운 무게보다 근육 자극 품질을 중시.' },
    { name: '짧은 고강도 (SIT)', tag: '유산소', desc: 'Sprint Interval Training. 20초 전력질주 + 10초 휴식 × 8세트. 단 4분으로 유산소 효과 극대화.' },
  ],
};

const TREND_CATS = Object.keys(TRENDS);

export default function TrendSection() {
  const [cat, setCat] = useState(TREND_CATS[0]);
  const [openIdx, setOpenIdx] = useState(null);

  const items = TRENDS[cat];

  return (
    <div style={{ marginBottom: 20 }}>
      <div className="section-title">
        <div className="accent-bar" />
        운동 트렌드
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto' }}>
        {TREND_CATS.map((c) => (
          <button
            key={c}
            className={`btn-secondary${cat === c ? ' active' : ''}`}
            onClick={() => { setCat(c); setOpenIdx(null); }}
            style={{ fontSize: 11, padding: '5px 12px', whiteSpace: 'nowrap' }}
          >
            {c}
          </button>
        ))}
      </div>

      {items.map((item, i) => (
        <div
          key={item.name}
          className="card"
          style={{ marginBottom: 6, cursor: 'pointer', borderColor: openIdx === i ? 'var(--accent)' : 'var(--border)' }}
          onClick={() => setOpenIdx(openIdx === i ? null : i)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 1.5 }}>{item.name}</span>
              <span className="badge badge-accent">{item.tag}</span>
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', transform: openIdx === i ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▼</span>
          </div>
          {openIdx === i && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              {item.desc}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
