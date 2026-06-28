// src/generators/pinterestGenerator.ts
import type { PinterestMetadata, VideoRecord } from '../types/index.js';
import {
  capitalise,
  formatDate,
  getMoodEmoji,
  getZodiacEmoji,
  ZODIAC_ELEMENTS,
} from '../templates/shared.js';

export function generatePinterestMetadata(record: VideoRecord): PinterestMetadata {
  const { content } = record;
  const sign = capitalise(content.sign);
  const emoji = getZodiacEmoji(content.sign);
  const moodEmoji = getMoodEmoji(content.mood);
  const element = ZODIAC_ELEMENTS[content.sign.toLowerCase()] ?? 'Cosmic';

  const title = `${emoji} ${sign} • ${capitalise(content.mood)} ${moodEmoji}`;

  const description =
    `${content.reel_hook} ` +
    `${content.caption} ` +
    `Discover what the stars have in store for ${sign} (${element} sign) today. ` +
    `Save this pin for your daily cosmic guidance!`;

  const tags = [
    content.sign.toLowerCase(),
    `${content.sign.toLowerCase()}horoscope`,
    `${content.sign.toLowerCase()}zodiac`,
    'horoscope',
    'zodiac',
    'astrology',
    'dailyhoroscope',
    element.toLowerCase(),
    'cosmicenergy',
    'spirituality',
    'manifestation',
    content.mood.toLowerCase(),
  ];

  const altText = `${sign} horoscope for ${date} — ${content.reel_hook}`;

  return { title, description, tags, altText };
}
