// src/commands/distribute.ts
import { DistributionEngine } from '../distribution/engine.js';
import { saveReport, printStartupBanner, printSummaryBanner } from '../services/reportService.js';
import logger from '../logger/index.js';

export async function runDistribute(): Promise<void> {
  printStartupBanner();

  const engine = new DistributionEngine();

  logger.info('Distribution engine starting…');
  const startMs = Date.now();

  const report = await engine.run();

  const totalMs = Date.now() - startMs;
  report.durationMs = totalMs;

  saveReport(report);
  printSummaryBanner(report);

  logger.info('Distribution engine completed.');
}
