export function isAdmin() {
  const role = localStorage.getItem('ironlog_role');
  return role === 'admin';
}
