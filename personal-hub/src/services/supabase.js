/* ==========================================
   Personal Hub v2 — Supabase Client
   ========================================== */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
      detectSessionInUrl: true
    }
  }
);
