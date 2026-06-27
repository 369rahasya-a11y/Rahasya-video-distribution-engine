// src/platforms/instagram/publisher.ts
import type {
  InstagramMetadata,
  IPlatformPublisher,
  PlatformName,
  VideoRecord,
} from '../../types/index.js';
import { generateInstagramMetadata } from '../../generators/instagramGenerator.js';
import { markAsPublished } from '../../database/queries.js';
import { createHttpClient, httpPost } from '../../services/httpService.js';
import logger from '../../logger/index.js';
import config from '../../config/index.js';

interface IGContainerResponse {
  id: string;
}

interface IGPublishResponse {
  id: string;
}

const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_ATTEMPTS = 24; // 2 minutes total

export class InstagramPublisher
  implements IPlatformPublisher<InstagramMetadata>
{
  readonly platformName: PlatformName = 'instagram';
  private readonly client = createHttpClient('https://graph.facebook.com/v19.0');

  generateMetadata(record: VideoRecord): InstagramMetadata {
    return generateInstagramMetadata(record);
  }

  async publish(record: VideoRecord, metadata: InstagramMetadata): Promise<string> {
    const { accountId, accessToken } = config.instagram;
    const videoUrl = record.asset.video_url;

    logger.info(`[instagram] Creating media container for video ${record.asset.id}`);

    // Step 1: Create media container
    const container = await httpPost<IGContainerResponse>(
      this.client,
      `/${accountId}/media`,
      null,
      {
        params: {
          media_type: 'REELS',
          video_url: videoUrl,
          caption: metadata.fullCaption,
          access_token: accessToken,
        },
      },
    );

    logger.info(`[instagram] Container created: ${container.id}`);

    // Step 2: Poll until container is ready
    await this.waitForContainer(container.id, accessToken);

    // Step 3: Publish
    const published = await httpPost<IGPublishResponse>(
      this.client,
      `/${accountId}/media_publish`,
      null,
      {
        params: {
          creation_id: container.id,
          access_token: accessToken,
        },
      },
    );

    logger.info(`[instagram] Published: media_id=${published.id}`);
    return published.id;
  }

  async updateDatabase(videoId: string): Promise<void> {
    await markAsPublished(this.platformName, videoId);
  }

  private async waitForContainer(
    containerId: string,
    accessToken: string,
  ): Promise<void> {
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      await sleep(POLL_INTERVAL_MS);

      const { default: axios } = await import('axios');
      const res = await axios.get(
        `https://graph.facebook.com/v19.0/${containerId}`,
        {
          params: {
            fields: 'status_code,status',
            access_token: accessToken,
          },
          timeout: 30_000,
        },
      );

      const statusCode = res.data?.status_code as string | undefined;
      logger.info(
        `[instagram] Container ${containerId} status: ${statusCode} (attempt ${attempt + 1})`,
      );

      if (statusCode === 'FINISHED') return;
      if (statusCode === 'ERROR') {
        throw new Error(
          `Instagram container processing failed: ${JSON.stringify(res.data)}`,
        );
      }
    }

    throw new Error(
      `Instagram container ${containerId} did not finish processing within timeout.`,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
