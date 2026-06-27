// src/services/reportService.ts
import fs from 'fs';
import path from 'path';
import type { DistributionReport, PlatformSummary } from '../types/index.js';
import config from '../config/index.js';
import logger from '../logger/index.js';

const OUTPUT_DIR = path.join(process.cwd(), 'output');

export function saveReport(report: DistributionReport): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const reportPath = path.join(OUTPUT_DIR, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  logger.info(`Report saved to ${reportPath}`);
}

export function printStartupBanner(): void {
  const limits = config.limits;

  const lines = [
    '========================================',
    '   Rahasya Video Distribution Engine    ',
    '========================================',
    formatPlatformLine('Facebook ', limits.facebook),
    formatPlatformLine('Instagram', limits.instagram),
    formatPlatformLine('Threads  ', limits.threads),
    formatPlatformLine('Pinterest', limits.pinterest),
    formatPlatformLine('YouTube  ', limits.youtube),
    formatPlatformLine('TikTok   ', limits.tiktok),
    `Run Mode  : ${config.runMode}`,
    '========================================',
  ];

  console.log('\n' + lines.join('\n') + '\n');
}

export function printSummaryBanner(report: DistributionReport): void {
  const lines = [
    '========================================',
    '         Distribution Summary           ',
    '========================================',
  ];

  for (const platform of report.platforms) {
    lines.push('');
    lines.push(formatSummaryPlatform(platform));
  }

  lines.push('');
  lines.push('----------------------------------------');
  lines.push(`Total Published   : ${report.totals.published}`);
  lines.push(`Total Failed      : ${report.totals.failed}`);
  lines.push(`Total Fetched     : ${report.totals.fetched}`);
  lines.push(`Success Rate      : ${report.totals.successRate}%`);
  lines.push(`Execution Time    : ${formatDuration(report.durationMs)}`);
  lines.push('========================================');

  console.log('\n' + lines.join('\n') + '\n');
}

function formatPlatformLine(name: string, limit: number): string {
  const status = limit > 0 ? `Enabled  (${limit})` : 'Disabled (0)';
  return `${name}  : ${status}`;
}

function formatSummaryPlatform(p: PlatformSummary): string {
  if (!p.enabled) {
    return `${titleCase(p.platform).padEnd(12)}: Disabled`;
  }
  return (
    `${titleCase(p.platform).padEnd(12)}\n` +
    `  Published   : ${p.published}\n` +
    `  Failed      : ${p.failed}\n` +
    `  Success     : ${p.successRate}%`
  );
}

function titleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${remSecs}s`;
}
