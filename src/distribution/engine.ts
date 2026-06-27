// src/distribution/engine.ts
import type {
  DistributionReport,
  IPlatformPublisher,
  PlatformMetadata,
  PlatformName,
  PlatformResult,
  PlatformSummary,
  VideoRecord,
} from '../types/index.js';
import { fetchUnpublishedVideos, setProcessingFlag } from '../database/queries.js';
import { FacebookPublisher } from '../platforms/facebook/publisher.js';
import { InstagramPublisher } from '../platforms/instagram/publisher.js';
import { ThreadsPublisher } from '../platforms/threads/publisher.js';
import { PinterestPublisher } from '../platforms/pinterest/publisher.js';
import { YouTubePublisher } from '../platforms/youtube/publisher.js';
import { TikTokPublisher } from '../platforms/tiktok/publisher.js';
import logger from '../logger/index.js';
import config from '../config/index.js';

// ============================================================
// Platform order — execution is sequential
// ============================================================
const PLATFORM_ORDER: PlatformName[] = [
  'facebook',
  'instagram',
  'threads',
  'pinterest',
  'youtube',
  'tiktok',
];

export class DistributionEngine {
  private readonly publishers: Map<PlatformName, IPlatformPublisher<PlatformMetadata>>;

  constructor() {
    const entries: [PlatformName, IPlatformPublisher<PlatformMetadata>][] = [
      ['facebook', new FacebookPublisher() as IPlatformPublisher<PlatformMetadata>],
      ['instagram', new InstagramPublisher() as IPlatformPublisher<PlatformMetadata>],
      ['threads', new ThreadsPublisher() as IPlatformPublisher<PlatformMetadata>],
      ['pinterest', new PinterestPublisher() as IPlatformPublisher<PlatformMetadata>],
      ['youtube', new YouTubePublisher() as IPlatformPublisher<PlatformMetadata>],
      ['tiktok', new TikTokPublisher() as IPlatformPublisher<PlatformMetadata>],
    ];
    this.publishers = new Map(entries);
  }

  async run(): Promise<DistributionReport> {
    const runAt = new Date().toISOString();
    const engineStartMs = Date.now();
    const summaries: PlatformSummary[] = [];

    for (const platformName of PLATFORM_ORDER) {
      const limit = config.limits[platformName];
      const platformStartMs = Date.now();

      // ── Disabled ────────────────────────────────────────────
      if (limit === 0) {
        logger.info(`[${platformName}] Disabled (limit=0) — skipping.`);
        summaries.push(this.makeSkippedSummary(platformName, platformStartMs));
        continue;
      }

      logger.info(`[${platformName}] Enabled (limit=${limit})`);

      const publisher = this.publishers.get(platformName);
      if (!publisher) {
        logger.error(`[${platformName}] No publisher registered — skipping.`);
        summaries.push(this.makeSkippedSummary(platformName, platformStartMs));
        continue;
      }

      // ── Fetch ───────────────────────────────────────────────
      let records: VideoRecord[] = [];
      try {
        logger.info(`[${platformName}] Fetching unpublished videos…`);
        records = await fetchUnpublishedVideos(platformName, limit);
        logger.info(`[${platformName}] Fetched ${records.length} video(s).`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[${platformName}] Fetch failed: ${msg}`);
        summaries.push(this.makeErrorSummary(platformName, 0, msg, platformStartMs));
        continue;
      }

      if (records.length === 0) {
        logger.info(`[${platformName}] Nothing to publish.`);
        summaries.push({
          platform: platformName,
          fetched: 0,
          published: 0,
          skipped: 0,
          failed: 0,
          durationMs: Date.now() - platformStartMs,
          successRate: 100,
          enabled: true,
        });
        continue;
      }

      // ── Publish each record ─────────────────────────────────
      const results = await this.publishAll(publisher, records);
      const published = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      const total = results.length;
      const durationMs = Date.now() - platformStartMs;

      summaries.push({
        platform: platformName,
        fetched: total,
        published,
        skipped: 0,
        failed,
        durationMs,
        successRate: total > 0 ? Math.round((published / total) * 100) : 100,
        enabled: true,
      });

      logger.info(
        `[${platformName}] Complete — Published: ${published}, Failed: ${failed}, Duration: ${durationMs}ms`,
      );
    }

    const totalDurationMs = Date.now() - engineStartMs;
    return this.buildReport(runAt, summaries, totalDurationMs);
  }

  // ── Publish a batch for one platform ─────────────────────────
  private async publishAll(
    publisher: IPlatformPublisher<PlatformMetadata>,
    records: VideoRecord[],
  ): Promise<PlatformResult[]> {
    const results: PlatformResult[] = [];

    for (const record of records) {
      const videoId = record.asset.id;
      const platformName = publisher.platformName;

      try {
        // Mark as processing to avoid concurrent duplicate runs
        await setProcessingFlag(videoId, true);

        logger.info(`[${platformName}] Generating metadata for video ${videoId}…`);
        const metadata = publisher.generateMetadata(record);

        logger.info(`[${platformName}] Publishing video ${videoId}…`);
        const publishedId = await publisher.publish(record, metadata);

        logger.info(`[${platformName}] Updating database for video ${videoId}…`);
        await publisher.updateDatabase(videoId, publishedId);

        results.push({ platform: platformName, videoId, success: true, publishedId });
        logger.info(`[${platformName}] ✓ Video ${videoId} published successfully.`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[${platformName}] ✗ Failed to publish video ${videoId}: ${msg}`);
        results.push({ platform: platformName, videoId, success: false, error: msg });
      } finally {
        // Always clear the processing flag — even on failure
        try {
          await setProcessingFlag(videoId, false);
        } catch (flagErr) {
          const flagMsg =
            flagErr instanceof Error ? flagErr.message : String(flagErr);
          logger.warn(
            `[${platformName}] Could not clear processing flag for ${videoId}: ${flagMsg}`,
          );
        }
      }
    }

    return results;
  }

  // ── Report builders ────────────────────────────────────────
  private buildReport(
    runAt: string,
    summaries: PlatformSummary[],
    durationMs: number,
  ): DistributionReport {
    const totals = summaries.reduce(
      (acc, s) => ({
        fetched: acc.fetched + s.fetched,
        published: acc.published + s.published,
        skipped: acc.skipped + s.skipped,
        failed: acc.failed + s.failed,
      }),
      { fetched: 0, published: 0, skipped: 0, failed: 0 },
    );

    const successRate =
      totals.fetched > 0
        ? Math.round((totals.published / totals.fetched) * 100)
        : 100;

    return {
      runAt,
      runMode: config.runMode,
      durationMs,
      platforms: summaries,
      totals: { ...totals, successRate },
    };
  }

  private makeSkippedSummary(
    platform: PlatformName,
    startMs: number,
  ): PlatformSummary {
    return {
      platform,
      fetched: 0,
      published: 0,
      skipped: 0,
      failed: 0,
      durationMs: Date.now() - startMs,
      successRate: 100,
      enabled: false,
    };
  }

  private makeErrorSummary(
    platform: PlatformName,
    fetched: number,
    _error: string,
    startMs: number,
  ): PlatformSummary {
    return {
      platform,
      fetched,
      published: 0,
      skipped: 0,
      failed: fetched,
      durationMs: Date.now() - startMs,
      successRate: 0,
      enabled: true,
    };
  }
}
