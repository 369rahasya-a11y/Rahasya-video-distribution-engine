// src/database/client.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import config from '../config/index.js';

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(config.supabaseUrl, config.supabaseKey, {
      auth: { persistSession: false },
    });
  }
  return _client;
}
