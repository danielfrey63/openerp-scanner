// Simple grace-session helper: allow skipping login for a short window
// Stored in localStorage under key 'qr_grace_session'

export interface GraceData {
  version: string;
  expiresAt: number; // epoch ms
}

const KEY = 'qr_grace_session';

export function setGrace(version: string, ttlMs = 5 * 60 * 1000) {
  const data: GraceData = { version, expiresAt: Date.now() + ttlMs };
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function isGraceValid(currentVersion: string): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const data = JSON.parse(raw) as GraceData;
    if (!data || typeof data.expiresAt !== 'number') return false;
    if (data.version !== currentVersion) return false; // invalidate on app update
    return Date.now() < data.expiresAt;
  } catch {
    return false;
  }
}

export function clearGrace() {
  localStorage.removeItem(KEY);
}
