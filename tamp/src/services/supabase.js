/* ==========================================
   Personal Hub v2 — Supabase Client
   ========================================== */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let nativeSessionRequest;
let nativeSession;
let nextNativeRead = 0;

export function noteNativeSession(session) {
  nativeSession = session;
  nextNativeRead = Date.now() + 5000;
}

const nativeAuthStorage = {
  async getItem(key) {
    const raw = localStorage.getItem(key);
    if (!raw || !key.endsWith('-auth-token')) return raw;
    try {
      const local = JSON.parse(raw);
      if (!local.user?.id || !local.refresh_token) return raw;
      if (Date.now() >= nextNativeRead) {
        nativeSessionRequest ??= window.Capacitor.Plugins.DeviceStatus.status()
          .then(status => noteNativeSession(status?.session))
          .catch(() => noteNativeSession(null))
          .finally(() => { nativeSessionRequest = null; });
        await nativeSessionRequest;
      }
      if (localStorage.getItem(key) !== raw) return localStorage.getItem(key);
      if (nativeSession?.userId !== local.user.id || !nativeSession.accessToken || !nativeSession.refreshToken) return raw;
      const expiresAt = Math.floor(nativeSession.expiresAt / 1000);
      if (!(expiresAt > Math.max(Number(local.expires_at || 0) + 5, Date.now() / 1000))) return raw;
      const recovered = JSON.stringify({
        ...local,
        access_token: nativeSession.accessToken,
        refresh_token: nativeSession.refreshToken,
        expires_at: expiresAt,
      });
      localStorage.setItem(key, recovered);
      return recovered;
    } catch {
      return raw;
    }
  },
  setItem(key, value) { localStorage.setItem(key, value); },
  removeItem(key) { localStorage.removeItem(key); },
};

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '%c[Supabase] %cCredentials not found — using placeholder values.',
    'color:#c65a3a;font-weight:600',
    'color:#e8e6e3',
    '\nCreate a .env file in the project root with:\n' +
    'VITE_SUPABASE_URL=your-project-url\n' +
    'VITE_SUPABASE_ANON_KEY=your-anon-key\n' +
    '\nThe app will work in offline mode until configured.'
  );
}

// Use placeholder values when env vars are missing to avoid the hard crash.
// db.service.js already wraps all Supabase calls in try/catch and falls
// back to localStorage, so API errors degrade gracefully.
export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      ...(typeof window !== 'undefined' && window.Capacitor?.Plugins?.DeviceStatus ? { storage: nativeAuthStorage } : {})
    }
  }
);
