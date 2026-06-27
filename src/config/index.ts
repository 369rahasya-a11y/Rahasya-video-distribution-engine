// src/config/index.ts
import dotenv from 'dotenv';
import type { AppConfig } from '../types/index.js';

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function optionalEnv(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}

function intEnv(key: string, fallback = 0): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed) || parsed < 0) return fallback;
  return parsed;
}

function loadConfig(): AppConfig {
  return {
    supabaseUrl: requireEnv('SUPABASE_URL'),
    supabaseKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    runMode: (process.env['RUN_MODE'] === 'PRODUCTION' ? 'PRODUCTION' : 'TEST') as 'TEST' | 'PRODUCTION',

    limits: {
      facebook: intEnv('FACEBOOK_VIDEO_LIMIT'),
      instagram: intEnv('INSTAGRAM_VIDEO_LIMIT'),
      threads: intEnv('THREADS_VIDEO_LIMIT'),
      pinterest: intEnv('PINTEREST_VIDEO_LIMIT'),
      youtube: intEnv('YOUTUBE_VIDEO_LIMIT'),
      tiktok: intEnv('TIKTOK_VIDEO_LIMIT'),
    },

    facebook: {
      pageId: optionalEnv('FACEBOOK_PAGE_ID'),
      accessToken: optionalEnv('FACEBOOK_ACCESS_TOKEN'),
    },

    instagram: {
      accountId: optionalEnv('INSTAGRAM_ACCOUNT_ID'),
      accessToken: optionalEnv('INSTAGRAM_ACCESS_TOKEN'),
    },

    threads: {
      userId: optionalEnv('THREADS_USER_ID'),
      accessToken: optionalEnv('THREADS_ACCESS_TOKEN'),
    },

    pinterest: {
      accessToken: optionalEnv('PINTEREST_ACCESS_TOKEN'),
      boardId: optionalEnv('PINTEREST_BOARD_ID'),
    },

    youtube: {
      clientId: optionalEnv('YOUTUBE_CLIENT_ID'),
      clientSecret: optionalEnv('YOUTUBE_CLIENT_SECRET'),
      refreshToken: optionalEnv('YOUTUBE_REFRESH_TOKEN'),
      channelId: optionalEnv('YOUTUBE_CHANNEL_ID'),
    },

    tiktok: {
      clientKey: optionalEnv('TIKTOK_CLIENT_KEY'),
      clientSecret: optionalEnv('TIKTOK_CLIENT_SECRET'),
      accessToken: optionalEnv('TIKTOK_ACCESS_TOKEN'),
    },
  };
}

export const config = loadConfig();
export default config;
