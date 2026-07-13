// src/database/queries.ts
import type { PlatformName, VideoRecord } from '../types/index.js';
import { getSupabaseClient } from './client.js';
import logger from '../logger/index.js';

type PublishedColumn =
  | 'facebook_published'
  | 'instagram_published'
  | 'threads_published'
  | 'pinterest_published'
  | 'youtube_published'
  | 'tiktok_published';

const PLATFORM_COLUMN_MAP: Record<PlatformName, PublishedColumn> = {
  facebook: 'facebook_published',
  instagram: 'instagram_published',
  threads: 'threads_published',
  pinterest: 'pinterest_published',
  youtube: 'youtube_published',
  tiktok: 'tiktok_published',
};

/**
 * Fetch unpublished video records for a specific platform.
 * Each platform independently queries its own unprocessed rows.
 */
export async function fetchUnpublishedVideos(
  platform: PlatformName,
  limit: number,
): Promise<VideoRecord[]> {
  const publishedColumn = PLATFORM_COLUMN_MAP[platform];
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('social_videos')
    .select(
      `
      id,
      created_at,
      marketing_content_id,
      video_url,
      facebook_published,
      facebook_published_at,
      instagram_published,
      instagram_published_at,
      threads_published,
      threads_published_at,
      pinterest_published,
      pinterest_published_at,
      youtube_published,
      youtube_published_at,
      tiktok_published,
      tiktok_published_at,
      processing,
      processing_started_at,
      marketing_content:marketing_content_id (
        sign,
        mood,
        reel_hook,
        caption,
        card_hook
      )
    `,
    )
    .eq(publishedColumn, false)
    .eq('processing', false)
    .not('video_url', 'is', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(
      `Database fetch failed for platform "${platform}": ${error.message}`,
    );
  }

  if (!data || data.length === 0) {
    return [];
  }

  const records: VideoRecord[] = [];

  for (const row of data) {
    const rawContent = row.marketing_content;

    if (!rawContent) {
      logger.warn(
        `[${platform}] Video asset ${row.id} has no linked marketing_content — skipping.`,
      );
      continue;
    }

    // Supabase returns joined rows as an object or an array; normalise to object
    const content = Array.isArray(rawContent) ? rawContent[0] : rawContent;

    if (!content) {
      logger.warn(
        `[${platform}] Video asset ${row.id} marketing_content array was empty — skipping.`,
      );
      continue;
    }

    records.push({
      asset: {
        id: row.id as string,
        created_at: row.created_at as string,
        marketing_content_id: row.marketing_content_id as string,
        video_url: row.video_url as string,
        facebook_published: row.facebook_published as boolean,
        facebook_published_at: row.facebook_published_at as string | null,
        instagram_published: row.instagram_published as boolean,
        instagram_published_at: row.instagram_published_at as string | null,
        threads_published: row.threads_published as boolean,
        threads_published_at: row.threads_published_at as string | null,
        pinterest_published: row.pinterest_published as boolean,
        pinterest_published_at: row.pinterest_published_at as string | null,
        youtube_published: row.youtube_published as boolean,
        youtube_published_at: row.youtube_published_at as string | null,
        tiktok_published: row.tiktok_published as boolean,
        tiktok_published_at: row.tiktok_published_at as string | null,
        processing: row.processing as boolean,
        processing_started_at: row.processing_started_at as string | null,
      },
      content: {
        sign: content.sign as string,
        mood: content.mood as string,
        reel_hook: content.reel_hook as string,
        caption: content.caption as string,
        card_hook: content.card_hook as string,
      },
    });
  }

  return records;
}

/**
 * Mark a single platform column as published for a specific video asset.
 * ONLY updates columns belonging to the given platform — never touches others.
 */
export async function markAsPublished(
  platform: PlatformName,
  videoId: string,
): Promise<void> {
  const publishedColumn = PLATFORM_COLUMN_MAP[platform];
  const publishedAtColumn = `${publishedColumn}_at` as const;
  const supabase = getSupabaseClient();

  const updatePayload: Record<string, boolean | string> = {
    [publishedColumn]: true,
    [publishedAtColumn]: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('social_videos')
    .update(updatePayload)
    .eq('id', videoId);

  if (error) {
    throw new Error(
      `Failed to mark video ${videoId} as published on ${platform}: ${error.message}`,
    );
  }
}

/**
 * Set processing flag to prevent duplicate runs from claiming the same row.
 */
export async function setProcessingFlag(
  videoId: string,
  processing: boolean,
): Promise<void> {
  const supabase = getSupabaseClient();

  const updatePayload: Record<string, boolean | string | null> = {
    processing,
    processing_started_at: processing ? new Date().toISOString() : null,
  };

  const { error } = await supabase
    .from('social_videos')
    .update(updatePayload)
    .eq('id', videoId);

  if (error) {
    throw new Error(
      `Failed to update processing flag for video ${videoId}: ${error.message}`,
    );
  }
}
