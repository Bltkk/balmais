import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// Admin client — lazy para evitar errores en build time (la key es solo runtime)
let _adminClient: SupabaseClient | null = null;
export function getSupabaseAdmin(): SupabaseClient {
  if (!_adminClient) {
    _adminClient = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return _adminClient;
}

const AUTH_COOKIE = 'sb-auth';
const COOKIE_MAX_AGE_DAYS = 7;

export function setAuthCookie() {
  const expires = new Date();
  expires.setDate(expires.getDate() + COOKIE_MAX_AGE_DAYS);
  document.cookie = `${AUTH_COOKIE}=1; path=/; expires=${expires.toUTCString()}; SameSite=Lax`;
}

export function clearAuthCookie() {
  document.cookie = `${AUTH_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT`;
}
