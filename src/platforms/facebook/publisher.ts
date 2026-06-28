// src/platforms/facebook/publisher.ts
//
// Meta Graph API — Page Video Upload via remote file_url
// -------------------------------------------------------
// Facebook's Graph API accepts a publicly accessible `file_url` parameter
// when posting to /{page-id}/videos.  Facebook's servers pull the video
// directly from that URL, so no bytes pass through this Node.js process.
//
// API reference:
//   https://developers.facebook.com/docs/graph-api/reference/page/videos/#Creating
//
// Single-call flow:
//   POST https://graph-video.facebook.com/v21.0/{page-id}/videos
//     file_url        = <publicly accessible MP4 URL>
//     description     = <caption + hashtags + CTA>
//     access_token    = <page access token>
//
// Returns: { id: "<video-id>" }
// The returned id is the video object id, which we store as the published reference.

import axios from 'axios';
import type {
  FacebookMetadata,
  IPlatformPublisher,
  PlatformName,
  VideoRecord,
} from '../../types/index.js';
import { generateFacebookMetadata } from '../../generators/facebookGenerator.js';
import { markAsPublished } from '../../database/queries.js';
import logger from '../../logger/index.js';
import config from '../../config/index.js';

// ── Constants ────────────────────────────────────────────────────────────────

const GRAPH_VIDEO_API_BASE = 'https://graph-video.facebook.com';
const GRAPH_API_VERSION = 'v21.0';

// Timeout for the initial POST (Facebook may take several seconds to begin
// pulling the remote video before it acknowledges the request).
const UPLOAD_TIMEOUT_MS = 300_000; // 5 minutes

// ── Response shape ───────────────────────────────────────────────────────────

interface FacebookVideoPostResponse {
  id: string;
}

// ── Publisher ─────────────────────────────────────────────────────────────────

export class FacebookPublisher implements IPlatformPublisher<FacebookMetadata> {
  readonly platformName: PlatformName = 'facebook';

  // ── IPlatformPublisher: generateMetadata ───────────────────────────────────

  generateMetadata(record: VideoRecord): FacebookMetadata {
    return generateFacebookMetadata(record);
  }

  // ── IPlatformPublisher: publish ────────────────────────────────────────────

  async publish(record: VideoRecord, metadata: FacebookMetadata): Promise<string> {
    const { pageId, accessToken } = config.facebook;
    const videoUrl = record.asset.video_url;

    logger.info(
      `[facebook] Publishing video ${record.asset.id} via remote file_url pull`,
    );
    logger.info(`[facebook] Source URL: ${videoUrl}`);

    const endpoint = `${GRAPH_VIDEO_API_BASE}/${GRAPH_API_VERSION}/${pageId}/videos`;

    // Build form-encoded body.  Using URLSearchParams keeps the payload
    // compact and avoids multipart overhead for a parameter-only request.
    const params = new URLSearchParams({
      file_url: videoUrl,
      description: metadata.fullDescription,
      access_token: accessToken,
    });

    logger.info(`[facebook] POST ${GRAPH_API_VERSION}/${pageId}/videos (file_url pull)`);

    const response = await this.postWithRetry<FacebookVideoPostResponse>(
      endpoint,
      params.toString(),
    );

    logger.info(`[facebook] Published successfully: video_id=${response.id}`);
    return response.id;
  }

  // ── IPlatformPublisher: updateDatabase ────────────────────────────────────

  async updateDatabase(videoId: string): Promise<void> {
    await markAsPublished(this.platformName, videoId);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * POST with up to 3 retries and exponential-ish back-off.
   * We handle retries here (rather than in httpService) so we can
   * log Facebook-specific error codes without modifying shared code.
   */
  private async postWithRetry<T>(
    url: string,
    body: string,
    attempt = 1,
  ): Promise<T> {
    const MAX_ATTEMPTS = 3;
    const RETRY_DELAYS_MS = [10_000, 30_000]; // 10 s, then 30 s

    try {
      const response = await axios.post<T>(url, body, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: UPLOAD_TIMEOUT_MS,
        // Treat all 2xx responses as successful regardless of body content.
        validateStatus: (status) => status >= 200 && status < 300,
      });

      return response.data;
    } catch (err) {
      // Surface Facebook API error details when available.
      const fbError = this.extractFacebookError(err);
      const message = fbError ?? (err instanceof Error ? err.message : String(err));

      if (attempt < MAX_ATTEMPTS) {
        const delayMs = RETRY_DELAYS_MS[attempt - 1] ?? 30_000;
        logger.warn(
          `[facebook] Upload attempt ${attempt} failed: ${message}. ` +
            `Retrying in ${delayMs / 1000}s…`,
        );
        await sleep(delayMs);
        return this.postWithRetry<T>(url, body, attempt + 1);
      }

      // All attempts exhausted — rethrow with context.
      throw new Error(`[facebook] Upload failed after ${MAX_ATTEMPTS} attempts: ${message}`);
    }
  }

  /**
   * Extract the human-readable error from a Meta Graph API error response.
   * Meta wraps errors as: { error: { message, type, code, fbtrace_id } }
   */
  private extractFacebookError(err: unknown): string | null {
    if (!axios.isAxiosError(err)) return null;

    const data = err.response?.data as
      | { error?: { message?: string; code?: number; type?: string } }
      | undefined;

    if (!data?.error) return null;

    const { message, code, type } = data.error;
    const parts: string[] = [];
    if (code !== undefined) parts.push(`code=${code}`);
    if (type) parts.push(`type=${type}`);
    if (message) parts.push(message);

    return parts.join(' | ');
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
