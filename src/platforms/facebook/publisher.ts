// src/platforms/facebook/publisher.ts
import axios from 'axios';
import type {
  FacebookMetadata,
  IPlatformPublisher,
  PlatformName,
  VideoRecord,
} from '../../types/index.js';
import { generateFacebookMetadata } from '../../generators/facebookGenerator.js';
import { markAsPublished } from '../../database/queries.js';
import { createHttpClient, httpPost } from '../../services/httpService.js';
import logger from '../../logger/index.js';
import config from '../../config/index.js';

interface FacebookVideoInitResponse {
  video_id: string;
  upload_url: string;
}

interface FacebookPublishResponse {
  id: string;
}

export class FacebookPublisher
  implements IPlatformPublisher<FacebookMetadata>
{
  readonly platformName: PlatformName = 'facebook';
  private readonly client = createHttpClient('https://graph-video.facebook.com/v19.0');
  private readonly graphClient = createHttpClient('https://graph.facebook.com/v19.0');

  generateMetadata(record: VideoRecord): FacebookMetadata {
    return generateFacebookMetadata(record);
  }

  async publish(record: VideoRecord, metadata: FacebookMetadata): Promise<string> {
    const { pageId, accessToken } = config.facebook;
    const videoUrl = record.asset.video_url;

    logger.info(`[facebook] Initiating resumable upload for video ${record.asset.id}`);

    // Step 1: Initialise upload session
    const initResponse = await httpPost<FacebookVideoInitResponse>(
      this.client,
      `/${pageId}/videos`,
      null,
      {
        params: {
          upload_phase: 'start',
          file_size: await this.getRemoteFileSize(videoUrl),
          access_token: accessToken,
        },
      },
    );

    const { video_id, upload_url } = initResponse;
    logger.info(`[facebook] Upload session created: video_id=${video_id}`);

    // Step 2: Transfer video bytes from remote URL
    const videoStream = await axios.get(videoUrl, { responseType: 'stream' });
    await httpPost(
      createHttpClient(),
      upload_url,
      videoStream.data,
      {
        headers: {
          'Authorization': `OAuth ${accessToken}`,
          'Content-Type': 'application/octet-stream',
        },
      },
    );

    // Step 3: Finish upload and publish
    const publishResponse = await httpPost<FacebookPublishResponse>(
      this.graphClient,
      `/${pageId}/videos`,
      null,
      {
        params: {
          upload_phase: 'finish',
          video_file_chunk: video_id,
          description: metadata.fullDescription,
          access_token: accessToken,
        },
      },
    );

    logger.info(`[facebook] Published: post_id=${publishResponse.id}`);
    return publishResponse.id;
  }

  async updateDatabase(videoId: string): Promise<void> {
    await markAsPublished(this.platformName, videoId);
  }

  private async getRemoteFileSize(url: string): Promise<number> {
    try {
      const response = await axios.head(url, { timeout: 30_000 });
      const contentLength = response.headers['content-length'];
      return contentLength ? parseInt(contentLength as string, 10) : 0;
    } catch {
      return 0;
    }
  }
}
