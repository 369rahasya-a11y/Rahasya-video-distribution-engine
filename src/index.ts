// src/index.ts
import 'dotenv/config';
import { runDistribute } from './commands/distribute.js';
import logger from './logger/index.js';

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'distribute';

  switch (command) {
    case 'distribute':
      await runDistribute();
      break;

    default:
      logger.error(`Unknown command: "${command}". Available: distribute`);
      process.exit(1);
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  logger.error(`Fatal error: ${message}`);
  if (err instanceof Error && err.stack) {
    logger.error(err.stack);
  }
  process.exit(1);
});
