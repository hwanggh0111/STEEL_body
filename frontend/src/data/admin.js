import { readLS } from './safeStorage';
export function isAdmin() {
  const role = readLS('ironlog_role');
  return role === 'admin';
}
