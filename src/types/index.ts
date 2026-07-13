// src/types/index.ts

// ============================================================
// Database Types
// ============================================================

export interface MarketingContent {
  sign: string;
  mood: string;
  reel_hook: string;
  caption: string;
  card_hook: string;
}

export interface VideoAsset {
  id: string;
  created_at: string;
  marketing_content_id: string;
  video_url: string;
  facebook_published: boolean;
  facebook_published_at: string | null;
  instagram_published: boolean;
  instagram_published_at: string | null;
  threads_published: boolean;
  threads_published_at: string | null;
  pinterest_published: boolean;
  pinterest_published_at: string | null;
  youtube_published: boolean;
  youtube_published_at: string | null;
  tiktok_published: boolean;
  tiktok_published_at: string | null;
  processing: boolean;
  processing_started_at: string | null;
}

export interface VideoRecord {
  asset: VideoAsset;
  content: MarketingContent;
}

// ============================================================
// Platform Types
// ============================================================

export type PlatformName =
  | 'facebook'
  | 'instagram'
  | 'threads'
  | 'pinterest'
  | 'youtube'
  | 'tiktok';

export interface PlatformResult {
  platform: PlatformName;
  videoId: string;
  success: boolean;
  error?: string;
  publishedId?: string;
}

export interface PlatformSummary {
  platform: PlatformName;
  fetched: number;
  published: number;
  skipped: number;
  failed: number;
  durationMs: number;
  successRate: number;
  enabled: boolean;
}

// ============================================================
// Metadata Types
// ============================================================

export interface FacebookMetadata {
  caption: string;
  hashtags: string[];
  cta: string;
  fullDescription: string;
}

export interface InstagramMetadata {
  caption: string;
  hashtags: string[];
  fullCaption: string;
}

export interface ThreadsMetadata {
  shortPost: string;
  hashtags: string[];
  fullPost: string;
}

export interface PinterestMetadata {
  title: string;
  description: string;
  tags: string[];
  altText: string;
}

export interface YouTubeMetadata {
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  privacyStatus: string;
}

export interface TikTokMetadata {
  caption: string;
  hashtags: string[];
  fullCaption: string;
}

export type PlatformMetadata =
  | FacebookMetadata
  | InstagramMetadata
  | ThreadsMetadata
  | PinterestMetadata
  | YouTubeMetadata
  | TikTokMetadata;

// ============================================================
// Config Types
// ============================================================

export interface PlatformLimits {
  facebook: number;
  instagram: number;
  threads: number;
  pinterest: number;
  youtube: number;
  tiktok: number;
}

export interface AppConfig {
  supabaseUrl: string;
  supabaseKey: string;
  runMode: 'TEST' | 'PRODUCTION';
  limits: PlatformLimits;
  facebook: {
    pageId: string;
    accessToken: string;
  };
  instagram: {
    accountId: string;
    accessToken: string;
  };
  threads: {
    userId: string;
    accessToken: string;
  };
  pinterest: {
    accessToken: string;
    boardId: string;
  };
  youtube: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    channelId: string;
  };
  tiktok: {
    clientKey: string;
    clientSecret: string;
    accessToken: string;
  };
}

// ============================================================
// Report Types
// ============================================================

export interface DistributionReport {
  runAt: string;
  runMode: string;
  durationMs: number;
  platforms: PlatformSummary[];
  totals: {
    fetched: number;
    published: number;
    skipped: number;
    failed: number;
    successRate: number;
  };
}

// ============================================================
// Publisher Interface
// ============================================================

export interface IPlatformPublisher<TMeta extends PlatformMetadata> {
  readonly platformName: PlatformName;
  generateMetadata(record: VideoRecord): TMeta;
  publish(record: VideoRecord, metadata: TMeta): Promise<string>;
  updateDatabase(videoId: string, publishedId: string): Promise<void>;
}
