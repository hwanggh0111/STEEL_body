import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkoutStore } from '../store/workoutStore';
import { useInbodyStore } from '../store/inbodyStore';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import StatBox from '../components/StatBox';
import Badges from '../components/Badges';
import LevelSystem from '../components/LevelSystem';
import CharacterAvatar from '../components/CharacterAvatar';
import WorkoutHeatmap from '../components/WorkoutHeatmap';
import WeatherWorkout from '../components/WeatherWorkout';
import MiniTapGame from '../components/MiniTapGame';
import MissionSystem from '../components/MissionSystem';
import LaunchEvent from '../components/LaunchEvent';
import { NOTICES, NOTICE_BADGE, getReadNotices, markNoticeRead } from '../data/notices';

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

// 공지사항 배너 (홈 상단 슬라이드)
function NoticeBanner({ onOpenPopup, onGoNotice }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const readList = getReadNotices();
  const unread = NOTICES.filter(n => !readList.includes(n.id));

  useEffect(() => {
    if (NOTICES.length <= 1) return;
    if (paused) return;
    const timer = setInterval(() => {
      setIdx(prev => (prev + 1) % NOTICES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [paused]);

  const notice = NOTICES[idx];
  if (!notice) return null;

  return (
    <div
      onClick={() => onOpenPopup(notice)}
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '10px 14px',
        marginBottom: 16,
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; setPaused(true); }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; setPaused(false); }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, overflow: 'hidden' }}>
        <span className={NOTICE_BADGE[notice.type] || 'badge badge-accent'} style={{ flexShrink: 0 }}>{notice.type}</span>
        <span style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {notice.title}
        </span>
        {unread.length > 0 && (
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', flexShrink: 0,
          }} />
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 8 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{idx + 1}/{NOTICES.length}</span>
        <span
          onClick={(e) => { e.stopPropagation(); onGoNotice(); }}
          style={{ fontSize: 11, color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
        >전체</span>
      </div>
    </div>
  );
}

// 공지사항 팝업
function NoticePopup({ notice, onClose, onGoNotice, remaining }) {
  if (!notice) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          width: '100%',
          maxWidth: 440,
          maxHeight: '80vh',
          overflow: 'auto',
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 2, color: 'var(--accent)' }}>
            {notice?.title}
          </div>
          <button onClick={onClose} className="delete-btn" style={{ fontSize: 18, padding: '8px 12px', minWidth: 40, minHeight: 40 }}>✕</button>
        </div>

        <div style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span className={NOTICE_BADGE[notice?.type] || 'badge badge-accent'}>{notice?.type}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{notice?.date}</span>
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>{notice?.content}</div>
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={onGoNotice}
            style={{
              background: 'none', border: 'none', color: 'var(--accent)',
              fontSize: 13, cursor: 'pointer', fontFamily: "'Barlow', sans-serif",
            }}
          >
            전체 공지 보기
          </button>
          {remaining > 0 && (
            <button
              onClick={onClose}
              style={{
                background: 'var(--accent)', border: 'none', color: '#000',
                fontSize: 12, cursor: 'pointer', fontWeight: 700,
                padding: '6px 14px', borderRadius: 'var(--radius)',
              }}
            >
              다음 공지 ({remaining}개 남음)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 식단 데이터 ───
const DIET_DATA = {
  벌크업: {
    목표: '근육량 증가, 칼로리 잉여',
    칼로리: '체중(kg) × 35~40 kcal',
    비율: '탄수화물 50% / 단백질 30% / 지방 20%',
    meals: {
      아침: [
        { name: '오트밀 + 바나나 + 프로틴', cal: '550kcal', desc: '오트밀 80g + 바나나 1개 + 프로틴 1스쿱 + 꿀' },
        { name: '계란 토스트 + 우유', cal: '500kcal', desc: '통밀빵 2장 + 계란 3개 스크램블 + 우유 300ml' },
        { name: '그릭요거트 + 그래놀라', cal: '450kcal', desc: '그릭요거트 200g + 그래놀라 60g + 블루베리' },
        { name: '팬케이크 + 프로틴', cal: '600kcal', desc: '통밀 팬케이크 3장 + 프로틴 1스쿱 + 메이플시럽' },
        { name: '감자 계란볶음 + 우유', cal: '520kcal', desc: '감자 1개 + 계란 3개 + 우유 300ml' },
        { name: '참치 주먹밥 + 우유', cal: '480kcal', desc: '잡곡밥 주먹밥 2개 + 참치 + 우유' },
        { name: '프렌치토스트 + 과일', cal: '530kcal', desc: '통밀빵 프렌치토스트 2장 + 계란 2개 + 바나나' },
        { name: '닭가슴살 샌드위치', cal: '500kcal', desc: '통밀빵 + 닭가슴살 100g + 양상추 + 치즈 + 우유' },
        { name: '바나나 프로틴 스무디', cal: '480kcal', desc: '바나나 2개 + 프로틴 1스쿱 + 우유 300ml + 땅콩버터' },
        { name: '계란찜 + 현미밥', cal: '470kcal', desc: '계란 4개 계란찜 + 현미밥 1.5공기' },
      ],
      점심: [
        { name: '닭가슴살 도시락', cal: '700kcal', desc: '현미밥 1.5공기 + 닭가슴살 200g + 브로콜리 + 고구마' },
        { name: '소고기 덮밥', cal: '750kcal', desc: '현미밥 1.5공기 + 소불고기 200g + 계란프라이 + 샐러드' },
        { name: '연어 포케볼', cal: '680kcal', desc: '밥 1.5공기 + 연어 150g + 아보카도 + 에다마메' },
        { name: '돼지불백 + 밥', cal: '720kcal', desc: '현미밥 1.5공기 + 돼지불백 200g + 반찬' },
        { name: '치킨 부리토', cal: '700kcal', desc: '통밀 또띠아 + 닭가슴살 200g + 밥 + 채소 + 소스' },
        { name: '참치 덮밥', cal: '650kcal', desc: '현미밥 1.5공기 + 참치회 150g + 아보카도 + 와사비' },
        { name: '갈비탕 + 밥', cal: '730kcal', desc: '갈비탕 + 현미밥 1.5공기' },
        { name: '비빔밥 + 계란프라이', cal: '680kcal', desc: '현미밥 1.5공기 + 나물 + 소고기 + 계란 2개' },
        { name: '오므라이스', cal: '700kcal', desc: '현미밥 + 계란 3개 + 닭가슴살 + 케첩' },
        { name: '제육볶음 + 밥', cal: '710kcal', desc: '현미밥 1.5공기 + 제육볶음 200g + 반찬' },
      ],
      저녁: [
        { name: '스테이크 + 고구마', cal: '650kcal', desc: '등심 스테이크 200g + 군고구마 1개 + 샐러드' },
        { name: '삼겹살 + 쌈', cal: '700kcal', desc: '삼겹살 200g + 쌈채소 + 현미밥 1공기' },
        { name: '파스타 + 닭가슴살', cal: '720kcal', desc: '통밀 파스타 120g + 닭가슴살 150g + 토마토소스' },
        { name: '연어 스테이크 + 밥', cal: '660kcal', desc: '연어 200g + 현미밥 1공기 + 샐러드' },
        { name: '돼지갈비 + 감자', cal: '700kcal', desc: '돼지갈비 200g + 구운 감자 + 야채' },
        { name: '닭다리살 구이 + 밥', cal: '680kcal', desc: '닭다리살 250g + 현미밥 1공기 + 브로콜리' },
        { name: '소고기 볶음밥', cal: '700kcal', desc: '현미밥 + 소고기 150g + 계란 + 야채 볶음밥' },
        { name: '참치 스테이크', cal: '620kcal', desc: '참치 스테이크 200g + 고구마 + 샐러드' },
        { name: '불닭 + 밥', cal: '690kcal', desc: '닭가슴살 불닭 + 현미밥 1.5공기' },
        { name: '햄버그스테이크', cal: '670kcal', desc: '수제 패티 200g + 밥 1공기 + 야채' },
      ],
      간식: [
        { name: '프로틴 쉐이크 + 바나나', cal: '350kcal', desc: '프로틴 1스쿱 + 우유 300ml + 바나나 1개' },
        { name: '삶은 계란 + 견과류', cal: '300kcal', desc: '삶은 계란 3개 + 아몬드 한 줌(30g)' },
        { name: '고구마 + 땅콩버터', cal: '320kcal', desc: '군고구마 1개 + 땅콩버터 1스푼' },
        { name: '프로틴바 + 우유', cal: '350kcal', desc: '프로틴바 1개 + 우유 200ml' },
        { name: '떡 + 꿀 + 프로틴', cal: '400kcal', desc: '떡 3개 + 꿀 + 프로틴 1스쿱 (운동 후)' },
        { name: '요거트 + 견과류 + 꿀', cal: '300kcal', desc: '그릭요거트 150g + 견과류 + 꿀 1스푼' },
        { name: '식빵 + 땅콩버터 + 바나나', cal: '380kcal', desc: '통밀 식빵 2장 + 땅콩버터 + 바나나' },
        { name: '참치 크래커', cal: '280kcal', desc: '통밀 크래커 + 참치캔 + 마요네즈 소량' },
        { name: '두유 + 프로틴', cal: '300kcal', desc: '두유 300ml + 프로틴 1스쿱' },
        { name: '치즈 + 과일', cal: '250kcal', desc: '모짜렐라 치즈 + 사과 1개' },
      ],
    },
  },
  다이어트: {
    목표: '체지방 감량, 칼로리 적자',
    칼로리: '체중(kg) × 25~30 kcal',
    비율: '탄수화물 40% / 단백질 40% / 지방 20%',
    meals: {
      아침: [
        { name: '계란흰자 오믈렛', cal: '280kcal', desc: '계란흰자 4개 + 시금치 + 토마토 + 통밀빵 1장' },
        { name: '프로틴 오트밀', cal: '300kcal', desc: '오트밀 40g + 프로틴 1스쿱 + 블루베리 한 줌' },
        { name: '두부 스크램블', cal: '250kcal', desc: '두부 반 모 + 야채 볶음 + 현미밥 반 공기' },
        { name: '아보카도 토스트', cal: '290kcal', desc: '통밀빵 1장 + 아보카도 반 개 + 계란 1개' },
        { name: '단호박 죽', cal: '220kcal', desc: '단호박 + 우유 소량. 포만감 높고 저칼로리' },
        { name: '닭가슴살 + 삶은 계란', cal: '260kcal', desc: '닭가슴살 100g + 삶은 계란 2개' },
        { name: '무지방 요거트 + 과일', cal: '200kcal', desc: '무지방 요거트 200g + 딸기 + 키위' },
        { name: '채소 계란말이', cal: '240kcal', desc: '계란 2개 + 파프리카 + 양파 + 시금치' },
        { name: '곤약 죽 + 닭가슴살', cal: '230kcal', desc: '곤약 + 닭가슴살 100g + 야채' },
        { name: '토마토 계란볶음', cal: '250kcal', desc: '토마토 2개 + 계란 2개 + 통밀빵 반 장' },
      ],
      점심: [
        { name: '닭가슴살 샐러드', cal: '400kcal', desc: '닭가슴살 200g + 혼합 샐러드 + 발사믹 드레싱' },
        { name: '곤약 비빔밥', cal: '350kcal', desc: '곤약밥 + 닭가슴살 150g + 나물 + 고추장 소량' },
        { name: '참치 김밥 (현미)', cal: '380kcal', desc: '현미밥 + 참치 + 야채 김밥 1줄' },
        { name: '닭가슴살 볶음밥 (곤약)', cal: '370kcal', desc: '곤약밥 + 닭가슴살 150g + 야채 볶음' },
        { name: '새우 샐러드', cal: '350kcal', desc: '새우 150g + 샐러드 + 레몬 드레싱' },
        { name: '소고기 샐러드', cal: '400kcal', desc: '소고기 100g + 야채 + 발사믹 소량' },
        { name: '두부 된장찌개 + 밥 반공기', cal: '380kcal', desc: '두부 된장찌개 + 현미밥 반 공기' },
        { name: '열무 곤약 비빔면', cal: '320kcal', desc: '곤약면 + 열무김치 + 계란 + 참기름' },
        { name: '닭가슴살 월남쌈', cal: '360kcal', desc: '라이스페이퍼 + 닭가슴살 + 야채 + 소스' },
        { name: '연어 샐러드 보울', cal: '390kcal', desc: '연어 100g + 퀴노아 + 야채 + 레몬' },
      ],
      저녁: [
        { name: '연어 + 야채구이', cal: '380kcal', desc: '연어 150g + 구운 야채(파프리카, 애호박, 양파)' },
        { name: '닭가슴살 스프', cal: '300kcal', desc: '닭가슴살 150g + 야채 수프 + 통밀빵 반 장' },
        { name: '두부 스테이크', cal: '320kcal', desc: '구운 두부 1모 + 버섯 + 샐러드' },
        { name: '새우 볶음 + 야채', cal: '330kcal', desc: '새우 200g + 브로콜리 + 파프리카 볶음' },
        { name: '닭가슴살 구이 + 샐러드', cal: '350kcal', desc: '닭가슴살 200g + 큰 샐러드' },
        { name: '계란국 + 밥 반공기', cal: '300kcal', desc: '계란 2개 국 + 현미밥 반 공기 + 반찬' },
        { name: '참치 스테이크', cal: '340kcal', desc: '참치 150g + 샐러드 + 레몬' },
        { name: '곤약 잡채', cal: '280kcal', desc: '곤약면 + 야채 + 소고기 소량' },
        { name: '오징어 볶음', cal: '310kcal', desc: '오징어 200g + 야채 + 고추장 소량' },
        { name: '소고기 미역국 + 밥 반공기', cal: '320kcal', desc: '소고기 미역국 + 현미밥 반 공기' },
      ],
      간식: [
        { name: '그릭요거트', cal: '120kcal', desc: '무지방 그릭요거트 150g + 스테비아' },
        { name: '삶은 계란 2개', cal: '140kcal', desc: '간편한 단백질 보충' },
        { name: '오이 + 당근 스틱', cal: '50kcal', desc: '저칼로리 간식, 씹는 맛으로 포만감' },
        { name: '방울토마토', cal: '30kcal', desc: '10개. 달콤하고 저칼로리' },
        { name: '곤약 젤리', cal: '10kcal', desc: '거의 0칼로리. 단맛 욕구 해소' },
        { name: '프로틴 바 (저칼)', cal: '170kcal', desc: '단백질 20g+ 저칼로리 프로틴바' },
        { name: '아몬드 10알', cal: '70kcal', desc: '건강한 지방. 소량만' },
        { name: '블랙커피', cal: '5kcal', desc: '카페인으로 식욕 억제 + 지방 분해' },
        { name: '사과 반 개', cal: '60kcal', desc: '식이섬유 풍부. 포만감' },
        { name: '두유 1팩', cal: '100kcal', desc: '식물성 단백질 + 포만감' },
      ],
    },
  },
  유지: {
    목표: '현재 체중 유지, 균형 잡힌 식단',
    칼로리: '체중(kg) × 30~33 kcal',
    비율: '탄수화물 45% / 단백질 30% / 지방 25%',
    meals: {
      아침: [
        { name: '토스트 + 계란 + 과일', cal: '400kcal', desc: '통밀빵 2장 + 계란 2개 + 사과 반 개' },
        { name: '시리얼 + 우유', cal: '380kcal', desc: '통곡물 시리얼 50g + 저지방 우유 300ml + 바나나' },
        { name: '주먹밥 + 된장국', cal: '420kcal', desc: '잡곡밥 주먹밥 2개 + 된장국 1그릇' },
        { name: '에그 베네딕트', cal: '430kcal', desc: '잉글리시 머핀 + 수란 2개 + 햄 + 소스' },
        { name: '참치 샌드위치', cal: '400kcal', desc: '통밀빵 + 참치 + 야채 + 마요 소량' },
        { name: '계란볶음밥', cal: '420kcal', desc: '현미밥 1공기 + 계란 2개 + 야채' },
        { name: '요거트 보울', cal: '380kcal', desc: '요거트 200g + 그래놀라 + 과일 + 꿀' },
        { name: '닭가슴살 토스트', cal: '390kcal', desc: '통밀빵 2장 + 닭가슴살 + 양상추 + 토마토' },
        { name: '미소된장국 + 밥', cal: '400kcal', desc: '미소된장국 + 잡곡밥 1공기 + 반찬' },
        { name: '크로크무슈', cal: '410kcal', desc: '식빵 + 햄 + 치즈 + 계란' },
      ],
      점심: [
        { name: '제육볶음 도시락', cal: '600kcal', desc: '현미밥 1공기 + 제육볶음 + 반찬 2종' },
        { name: '비빔밥', cal: '550kcal', desc: '잡곡밥 + 나물 + 계란 + 고추장' },
        { name: '김치찌개 + 밥', cal: '580kcal', desc: '김치찌개 1그릇 + 현미밥 1공기 + 반찬' },
        { name: '불고기 + 밥', cal: '600kcal', desc: '소불고기 150g + 현미밥 1공기 + 반찬' },
        { name: '치킨 샐러드 + 빵', cal: '550kcal', desc: '닭가슴살 샐러드 + 통밀빵 1개' },
        { name: '순두부찌개 + 밥', cal: '530kcal', desc: '순두부찌개 + 현미밥 1공기' },
        { name: '잡채밥', cal: '560kcal', desc: '잡채 + 현미밥 1공기' },
        { name: '된장찌개 + 생선구이', cal: '570kcal', desc: '된장찌개 + 고등어구이 + 밥 1공기' },
        { name: '카레라이스', cal: '580kcal', desc: '닭가슴살 카레 + 현미밥 1공기' },
        { name: '쌈밥 정식', cal: '560kcal', desc: '쌈채소 + 보쌈 + 밥 + 된장' },
      ],
      저녁: [
        { name: '고등어구이 + 밥', cal: '500kcal', desc: '고등어구이 1토막 + 현미밥 1공기 + 반찬' },
        { name: '닭볶음탕', cal: '520kcal', desc: '닭볶음탕 + 현미밥 1공기' },
        { name: '돼지갈비 + 쌈', cal: '550kcal', desc: '돼지갈비 150g + 쌈채소 + 밥 반 공기' },
        { name: '된장국 + 생선조림', cal: '480kcal', desc: '된장국 + 고등어조림 + 밥 1공기' },
        { name: '닭가슴살 카레', cal: '500kcal', desc: '닭가슴살 카레 + 현미밥 1공기' },
        { name: '소고기 미역국 + 밥', cal: '490kcal', desc: '소고기 미역국 + 현미밥 1공기' },
        { name: '두부조림 + 밥', cal: '460kcal', desc: '두부조림 + 현미밥 1공기 + 반찬' },
        { name: '순두부 + 밥', cal: '470kcal', desc: '해물 순두부 + 현미밥 1공기' },
        { name: '삼치구이 + 밥', cal: '480kcal', desc: '삼치구이 + 현미밥 1공기 + 나물' },
        { name: '콩나물국 + 제육', cal: '520kcal', desc: '콩나물국 + 제육볶음 소량 + 밥 1공기' },
      ],
      간식: [
        { name: '프로틴바 1개', cal: '200kcal', desc: '간편한 단백질 보충 + 간식' },
        { name: '고구마 1개', cal: '150kcal', desc: '복합 탄수화물, 포만감 높음' },
        { name: '우유 + 견과류', cal: '250kcal', desc: '우유 200ml + 견과류 한 줌' },
        { name: '바나나 1개', cal: '100kcal', desc: '운동 전 에너지 보충에 최적' },
        { name: '사과 + 땅콩버터', cal: '200kcal', desc: '사과 1개 + 땅콩버터 1스푼' },
        { name: '요거트 + 그래놀라', cal: '220kcal', desc: '요거트 150g + 그래놀라 소량' },
        { name: '삶은 계란 2개', cal: '140kcal', desc: '간편한 단백질 간식' },
        { name: '오렌지 주스', cal: '110kcal', desc: '비타민C 보충 + 상큼' },
        { name: '치즈 스틱', cal: '160kcal', desc: '스트링 치즈 2개. 단백질 + 칼슘' },
        { name: '에너지볼', cal: '180kcal', desc: '오트밀 + 땅콩버터 + 꿀 + 초코칩 볼' },
      ],
    },
  },
};

// ─── 운동 트렌드 데이터 ───
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

function TrendSection() {
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

const MEAL_TYPES = ['아침', '점심', '저녁', '간식'];

function DietSection() {
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

function getWeekDates() {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7));
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

// 초성 추출
function getChosung(str) {
  const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  return [...str].map(c => {
    const code = c.charCodeAt(0) - 0xAC00;
    if (code < 0 || code > 11171) return c;
    return CHO[Math.floor(code / 588)];
  }).join('');
}

function matchSearch(q, item) {
  const ql = q.toLowerCase();
  // 라벨, 키워드 직접 매칭
  if (item.label.toLowerCase().includes(ql)) return true;
  if (item.keywords.some(k => k.toLowerCase().includes(ql))) return true;
  // 초성 매칭
  const labelChosung = getChosung(item.label);
  if (labelChosung.includes(ql)) return true;
  if (item.keywords.some(k => getChosung(k).includes(ql))) return true;
  return false;
}

const SEARCH_ITEMS = [
  { label: '홈', keywords: ['홈', '메인', 'home', 'main', '대시보드', 'dashboard', '홈화면'], path: '/home', icon: '🏠' },
  { label: '루틴 추천', keywords: ['루틴', '추천', 'routine', '분할', '운동루틴', '프로그램', '루', '추'], path: '/routine', icon: '📋' },
  { label: '운동 기록', keywords: ['운동', '기록', 'workout', '세트', '횟수', '중량', 'record', '운', '기'], path: '/workout', icon: '🏋️' },
  { label: '인바디', keywords: ['인바디', 'inbody', '체중', '체지방', '골격근', '근육량', 'weight', 'body', '인', '체'], path: '/inbody', icon: '📊' },
  { label: '홈트레이닝', keywords: ['홈트', '홈트레이닝', 'home training', '맨몸', '집운동', '홈워크아웃', '트레이닝'], path: '/homeworkout', icon: '🏠' },
  { label: '운동 검색', keywords: ['검색', 'search', '운동찾기', '부위', '근육', '찾기'], path: '/search', icon: '🔍' },
  { label: '측정 시스템', keywords: ['측정', 'measure', '허리', '팔둘레', '가슴둘레', '사이즈', '시스템', '어깨', 'shoulder'], path: '/measure', icon: '📐' },
  { label: '히스토리', keywords: ['히스토리', 'history', '기록', '과거', '이력', '달력', '히'], path: '/history', icon: '📅' },
  { label: '공지사항', keywords: ['공지', '알림', 'notice', '소식', '업데이트', '공'], path: '/notice', icon: '📢' },
  { label: '식단', keywords: ['식단', '벌크업', '다이어트', '유지', 'diet', '칼로리', '단백질', '탄수화물', 'meal', 'bulk', 'cut', '식', '밥'], path: null, icon: '🍽️', scroll: 'diet' },
];

// ─── 전설 명언 ───
const LEGEND_QUOTES = [
  '"오늘도 전설은 운동한다."',
  '"왕좌는 비워두지 않는다."',
  '"무게가 무거운 게 아니라, 의지가 가벼운 거다."',
  '"쉬는 날도 전설은 전설이다."',
  '"1000일의 땀이 전설을 만든다."',
  '"포기란 전설의 사전에 없다."',
];

// ─── 불멸 명언 ───
const IMMORTAL_QUOTES = [
  '"신들조차 경외하는 의지."',
  '"시간을 초월한 자, 멈추지 않는다."',
  '"불멸은 재능이 아니라 집념이다."',
  '"우주가 끝나도 운동은 끝나지 않는다."',
  '"인간의 한계? 그건 네가 정한 거다."',
  '"2000일의 맹세, 영원히 계속된다."',
  '"이 세계의 끝에서, 나는 여전히 들어올린다."',
];

function LegendHome({ nickname, totalWorkouts }) {
  const quote = LEGEND_QUOTES[Math.floor(Math.random() * LEGEND_QUOTES.length)];
  return (
    <div style={{
      marginBottom: 20, borderRadius: 'var(--radius)', overflow: 'hidden',
      border: '1px solid #ffd700',
      background: 'linear-gradient(135deg, #1a1000, #2a1800, #1a1000)',
      position: 'relative',
    }}>
      {/* 불꽃 배경 */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(circle at 50% 80%, rgba(255,107,26,0.15) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      {/* 왕좌 + 칭호 */}
      <div style={{ padding: '20px 16px', textAlign: 'center', position: 'relative' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🏛️</div>
        <div style={{
          fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700,
          letterSpacing: 3,
          background: 'linear-gradient(135deg, #ffd700, #ff6b1a, #ffd700)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          marginBottom: 4,
        }}>𓆩 전설의 리프터 𓆪</div>
        <div style={{ fontSize: 13, color: '#ffd700', marginBottom: 12 }}>{nickname}</div>

        {/* 통계 - 황금 트로피 스타일 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#ffd700', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2,
              textShadow: '0 0 10px rgba(255,215,0,0.4)',
            }}>🏆 {totalWorkouts}</div>
            <div style={{ fontSize: 10, color: '#a08030' }}>총 운동</div>
          </div>
        </div>

        {/* 명언 */}
        <div style={{
          fontFamily: "'Playfair Display', serif", fontSize: 12, fontStyle: 'italic',
          color: '#c4a060', lineHeight: 1.6,
          borderTop: '1px solid rgba(255,215,0,0.2)', paddingTop: 12,
        }}>{quote}</div>
      </div>
    </div>
  );
}

function ImmortalHome({ nickname, totalWorkouts }) {
  const quote = IMMORTAL_QUOTES[Math.floor(Math.random() * IMMORTAL_QUOTES.length)];
  return (
    <div style={{
      marginBottom: 20, borderRadius: 'var(--radius)',
      border: '1px solid #8060ff',
      background: 'linear-gradient(135deg, #0a0020, #150030, #0a0020)',
      padding: '20px 16px', textAlign: 'center',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 8 }}>
        <span style={{ fontSize: 20, opacity: 0.6 }}>🏛️</span>
        <span style={{ fontSize: 44, filter: 'drop-shadow(0 0 12px rgba(100,50,255,0.6))' }}>🔱</span>
        <span style={{ fontSize: 20, opacity: 0.6 }}>🏛️</span>
      </div>
      <div style={{
        fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700,
        letterSpacing: 4, color: '#c0a0ff', marginBottom: 4,
      }}>𓆩 불멸의 리프터 𓆪</div>
      <div style={{ fontSize: 13, color: '#c0a0ff', marginBottom: 12 }}>{nickname}</div>
      <div style={{
        fontSize: 26, fontWeight: 700, fontFamily: "'Bebas Neue', sans-serif",
        color: '#c0a0ff', marginBottom: 12,
      }}>⚡ {totalWorkouts} <span style={{ fontSize: 10, color: '#6a5aaa' }}>총 운동</span></div>
      <div style={{
        fontFamily: "'Playfair Display', serif", fontSize: 12, fontStyle: 'italic',
        color: '#9080cc', borderTop: '1px solid rgba(100,50,255,0.2)', paddingTop: 12,
      }}>{quote}</div>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { workouts, loading: wLoading, fetchAll: fetchWorkouts } = useWorkoutStore();
  const { records, loading: iLoading, fetchAll: fetchInbody } = useInbodyStore();

  // 공지사항 state
  const [popupNotice, setPopupNotice] = useState(null);
  const [unreadQueue, setUnreadQueue] = useState([]);
  const [homeSearch, setHomeSearch] = useState('');
  const [searchHistory, setSearchHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ironlog_search_history')) || []; } catch { return []; }
  });
  const [searchFocused, setSearchFocused] = useState(false);

  const addSearchHistory = (label) => {
    const updated = [label, ...searchHistory.filter(h => h !== label)].slice(0, 10);
    setSearchHistory(updated);
    localStorage.setItem('ironlog_search_history', JSON.stringify(updated));
  };

  const removeSearchHistory = (label) => {
    const updated = searchHistory.filter(h => h !== label);
    setSearchHistory(updated);
    localStorage.setItem('ironlog_search_history', JSON.stringify(updated));
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('ironlog_search_history');
  };

  useEffect(() => {
    fetchWorkouts();
    fetchInbody();

    // 로그인 시 안 읽은 공지 전부 큐에 넣고 첫 번째부터 팝업
    const readList = getReadNotices();
    const unread = NOTICES.filter(n => !readList.includes(n.id));
    if (unread.length > 0) {
      setPopupNotice(unread[0]);
      markNoticeRead(unread[0].id);
      setUnreadQueue(unread.slice(1));
    }
  }, []);

  const handleOpenPopup = useCallback((notice) => {
    markNoticeRead(notice.id);
    setPopupNotice(notice);
  }, []);

  const handleClosePopup = useCallback(() => {
    // 큐에 남은 안 읽은 공지가 있으면 다음 공지 바로 표시
    if (unreadQueue.length > 0) {
      const next = unreadQueue[0];
      markNoticeRead(next.id);
      setPopupNotice(next);
      setUnreadQueue(prev => prev.slice(1));
    } else {
      setPopupNotice(null);
    }
  }, []);

  const handleGoNotice = useCallback(() => {
    setPopupNotice(null);
    navigate('/notice');
  }, [navigate]);

  const today = new Date().toISOString().split('T')[0];
  const todayWorkouts = workouts[today] || [];
  const weekDates = getWeekDates();
  const weekWorkoutDays = useMemo(() => weekDates.filter(d => workouts[d] && workouts[d].length > 0).length, [weekDates, workouts]);
  const totalWorkouts = useMemo(() => Object.values(workouts).flat().length, [workouts]);
  const latestInbody = records[0] || null;

  const loading = wLoading || iLoading;

  return (
    <div>
      {/* 오늘 날짜 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width="56" height="56" viewBox="0 0 60 60" fill="none">
            <defs><linearGradient id="hDbGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#ffd700"/><stop offset="100%" stopColor="#ff6b1a"/></linearGradient></defs>
            <rect x="12" y="27" width="36" height="6" rx="3" fill="url(#hDbGrad)"/>
            <rect x="6" y="18" width="8" height="24" rx="3" fill="url(#hDbGrad)"/>
            <rect x="1" y="22" width="7" height="16" rx="2.5" fill="url(#hDbGrad)" opacity="0.7"/>
            <rect x="46" y="18" width="8" height="24" rx="3" fill="url(#hDbGrad)"/>
            <rect x="52" y="22" width="7" height="16" rx="2.5" fill="url(#hDbGrad)" opacity="0.7"/>
            <rect x="14" y="28" width="32" height="2" rx="1" fill="#fff" opacity="0.15"/>
          </svg>
          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 42,
            fontWeight: 700,
            letterSpacing: 5,
            lineHeight: 1,
            background: 'linear-gradient(135deg, #ffd700, #ff6b1a, #ffd700)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 12px rgba(255,107,26,0.3))',
          }}>
            STEEL BODY
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          로딩 중...
        </div>
      ) : (
        <>
          {/* 공지사항 배너 */}
          <NoticeBanner onOpenPopup={handleOpenPopup} onGoNotice={handleGoNotice} />




          {/* 출시 기념 이벤트 (배너만) */}
          <div className="card clickable" onClick={() => navigate('/event')} style={{
            marginBottom: 16, padding: 16, textAlign: 'center',
            background: 'linear-gradient(135deg, #1a1000, #2a1500)',
            border: '1px solid #ffd700',
          }}>
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 3,
              background: 'linear-gradient(135deg, #ffd700, #ff6b1a)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              marginBottom: 4,
            }}>GRAND LAUNCH EVENT</div>
            <div style={{ fontSize: 12, color: '#c4a060' }}>
              {(() => {
                const launch = new Date('2026-04-22');
                const now = new Date();
                const diff = Math.ceil((launch - now) / (1000 * 60 * 60 * 24));
                return diff > 0 ? `D-${diff}` : diff === 0 ? 'D-DAY!' : `D+${Math.abs(diff)}`;
              })()}
              {' · '}터치하여 이벤트 참여
            </div>
          </div>

          {/* 오늘의 요약 */}
          <div className="section-title">
            <div className="accent-bar" />
            오늘의 요약
          </div>

          {todayWorkouts.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>💪</div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>아직 오늘 운동 기록이 없어요</div>
              <button
                className="btn-primary"
                style={{ marginTop: 12, fontSize: 14, padding: '10px 20px', width: 'auto' }}
                onClick={() => navigate('/workout')}
              >
                운동 기록하기
              </button>
            </div>
          ) : (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1.5, color: 'var(--accent)', marginBottom: 8 }}>
                오늘 {todayWorkouts.length}개 운동 완료
              </div>
              {todayWorkouts.map((w) => (
                <div key={w.id} style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '3px 0' }}>
                  {w.exercise} — {w.weight} · {w.sets}세트 · {w.reps}회
                </div>
              ))}
            </div>
          )}

          {/* 통계 박스 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
            <StatBox number={`${weekWorkoutDays}/7`} label="이번 주" />
            <StatBox number={totalWorkouts} label="총 운동" />
            <StatBox number={latestInbody ? `${latestInbody.weight}` : '-'} label="최근 체중(kg)" />
          </div>

          {/* 레벨 시스템 */}
          <div className="section-title">
            <div className="accent-bar" />
            MY LEVEL
          </div>
          <LevelSystem totalWorkouts={totalWorkouts} totalInbody={records.length} />

          {/* 미션 */}
          <div className="section-title">
            <div className="accent-bar" />
            MISSIONS
          </div>
          <MissionSystem workouts={workouts} records={records} weekDates={weekDates} />

          {/* 이번 주 달력 */}
          <div className="section-title">
            <div className="accent-bar" />
            이번 주 운동
          </div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center' }}>
              {weekDates.map((d, i) => {
                const dayIdx = new Date(d).getDay();
                const hasWorkout = workouts[d] && workouts[d].length > 0;
                const isToday = d === today;
                return (
                  <div key={d} style={{ padding: '8px 0' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                      {DAYS[dayIdx]}
                    </div>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto',
                      fontSize: 13,
                      fontWeight: isToday ? 700 : 400,
                      background: hasWorkout ? 'var(--accent)' : isToday ? 'var(--bg-tertiary)' : 'none',
                      color: hasWorkout ? '#000' : isToday ? 'var(--accent)' : 'var(--text-muted)',
                      border: isToday && !hasWorkout ? '1px solid var(--accent)' : 'none',
                    }}>
                      {d.slice(8)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 성취 뱃지 */}
          <div className="section-title">
            <div className="accent-bar" />
            성취 뱃지
          </div>
          <div className="card" style={{ marginBottom: 20 }}>
            <Badges workouts={workouts} inbodyRecords={records} />
          </div>

          {/* 퀵 액션 */}
          <div className="section-title">
            <div className="accent-bar" />
            빠른 이동
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[
              { icon: '🏋️', label: '기록', path: '/workout' },
              { icon: '📊', label: '인바디', path: '/inbody' },
              { icon: '📋', label: '루틴', path: '/routine' },
              { icon: '🏠', label: '홈트', path: '/homeworkout' },
              { icon: '🔍', label: '검색', path: '/search' },
              { icon: '📐', label: '측정', path: '/measure' },
              { icon: '📅', label: '히스토리', path: '/history' },
              { icon: '🎮', label: '미니게임', path: '/game' },
            ].map((q, i) => (
              <div key={q.label} className="card clickable" onClick={() => {
                if (q.scroll) {
                  document.getElementById(q.scroll)?.scrollIntoView({ behavior: 'smooth' });
                } else {
                  navigate(q.path);
                }
              }} style={{ textAlign: 'center', padding: '12px 6px' }}>
                <div style={{ fontSize: 20, marginBottom: 2 }}>{q.icon}</div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 11, letterSpacing: 1 }}>{q.label}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 공지사항 팝업 */}
      <NoticePopup
        notice={popupNotice}
        onClose={handleClosePopup}
        onGoNotice={handleGoNotice}
        remaining={unreadQueue.length}
      />
    </div>
  );
}
