export const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'a01086539880@gmail.com';
export function isAdmin() {
  return localStorage.getItem('ironlog_email') === ADMIN_EMAIL;
}
