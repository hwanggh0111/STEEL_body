export const bannerStyle = {
  background: 'var(--event-banner-bg)',
  borderRadius: 18,
  padding: '36px 24px 28px',
  textAlign: 'center',
  position: 'relative',
  overflow: 'hidden',
  marginBottom: 18,
  border: '2px solid rgba(255,215,0,0.3)',
  boxShadow: 'var(--event-banner-shadow)',
};

export const particleOverlayStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  pointerEvents: 'none',
  background: 'var(--event-banner-overlay)',
};

export const titleStyle = {
  fontFamily: "'Bebas Neue', sans-serif",
  fontSize: 38,
  letterSpacing: 4,
  background: 'linear-gradient(90deg, #ffd700 0%, #ff6b1a 50%, #ffd700 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  textShadow: 'none',
  filter: 'drop-shadow(0 0 12px rgba(255,215,0,0.4))',
  margin: 0,
  lineHeight: 1.1,
};

export const subtitleStyle = {
  fontFamily: "'Barlow', sans-serif",
  fontSize: 14,
  color: 'var(--event-text-mid)',
  marginTop: 6,
  letterSpacing: 2,
};

export const ddayStyle = {
  fontFamily: "'Bebas Neue', sans-serif",
  fontSize: 28,
  color: 'var(--accent)',
  marginTop: 16,
  textShadow: '0 0 16px rgba(255,215,0,0.5)',
};

export const progressBarOuter = {
  background: 'var(--event-progress-track)',
  borderRadius: 10,
  height: 10,
  margin: '16px 0 0',
  overflow: 'hidden',
  border: '1px solid rgba(255,215,0,0.15)',
};

export const sectionTitleStyle = {
  fontFamily: "'Bebas Neue', sans-serif",
  fontSize: 22,
  letterSpacing: 2,
  color: 'var(--accent)',
  marginBottom: 14,
  textShadow: '0 0 8px rgba(255,215,0,0.3)',
};

export const cardStyle = {
  background: 'var(--event-card-bg)',
  borderRadius: 16,
  padding: '20px 16px',
  marginBottom: 18,
  border: '1px solid var(--event-card-border)',
};

export const weekCardStyle = (isActive) => ({
  background: isActive
    ? 'linear-gradient(135deg, rgba(255,107,26,0.15), rgba(255,215,0,0.08))'
    : 'var(--event-soft-bg)',
  borderRadius: 14,
  padding: '16px 18px',
  marginBottom: 12,
  border: isActive ? '1px solid rgba(255,215,0,0.4)' : '1px solid var(--event-soft-border)',
  boxShadow: isActive ? '0 0 20px rgba(255,107,26,0.1)' : 'none',
  transition: 'all 0.3s',
});

export const missionRowStyle = (done) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 0',
  borderBottom: '1px solid var(--event-mission-divider)',
  opacity: done ? 0.7 : 1,
});

export const checkCircle = (done) => ({
  width: 26,
  height: 26,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  fontWeight: 900,
  flexShrink: 0,
  background: done
    ? 'linear-gradient(135deg, #ffd700, #ff6b1a)'
    : 'var(--event-soft-bg)',
  color: done ? '#1a0a2e' : 'var(--event-stamp-text-locked)',
  border: done ? 'none' : '2px solid var(--event-text-ghost)',
  boxShadow: done ? '0 0 10px rgba(255,215,0,0.4)' : 'none',
});

export const expBadgeStyle = {
  fontFamily: "'Bebas Neue', sans-serif",
  fontSize: 14,
  color: 'var(--accent)',
  background: 'rgba(255,215,0,0.1)',
  borderRadius: 8,
  padding: '2px 10px',
  letterSpacing: 1,
};

export const stampGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: 6,
  marginTop: 12,
};

