// src/generators/facebookGenerator.ts
import type { FacebookMetadata, VideoRecord } from '../types/index.js';
import {
  capitalise,
  FACEBOOK_CTAS,
  formatDate,
  getMoodEmoji,
  getZodiacEmoji,
  pickDeterministic,
  PLATFORM_HASHTAGS,
} from '../templates/shared.js';

export function generateFacebookMetadata(record: VideoRecord): FacebookMetadata {
  const { content, asset } = record;
  const sign = capitalise(content.sign);
  const emoji = getZodiacEmoji(content.sign);
  const moodEmoji = getMoodEmoji(content.mood);
  const cta = pickDeterministic(FACEBOOK_CTAS, asset.id);

  const hashtags = [
    `#${content.sign.toLowerCase()}`,
    `#${content.sign.toLowerCase()}horoscope`,
    `#${content.sign.toLowerCase()}zodiac`,
    ...PLATFORM_HASHTAGS['core']!,
    ...PLATFORM_HASHTAGS['reels']!,
    ...PLATFORM_HASHTAGS['spiritual']!,
  ];

  const caption =
  `${emoji} ${sign} • ${capitalise(content.mood)} ${moodEmoji}\n\n` +
  `${content.reel_hook}\n\n` +
  `${content.caption}`;
  const fullDescription =
    `${caption}\n\n` + `${cta}\n\n` + hashtags.join(' ');

  return { caption, hashtags, cta, fullDescription };
}
