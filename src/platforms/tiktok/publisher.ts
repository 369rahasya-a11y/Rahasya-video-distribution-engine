// src/platforms/tiktok/publisher.ts
import axios from 'axios';
import type {
  IPlatformPublisher,
  PlatformName,
  TikTokMetadata,
  VideoRecord,
} from '../../types/index.js';
import { generateTikTokMetadata } from '../../generators/tiktokGenerator.js';
import { markAsPublished } from '../../database/queries.js';
import { createHttpClient, httpPost } from '../../services/httpService.js';
import logger from '../../logger/index.js';
import config from '../../config/index.js';

interface TikTokInitResponse {
  data: {
    publish_id: string;
    upload_url: string;
  };
  error: {
    code: string;
    message: string;
  };
}

interface TikTokStatusResponse {
  data: {
    status: string;
    publicaly_available_post_id?: string[];
  };
  error: {
    code: string;
  };
}

const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_ATTEMPTS = 24;

/**
 * TikTok publisher — architecture is complete and production-ready.
 * Enable by setting TIKTOK_VIDEO_LIMIT > 0 in .env when access is granted.
 *
 * Uses TikTok Content Posting API v2.
 */
export class TikTokPublisher implements IPlatformPublisher<TikTokMetadata> {
  readonly platformName: PlatformName = 'tiktok';
  private readonly client = createHttpClient('https://open.tiktokapis.com/v2');

  generateMetadata(record: VideoRecord): TikTokMetadata {
    return generateTikTokMetadata(record);
  }

  async publish(record: VideoRecord, metadata: TikTokMetadata): Promise<string> {
    const { accessToken } = config.tiktok;
    const videoUrl = record.asset.video_url;

    logger.info(`[tiktok] Initiating video upload for ${record.asset.id}`);

    // Step 1: Fetch video size
    const headRes = await axios.head(videoUrl, { timeout: 30_000 });
    const fileSize = parseInt(
      (headRes.headers['content-length'] as string | undefined) ?? '0',
      10,
    );

    // Step 2: Initialise upload
    const initRes = await httpPost<TikTokInitResponse>(
      this.client,
      '/post/video/init/',
      {
        post_info: {
          title: metadata.fullCaption.substring(0, 2200),
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
          video_cover_timestamp_ms: 1000,
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: videoUrl,
          video_size: fileSize,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
      },
    );

    if (initRes.error?.code !== 'ok') {
      throw new Error(`TikTok init failed: ${initRes.error?.message}`);
    }

    const publishId = initRes.data.publish_id;
    logger.info(`[tiktok] Upload initiated: publish_id=${publishId}`);

    // Step 3: Poll for completion
    const postId = await this.pollForCompletion(publishId, accessToken);
    logger.info(`[tiktok] Published: post_id=${postId}`);
    return postId;
  }

  async updateDatabase(videoId: string): Promise<void> {
    await markAsPublished(this.platformName, videoId);
  }

  private async pollForCompletion(
    publishId: string,
    accessToken: string,
  ): Promise<string> {
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      await sleep(POLL_INTERVAL_MS);

      const res = await httpPost<TikTokStatusResponse>(
        this.client,
        '/post/publish/status/fetch/',
        { publish_id: publishId },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
          },
        },
      );

      const status = res.data?.status;
      logger.info(
        `[tiktok] Publish status: ${status} (attempt ${attempt + 1})`,
      );

      if (status === 'PUBLISH_COMPLETE') {
        const postIds = res.data.publicaly_available_post_id;
        return (postIds && postIds[0]) ? postIds[0] : publishId;
      }

      if (status === 'FAILED') {
        throw new Error(`TikTok publish failed for publish_id=${publishId}`);
      }
    }

    throw new Error(
      `TikTok publish_id=${publishId} did not complete within timeout.`,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
