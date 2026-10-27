import { readLS } from './safeStorage';
import { ROLE_KEY } from './localKeys';
export function isAdmin() {
  const role = readLS(ROLE_KEY);
  return role === 'admin';
}