export const stampCellStyle = (stamped, isToday) => ({
  width: '100%',
  aspectRatio: '1',
  borderRadius: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: stamped ? 20 : 11,
  fontFamily: "'Barlow', sans-serif",
  fontWeight: 600,
  background: stamped
    ? 'linear-gradient(135deg, rgba(255,107,26,0.25), rgba(255,215,0,0.15))'
    : isToday
      ? 'rgba(255,215,0,0.08)'
      : 'var(--event-soft-bg)',
  color: stamped ? '#ffd700' : isToday ? '#ff6b1a' : 'var(--event-text-muted)',
  border: isToday && !stamped ? '1px solid rgba(255,107,26,0.5)' : stamped ? '1px solid rgba(255,215,0,0.3)' : '1px solid var(--event-mission-divider)',
  boxShadow: stamped ? '0 0 8px rgba(255,215,0,0.2)' : 'none',
  cursor: isToday && !stamped ? 'pointer' : 'default',
  transition: 'all 0.2s',
});

export const attendanceBadgeStyle = (earned) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 14px',
  borderRadius: 10,
  fontSize: 13,
  fontFamily: "'Barlow', sans-serif",
  fontWeight: 600,
  background: earned ? 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,107,26,0.1))' : 'var(--event-soft-bg)',
  color: earned ? '#ffd700' : 'var(--event-text-muted)',
  border: earned ? '1px solid rgba(255,215,0,0.3)' : '1px solid var(--event-soft-border)',
  boxShadow: earned ? '0 0 12px rgba(255,215,0,0.15)' : 'none',
});

export const rewardCardStyle = (acquired) => ({
  background: acquired
    ? 'linear-gradient(135deg, rgba(255,215,0,0.12), rgba(255,107,26,0.08))'
    : 'var(--event-soft-bg)',
  borderRadius: 14,
  padding: '20px 18px',
  textAlign: 'center',
  border: acquired ? '2px solid rgba(255,215,0,0.4)' : '2px solid var(--event-soft-border)',
  boxShadow: acquired ? '0 0 24px rgba(255,215,0,0.15)' : 'none',
  flex: '1 1 0',
  minWidth: 140,
  transition: 'all 0.3s',
});

export const rewardTitleStyle = (acquired) => ({
  fontFamily: "'Bebas Neue', sans-serif",
  fontSize: 20,
  letterSpacing: 2,
  color: acquired ? '#ffd700' : 'var(--event-text-muted)',
  textShadow: acquired ? '0 0 10px rgba(255,215,0,0.4)' : 'none',
  marginBottom: 6,
});

export const rewardStatusStyle = (acquired) => ({
  fontFamily: "'Barlow', sans-serif",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 1,
  color: acquired ? '#ff6b1a' : 'var(--event-stamp-text-locked)',
  textTransform: 'uppercase',
  marginTop: 8,
  background: acquired ? 'rgba(255,107,26,0.12)' : 'var(--event-soft-bg)',
  display: 'inline-block',
  padding: '3px 12px',
  borderRadius: 6,
});

export const infoBoxStyle = {
  background: 'var(--event-soft-bg)',
  borderRadius: 14,
  padding: '18px 18px',
  border: '1px solid var(--event-soft-border)',
};

export const infoTextStyle = {
  fontFamily: "'Barlow', sans-serif",
  fontSize: 13,
  color: 'var(--event-text-soft)',
  lineHeight: 1.7,
  margin: 0,
};

export const stampBtnStyle = (canStamp) => ({
  fontFamily: "'Bebas Neue', sans-serif",
  fontSize: 16,
  letterSpacing: 2,
  padding: '10px 28px',
  borderRadius: 10,
  border: 'none',
  cursor: canStamp ? 'pointer' : 'default',
  background: canStamp
    ? 'linear-gradient(135deg, #ff6b1a, #ffd700)'
    : 'var(--event-soft-bg)',
  color: canStamp ? '#1a0a2e' : 'var(--event-text-muted)',
  fontWeight: 700,
  boxShadow: canStamp ? '0 0 16px rgba(255,107,26,0.4)' : 'none',
  marginTop: 12,
  transition: 'all 0.2s',
});
