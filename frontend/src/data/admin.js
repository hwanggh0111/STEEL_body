export const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'a01086539880@gmail.com';
export function isAdmin() {
  // role 기반 체크 우선, 폴백으로 이메일 비교
  const role = localStorage.getItem('ironlog_role');
  if (role) return role === 'admin';
  return localStorage.getItem('ironlog_email') === ADMIN_EMAIL;
}
