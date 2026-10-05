import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY_SUPABASE_URL = 'v_drum_supabase_url';
const STORAGE_KEY_SUPABASE_ANON_KEY = 'v_drum_supabase_anon_key';

export interface SupabaseConfigInfo {
  url: string;
  anonKey: string;
  isFromEnv: boolean;
  isConfigured: boolean;
}

/**
 * Retrieves the active Supabase URL and Anon Key.
 * Priority:
 * 1. Vite environment variables (.env / VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
 * 2. Local storage overrides (allows in-browser quick setup without server restart)
 */
export function getSupabaseConfig(): SupabaseConfigInfo {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  let localUrl = '';
  let localKey = '';
  try {
    localUrl = (localStorage.getItem(STORAGE_KEY_SUPABASE_URL) || '').trim();
    localKey = (localStorage.getItem(STORAGE_KEY_SUPABASE_ANON_KEY) || '').trim();
  } catch {
    // Ignore localStorage access issues
  }

  const url = envUrl || localUrl;
  const anonKey = envKey || localKey;
  const isFromEnv = Boolean(envUrl && envKey);
  const isConfigured = Boolean(
    url &&
    anonKey &&
    (url.startsWith('https://') || url.startsWith('http://'))
  );

  return {
    url,
    anonKey,
    isFromEnv,
    isConfigured,
  };
}

let cachedClient: SupabaseClient | null = null;
let cachedKeySignature = '';

/**
 * Returns a singleton SupabaseClient if credentials are configured, or null otherwise.
 */
export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    cachedClient = null;
    cachedKeySignature = '';
    return null;
  }

  const signature = `${url}:::${anonKey}`;
  if (!cachedClient || cachedKeySignature !== signature) {
    try {
      cachedClient = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
      cachedKeySignature = signature;
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      return null;
    }
  }

  return cachedClient;
}

/**
 * Save custom Supabase credentials to localStorage and reset client
 */
export function saveCustomSupabaseConfig(url: string, anonKey: string): void {
  try {
    if (!url.trim() && !anonKey.trim()) {
      localStorage.removeItem(STORAGE_KEY_SUPABASE_URL);
      localStorage.removeItem(STORAGE_KEY_SUPABASE_ANON_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY_SUPABASE_URL, url.trim());
      localStorage.setItem(STORAGE_KEY_SUPABASE_ANON_KEY, anonKey.trim());
    }
  } catch (err) {
    console.warn('Failed to save to localStorage:', err);
  }

  cachedClient = null;
  cachedKeySignature = '';
}

/**
 * Test connectivity with Supabase project and check if the profiles table exists
 */
export async function testSupabaseConnection(
  targetUrl?: string,
  targetKey?: string
): Promise<{ success: boolean; message: string; tableProfilesExists: boolean }> {
  try {
    const config = getSupabaseConfig();
    const url = (targetUrl !== undefined ? targetUrl : config.url).trim();
    const key = (targetKey !== undefined ? targetKey : config.anonKey).trim();

    if (!url || !key) {
      return {
        success: false,
        message: 'Vui lòng nhập đầy đủ Supabase Project URL và Anon Public Key.',
        tableProfilesExists: false,
      };
    }

    if (!url.startsWith('https://') && !url.startsWith('http://')) {
      return {
        success: false,
        message: 'URL không hợp lệ. URL phải bắt đầu bằng https:// (ví dụ https://xxxx.supabase.co)',
        tableProfilesExists: false,
      };
    }

    const testClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Test basic auth connection
    const { error: authErr } = await testClient.auth.getSession();
    if (authErr) {
      return {
        success: false,
        message: `Lỗi kết nối Auth: ${authErr.message}`,
        tableProfilesExists: false,
      };
    }

    // 2. Test if `profiles` table exists in public schema
    const { error: tableErr } = await testClient
      .from('profiles')
      .select('id', { count: 'exact', head: true });

    if (tableErr) {
      // Postgres error code 42P01 means relation does not exist
      const isMissingTable =
        tableErr.code === '42P01' ||
        tableErr.message?.toLowerCase().includes('relation') ||
        tableErr.message?.toLowerCase().includes('does not exist');

      return {
        success: true,
        message: isMissingTable
          ? 'Kết nối Supabase thành công! Tuy nhiên bảng "profiles" chưa được tạo. Hãy chạy file supabase_schema.sql trong SQL Editor.'
          : `Kết nối thành công nhưng có cảnh báo truy vấn: ${tableErr.message}`,
        tableProfilesExists: !isMissingTable,
      };
    }

    return {
      success: true,
      message: 'Kết nối Supabase hoàn hảo! Đã tìm thấy bảng profiles và hệ thống sẵn sàng hoạt động.',
      tableProfilesExists: true,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Không thể kết nối tới Supabase: ${msg}`,
      tableProfilesExists: false,
    };
  }
}
