// src/generators/threadsGenerator.ts
import type { ThreadsMetadata, VideoRecord } from '../types/index.js';
import {
  capitalise,
  formatDate,
  getMoodEmoji,
  getZodiacEmoji,
  PLATFORM_HASHTAGS,
} from '../templates/shared.js';

export function generateThreadsMetadata(record: VideoRecord): ThreadsMetadata {
  const { content } = record;
  const sign = capitalise(content.sign);
  const emoji = getZodiacEmoji(content.sign);
  const moodEmoji = getMoodEmoji(content.mood);
  
  // Threads favours concise, conversation-starting posts
  const hashtags = [
    `#${content.sign.toLowerCase()}`,
    ...PLATFORM_HASHTAGS['core']!.slice(0, 3),
    '#cosmicenergy',
  ];

  const shortPost =
  `${emoji} ${sign} • ${capitalise(content.mood)} ${moodEmoji}\n\n` +
  `${content.reel_hook}\n\n` +
  `${content.card_hook}\n\n` +
  `What do you think? 👇`;

  const fullPost = `${shortPost}\n\n${hashtags.join(' ')}`;

  return { shortPost, hashtags, fullPost };
}
