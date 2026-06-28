// src/generators/instagramGenerator.ts
import type { InstagramMetadata, VideoRecord } from '../types/index.js';
import {
  capitalise,
  formatDate,
  getMoodEmoji,
  getZodiacEmoji,
  PLATFORM_HASHTAGS,
} from '../templates/shared.js';

export function generateInstagramMetadata(record: VideoRecord): InstagramMetadata {
  const { content } = record;
  const sign = capitalise(content.sign);
  const emoji = getZodiacEmoji(content.sign);
  const moodEmoji = getMoodEmoji(content.mood);

  const hashtags = [
    `#${content.sign.toLowerCase()}`,
    `#${content.sign.toLowerCase()}horoscope`,
    `#${content.sign.toLowerCase()}season`,
    `#${content.sign.toLowerCase()}vibes`,
    ...PLATFORM_HASHTAGS['core']!,
    ...PLATFORM_HASHTAGS['reels']!,
    ...PLATFORM_HASHTAGS['spiritual']!,
    ...PLATFORM_HASHTAGS['trending']!,
  ];

  const caption =
  `${emoji} ${sign} • ${capitalise(content.mood)} ${moodEmoji}\n\n` +
  `${content.reel_hook}\n\n` +
  `${content.caption}\n\n` +
  `💫 Save this for your daily check-in!\n` +
  `👇 Drop a ✨ if this resonates!`;

  const fullCaption = `${caption}\n.\n.\n.\n${hashtags.join(' ')}`;

  return { caption, hashtags, fullCaption };
}
