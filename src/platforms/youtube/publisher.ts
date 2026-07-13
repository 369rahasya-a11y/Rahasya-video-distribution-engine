// src/platforms/youtube/publisher.ts
import axios, { AxiosError } from 'axios';
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

// Upload statuses that mean the video did NOT make it onto the channel.
// (Reference: YouTube Data API v3 `videos.status.uploadStatus`.)
const FAILURE_UPLOAD_STATUSES = new Set(['failed', 'rejected', 'deleted']);

export class YouTubePublisher implements IPlatformPublisher<YouTubeMetadata> {
  readonly platformName: PlatformName = 'youtube';

  generateMetadata(record: VideoRecord): YouTubeMetadata {
    return generateYouTubeMetadata(record);
  }

  async publish(record: VideoRecord, metadata: YouTubeMetadata): Promise<string> {
    const assetId = record.asset.id;
    const videoUrl = record.asset.video_url;

    logger.info(`[youtube] Starting upload for asset ${assetId}`);

    const accessToken = await this.refreshAccessToken(assetId);

    logger.info(`[youtube] Fetching video stream for asset ${assetId} — ${videoUrl}`);

    let videoResponse;
    try {
      videoResponse = await axios.get(videoUrl, { responseType: 'stream' });
    } catch (err) {
      this.logAxiosError(err, {
        assetId,
        url: videoUrl,
        stage: 'fetch source video stream',
      });
      throw new Error(
        `[youtube] Failed to fetch source video for asset ${assetId}: ${this.describeError(err)}`,
      );
    }

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

    const initiateUrl =
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status';

    logger.info(
      `[youtube] Upload started — creating resumable upload session for asset ${assetId} ("${metadata.title}")`,
    );

    let initRes;
    try {
      initRes = await axios.post(initiateUrl, metadataBody, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': 'video/mp4',
          ...(contentLength ? { 'X-Upload-Content-Length': contentLength } : {}),
        },
        timeout: 30_000,
      });
    } catch (err) {
      this.logAxiosError(err, {
        assetId,
        url: initiateUrl,
        stage: 'initiate resumable upload session',
      });
      throw new Error(
        `[youtube] Failed to create upload session for asset ${assetId}: ${this.describeError(err)}`,
      );
    }

    const uploadUrl = initRes.headers['location'] as string | undefined;
    if (!uploadUrl) {
      logger.error(
        `[youtube] Upload session response for asset ${assetId} did not include a Location header. ` +
          `Status: ${initRes.status}. Body: ${this.safeStringify(initRes.data)}`,
      );
      throw new Error(
        `[youtube] No upload session URL returned for asset ${assetId} (status ${initRes.status}).`,
      );
    }

    logger.info(`[youtube] Upload session created for asset ${assetId} — ${uploadUrl}`);

    // Stream video bytes to the resumable upload URL
    let uploadRes;
    try {
      uploadRes = await axios.put<YouTubeUploadResponse>(uploadUrl, videoResponse.data, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'video/mp4',
          ...(contentLength ? { 'Content-Length': contentLength } : {}),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 600_000,
      });
    } catch (err) {
      this.logAxiosError(err, {
        assetId,
        url: uploadUrl,
        stage: 'upload video bytes',
      });
      throw new Error(
        `[youtube] Video upload failed for asset ${assetId}: ${this.describeError(err)}`,
      );
    }

    logger.info(`[youtube] Upload completed for asset ${assetId} (HTTP ${uploadRes.status})`);

    const videoId = uploadRes.data?.id;
    const uploadStatus = uploadRes.data?.status?.uploadStatus;

    if (!videoId) {
      logger.error(
        `[youtube] Upload response for asset ${assetId} did not contain a video ID. ` +
          `Status: ${uploadRes.status}. Body: ${this.safeStringify(uploadRes.data)}`,
      );
      throw new Error(
        `[youtube] Upload for asset ${assetId} completed without a valid YouTube video ID.`,
      );
    }

    if (uploadStatus && FAILURE_UPLOAD_STATUSES.has(uploadStatus)) {
      logger.error(
        `[youtube] Upload for asset ${assetId} reported failure status "${uploadStatus}". ` +
          `video_id=${videoId}. Body: ${this.safeStringify(uploadRes.data)}`,
      );
      throw new Error(
        `[youtube] Upload for asset ${assetId} completed with failure status "${uploadStatus}".`,
      );
    }

    logger.info(
      `[youtube] YouTube video ID received for asset ${assetId}: video_id=${videoId}` +
        (uploadStatus ? ` (uploadStatus=${uploadStatus})` : ''),
    );

    return videoId;
  }

  async updateDatabase(videoId: string): Promise<void> {
    // NOTE: despite the parameter name (inherited from the shared
    // IPlatformPublisher interface), the engine passes `record.asset.id`
    // here — the database row's UUID — not the YouTube video ID. The
    // YouTube video ID returned by publish() is only used as `publishedId`
    // for logging/reporting and is never used as a database identifier.
    await markAsPublished(this.platformName, videoId);
  }

  private async refreshAccessToken(assetId: string): Promise<string> {
    const { clientId, clientSecret, refreshToken } = config.youtube;

    if (!clientId || !clientSecret || !refreshToken) {
      logger.error(
        `[youtube] Missing OAuth configuration for asset ${assetId}. ` +
          `clientId=${clientId ? 'set' : 'MISSING'}, clientSecret=${clientSecret ? 'set' : 'MISSING'}, ` +
          `refreshToken=${refreshToken ? 'set' : 'MISSING'}.`,
      );
      throw new Error(
        `[youtube] Cannot refresh access token for asset ${assetId}: OAuth configuration is incomplete.`,
      );
    }

    const tokenUrl = 'https://oauth2.googleapis.com/token';

    let res;
    try {
      res = await axios.post<YouTubeTokenResponse>(tokenUrl, null, {
        params: {
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        },
        timeout: 30_000,
      });
    } catch (err) {
      this.logAxiosError(err, {
        assetId,
        url: tokenUrl,
        stage: 'refresh OAuth access token',
      });
      throw new Error(
        `[youtube] OAuth token refresh failed for asset ${assetId}: ${this.describeError(err)}`,
      );
    }

    const accessToken = res.data?.access_token;
    if (!accessToken) {
      logger.error(
        `[youtube] OAuth token refresh for asset ${assetId} returned no access_token. ` +
          `Status: ${res.status}. Body: ${this.safeStringify(res.data)}`,
      );
      throw new Error(
        `[youtube] OAuth refresh token appears invalid for asset ${assetId} — no access_token in response.`,
      );
    }

    logger.info(`[youtube] OAuth access token refreshed successfully for asset ${assetId}`);
    return accessToken;
  }

  /**
   * Logs full diagnostic detail for a failed Google API request:
   * HTTP status, response body, relevant response headers, request URL,
   * asset ID, and the full error message. Never throws itself — the caller
   * is responsible for re-throwing after this logs.
   */
  private logAxiosError(
    err: unknown,
    context: { assetId: string; url: string; stage: string },
  ): void {
    const { assetId, url, stage } = context;

    if (axios.isAxiosError(err)) {
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status ?? 'no response';
      const body = this.safeStringify(axiosErr.response?.data);
      const headers = this.safeStringify(axiosErr.response?.headers);

      logger.error(
        `[youtube] Request failed during "${stage}" for asset ${assetId}\n` +
          `  URL: ${url}\n` +
          `  HTTP status: ${status}\n` +
          `  Response body: ${body}\n` +
          `  Response headers: ${headers}\n` +
          `  Error message: ${axiosErr.message}`,
      );
    } else {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(
        `[youtube] Non-HTTP error during "${stage}" for asset ${assetId}\n` +
          `  URL: ${url}\n` +
          `  Error message: ${message}`,
      );
    }
  }

  private describeError(err: unknown): string {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      return status ? `HTTP ${status} — ${err.message}` : err.message;
    }
    return err instanceof Error ? err.message : String(err);
  }

  private safeStringify(value: unknown): string {
    if (value === undefined) return 'undefined';
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
}
