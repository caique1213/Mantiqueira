import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { runtimeConfig } from './env';

let browserClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!runtimeConfig.configured) return null;

  browserClient ??= createClient(
    runtimeConfig.env.VITE_SUPABASE_URL,
    runtimeConfig.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: {
        headers: { 'x-application-name': 'mantiqueira-maintenance-hub' },
      },
    },
  );

  return browserClient;
}

export function requireSupabaseClient(): SupabaseClient {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase ainda não foi configurado neste ambiente.');
  return client;
}
