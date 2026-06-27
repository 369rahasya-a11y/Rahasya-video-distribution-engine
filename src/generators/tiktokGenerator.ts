// src/generators/tiktokGenerator.ts
import type { TikTokMetadata, VideoRecord } from '../types/index.js';
import {
  capitalise,
  getMoodEmoji,
  getZodiacEmoji,
  PLATFORM_HASHTAGS,
} from '../templates/shared.js';

export function generateTikTokMetadata(record: VideoRecord): TikTokMetadata {
  const { content } = record;
  const sign = capitalise(content.sign);
  const emoji = getZodiacEmoji(content.sign);
  const moodEmoji = getMoodEmoji(content.mood);

  // TikTok captions have a 2200-char limit; keep short & punchy
  const hashtags = [
    `#${content.sign.toLowerCase()}`,
    `#${content.sign.toLowerCase()}horoscope`,
    ...PLATFORM_HASHTAGS['core']!.slice(0, 3),
    ...PLATFORM_HASHTAGS['tiktok']!,
    ...PLATFORM_HASHTAGS['trending']!.slice(0, 2),
  ];

  const caption =
    `${emoji} ${sign} ${moodEmoji}\n` +
    `${content.reel_hook}\n\n` +
    `${content.card_hook}`;

  const fullCaption = `${caption}\n\n${hashtags.join(' ')}`;

  return { caption, hashtags, fullCaption };
}
