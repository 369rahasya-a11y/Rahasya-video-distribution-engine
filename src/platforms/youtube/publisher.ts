// src/platforms/youtube/publisher.ts
import axios from 'axios';
import type {
  IPlatformPublisher,
  PlatformName,
  VideoRecord,
  YouTubeMetadata,
} from '../../types/index.js';
import { generateYouTubeMetadata } from '../../generators/youtubeGenerator.js';
import { markAsPublished } from '../../database/queries.js';
import logger from '../../logger/index.js';
import config from '../../config/index.js';

interface YouTubeTokenResponse {
  access_token: string;
}

interface YouTubeUploadResponse {
  id: string;
  status: {
    uploadStatus: string;
  };
}

export class YouTubePublisher implements IPlatformPublisher<YouTubeMetadata> {
  readonly platformName: PlatformName = 'youtube';

  generateMetadata(record: VideoRecord): YouTubeMetadata {
    return generateYouTubeMetadata(record);
  }

  async publish(record: VideoRecord, metadata: YouTubeMetadata): Promise<string> {
    const accessToken = await this.refreshAccessToken();
    const videoUrl = record.asset.video_url;

    logger.info(`[youtube] Fetching video stream for ${record.asset.id}`);

    const videoResponse = await axios.get(videoUrl, { responseType: 'stream' });
    const contentLength = videoResponse.headers['content-length'] as string | undefined;

    const metadataBody = {
      snippet: {
        title: metadata.title,
        description: metadata.description,
        tags: metadata.tags,
        categoryId: metadata.categoryId,
      },
      status: {
        privacyStatus: metadata.privacyStatus,
        selfDeclaredMadeForKids: false,
      },
    };

    logger.info(`[youtube] Starting resumable upload for "${metadata.title}"`);

    // Initiate resumable upload session
    const initRes = await axios.post(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      metadataBody,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': 'video/mp4',
          ...(contentLength ? { 'X-Upload-Content-Length': contentLength } : {}),
        },
        timeout: 30_000,
      },
    );

    const uploadUrl = initRes.headers['location'] as string;
    if (!uploadUrl) throw new Error('[youtube] No upload URL in initiation response.');

    // Stream video bytes to the resumable upload URL
    const uploadRes = await axios.put<YouTubeUploadResponse>(
      uploadUrl,
      videoResponse.data,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'video/mp4',
          ...(contentLength ? { 'Content-Length': contentLength } : {}),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 600_000,
      },
    );

    const videoId = uploadRes.data.id;
    logger.info(`[youtube] Published: video_id=${videoId}`);
    return videoId;
  }

  async updateDatabase(videoId: string): Promise<void> {
    await markAsPublished(this.platformName, videoId);
  }

  private async refreshAccessToken(): Promise<string> {
    const { clientId, clientSecret, refreshToken } = config.youtube;

    const res = await axios.post<YouTubeTokenResponse>(
      'https://oauth2.googleapis.com/token',
      null,
      {
        params: {
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        },
        timeout: 30_000,
      },
    );

    return res.data.access_token;
  }
}
