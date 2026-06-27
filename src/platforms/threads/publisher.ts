// src/platforms/threads/publisher.ts
import type {
  IPlatformPublisher,
  PlatformName,
  ThreadsMetadata,
  VideoRecord,
} from '../../types/index.js';
import { generateThreadsMetadata } from '../../generators/threadsGenerator.js';
import { markAsPublished } from '../../database/queries.js';
import { createHttpClient, httpPost } from '../../services/httpService.js';
import logger from '../../logger/index.js';
import config from '../../config/index.js';

interface ThreadsContainerResponse {
  id: string;
}

interface ThreadsPublishResponse {
  id: string;
}

const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_ATTEMPTS = 24;

export class ThreadsPublisher implements IPlatformPublisher<ThreadsMetadata> {
  readonly platformName: PlatformName = 'threads';
  private readonly client = createHttpClient('https://graph.threads.net/v1.0');

  generateMetadata(record: VideoRecord): ThreadsMetadata {
    return generateThreadsMetadata(record);
  }

  async publish(record: VideoRecord, metadata: ThreadsMetadata): Promise<string> {
    const { userId, accessToken } = config.threads;
    const videoUrl = record.asset.video_url;

    logger.info(`[threads] Creating media container for video ${record.asset.id}`);

    // Step 1: Create media container
    const container = await httpPost<ThreadsContainerResponse>(
      this.client,
      `/${userId}/threads`,
      null,
      {
        params: {
          media_type: 'VIDEO',
          video_url: videoUrl,
          text: metadata.fullPost,
          access_token: accessToken,
        },
      },
    );

    logger.info(`[threads] Container created: ${container.id}`);

    // Step 2: Poll until container status is FINISHED
    await this.waitForContainer(container.id, accessToken);

    // Step 3: Publish the container
    const published = await httpPost<ThreadsPublishResponse>(
      this.client,
      `/${userId}/threads_publish`,
      null,
      {
        params: {
          creation_id: container.id,
          access_token: accessToken,
        },
      },
    );

    logger.info(`[threads] Published: post_id=${published.id}`);
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
        `https://graph.threads.net/v1.0/${containerId}`,
        {
          params: {
            fields: 'status,error_message',
            access_token: accessToken,
          },
          timeout: 30_000,
        },
      );

      const status = res.data?.status as string | undefined;
      logger.info(
        `[threads] Container ${containerId} status: ${status} (attempt ${attempt + 1})`,
      );

      if (status === 'FINISHED') return;
      if (status === 'ERROR') {
        throw new Error(
          `Threads container processing failed: ${res.data?.error_message ?? 'Unknown error'}`,
        );
      }
    }

    throw new Error(
      `Threads container ${containerId} did not finish processing within timeout.`,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
