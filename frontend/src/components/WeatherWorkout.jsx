import { useState, useEffect } from 'react';
import { useLangStore } from '../store/langStore';

const CITIES = [
  { ko: '내 위치', en: 'My Location', lat: null, lng: null, isGps: true },
  { ko: '서울', en: 'Seoul', lat: 37.5665, lng: 126.978 },
  { ko: '부산', en: 'Busan', lat: 35.1796, lng: 129.0756 },
  { ko: '대구', en: 'Daegu', lat: 35.8714, lng: 128.6014 },
  { ko: '인천', en: 'Incheon', lat: 37.4563, lng: 126.7052 },
  { ko: '광주', en: 'Gwangju', lat: 35.1595, lng: 126.8526 },
  { ko: '대전', en: 'Daejeon', lat: 36.3504, lng: 127.3845 },
  { ko: '울산', en: 'Ulsan', lat: 35.5384, lng: 129.3114 },
  { ko: '제주', en: 'Jeju', lat: 33.4996, lng: 126.5312 },
];

const TEXT = {
  ko: {
    title: 'TODAY WORKOUT',
    subtitle: '날씨 기반 운동 추천',
    loading: '날씨 정보를 불러오는 중...',
    error: '날씨 정보를 불러올 수 없습니다',
    temp: '현재 온도',
    recommend: '추천 운동',
    clear: ['러닝', '자전거', '야외 서킷'],
    cloudy: ['파워워킹', '배드민턴', '실내 스트레칭'],
    rainy: ['헬스장 웨이트', '홈트레이닝', '요가'],
    cold: ['실내 HIIT', '크로스핏', '줄넘기'],
    hot: ['수영', '실내 유산소', '필라테스'],
    clearDesc: '야외 운동하기 좋은 날!',
    cloudyDesc: '가벼운 활동 추천',
    rainyDesc: '실내 운동이 최고!',
    coldDesc: '실내에서 땀 빼기',
    hotDesc: '시원하게 운동하자',
  },
  en: {
    title: 'TODAY WORKOUT',
    subtitle: 'Weather-based Recommendation',
    loading: 'Loading weather...',
    error: 'Failed to load weather',
    temp: 'Current Temp',
    recommend: 'Recommended',
    clear: ['Running', 'Cycling', 'Outdoor Circuit'],
    cloudy: ['Power Walking', 'Badminton', 'Indoor Stretch'],
    rainy: ['Gym Weights', 'Home Training', 'Yoga'],
    cold: ['Indoor HIIT', 'CrossFit', 'Jump Rope'],
    hot: ['Swimming', 'Indoor Cardio', 'Pilates'],
    clearDesc: 'Great day for outdoor!',
    cloudyDesc: 'Light activity suggested',
    rainyDesc: 'Indoor workout is best!',
    coldDesc: 'Sweat it out indoors',
    hotDesc: 'Stay cool & active',
  },
};

function getWeatherCategory(code, temp) {
  if (temp < 5) return 'cold';
  if (temp > 30) return 'hot';
  if (code >= 51) return 'rainy';
  if (code >= 4) return 'cloudy';
  return 'clear';
}

function getWeatherEmoji(code, temp) {
  if (temp < 5) return '❄️';
  if (temp > 30) return '🥵';
  if (code >= 71) return '❄️';
  if (code >= 51) return '🌧️';
  if (code >= 45) return '🌫️';
  if (code >= 4) return '⛅';
  if (code >= 2) return '🌤️';
  return '☀️';
}

const CARD_COLORS = ['#ff6b1a', '#e55a10', '#cc4e0d'];

export default function WeatherWorkout() {
  const { lang } = useLangStore();
  const t = TEXT[lang] || TEXT.ko;

  const [selectedCity, setSelectedCity] = useState(() => {
    const saved = Number(localStorage.getItem('steelbody_city'));
    return saved >= 0 && saved < CITIES.length ? saved : 0;
  });
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    const city = CITIES[selectedCity];
    localStorage.setItem('steelbody_city', selectedCity);

    function fetchWeather(lat, lng) {
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`
      )
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          if (data.current_weather) {
            setWeather(data.current_weather);
          } else {
            setError(true);
          }
          setLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setError(true);
          setLoading(false);
        });
    }

    if (city.isGps) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
          () => fetchWeather(37.5665, 126.978),
          { timeout: 5000 }
        );
      } else {
        fetchWeather(37.5665, 126.978);
      }
      return () => { cancelled = true; };
    }

    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lng}&current_weather=true`
    )
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.current_weather) {
          setWeather(data.current_weather);
        } else {
          setError(true);
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedCity]);

  const city = CITIES[selectedCity];

  return (
    <div className="card" style={{ padding: 16, marginBottom: 16 }}>
      {/* 도시 선택 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
        {CITIES.map((c, i) => (
          <button
            key={i}
            className={`btn-secondary${selectedCity === i ? ' active' : ''}`}
            onClick={() => setSelectedCity(i)}
            style={{ fontSize: 10, padding: '4px 10px' }}
          >
            {c[lang] || c.ko}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)' }}>
          <span style={{ fontSize: 22 }}>⏳</span>
          <div style={{ marginTop: 6, fontSize: 13 }}>{t.loading}</div>
        </div>
      ) : error || !weather ? (
        <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)' }}>
          <span style={{ fontSize: 22 }}>⚠️</span>
          <div style={{ marginTop: 6, fontSize: 13 }}>{t.error}</div>
        </div>
      ) : (() => {
        const { temperature, weathercode } = weather;
        const category = getWeatherCategory(weathercode, temperature);
        const emoji = getWeatherEmoji(weathercode, temperature);
        const workouts = t[category];
        const desc = t[`${category}Desc`];

        return (
          <>
            {/* 헤더 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: 18,
                  letterSpacing: 2, color: '#ff6b1a',
                }}>
                  {city[lang] || city.ko} {t.title}
                </div>
                <div style={{
                  fontSize: 11, color: 'var(--text-muted)', marginTop: 2,
                }}>
                  {t.subtitle}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 28 }}>{emoji}</span>
                <div style={{
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: 22,
                  color: 'var(--text-primary)', lineHeight: 1,
                }}>
                  {temperature}°C
                </div>
              </div>
            </div>

            {/* 설명 */}
            <div style={{
              fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10,
              padding: '6px 10px', background: 'var(--bg-secondary)',
              borderRadius: 6, border: '1px solid var(--border)',
            }}>
              {desc}
            </div>

            {/* 추천 운동 */}
            <div style={{ display: 'flex', gap: 8 }}>
              {workouts.map((name, i) => (
                <div key={name} style={{
                  flex: 1, padding: '10px 8px', borderRadius: 8,
                  background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                  textAlign: 'center',
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: CARD_COLORS[i], margin: '0 auto 6px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, color: '#fff',
                    fontFamily: "'Bebas Neue', sans-serif", fontWeight: 700,
                  }}>
                    {i + 1}
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: 600,
                    color: 'var(--text-primary)', lineHeight: 1.3,
                  }}>
                    {name}
                  </div>
                </div>
              ))}
            </div>
          </>
        );
      })()}
    </div>
  );
}
