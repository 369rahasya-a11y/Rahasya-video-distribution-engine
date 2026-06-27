// src/platforms/pinterest/publisher.ts
import type {
  IPlatformPublisher,
  PinterestMetadata,
  PlatformName,
  VideoRecord,
} from '../../types/index.js';
import { generatePinterestMetadata } from '../../generators/pinterestGenerator.js';
import { markAsPublished } from '../../database/queries.js';
import { createHttpClient, httpPost } from '../../services/httpService.js';
import logger from '../../logger/index.js';
import config from '../../config/index.js';

interface PinterestPinResponse {
  id: string;
}

export class PinterestPublisher implements IPlatformPublisher<PinterestMetadata> {
  readonly platformName: PlatformName = 'pinterest';
  private readonly client = createHttpClient('https://api.pinterest.com/v5');

  generateMetadata(record: VideoRecord): PinterestMetadata {
    return generatePinterestMetadata(record);
  }

  async publish(record: VideoRecord, metadata: PinterestMetadata): Promise<string> {
    const { accessToken, boardId } = config.pinterest;
    const videoUrl = record.asset.video_url;

    logger.info(`[pinterest] Creating video Pin for video ${record.asset.id}`);

    const body = {
      board_id: boardId,
      title: metadata.title,
      description: metadata.description,
      alt_text: metadata.altText,
      media_source: {
        source_type: 'video_url',
        url: videoUrl,
      },
      note: metadata.tags.slice(0, 10).map((t) => `#${t}`).join(' '),
    };

    const response = await httpPost<PinterestPinResponse>(
      this.client,
      '/pins',
      body,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    logger.info(`[pinterest] Published: pin_id=${response.id}`);
    return response.id;
  }

  async updateDatabase(videoId: string): Promise<void> {
    await markAsPublished(this.platformName, videoId);
  }
}
