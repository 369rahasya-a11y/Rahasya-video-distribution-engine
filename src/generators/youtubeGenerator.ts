// src/generators/youtubeGenerator.ts
import type { YouTubeMetadata, VideoRecord } from '../types/index.js';
import {
  capitalise,
  formatDate,
  getMoodEmoji,
  getZodiacEmoji,
  YOUTUBE_DESCRIPTIONS_SUFFIX,
  ZODIAC_ELEMENTS,
} from '../templates/shared.js';

export function generateYouTubeMetadata(record: VideoRecord): YouTubeMetadata {
  const { content } = record;
  const sign = capitalise(content.sign);
  const emoji = getZodiacEmoji(content.sign);
  const moodEmoji = getMoodEmoji(content.mood);
  const element = ZODIAC_ELEMENTS[content.sign.toLowerCase()] ?? 'Cosmic';
  const date = formatDate(content.horoscope_date);

  // YouTube Shorts titles are capped at 100 chars — keep it punchy
  const title = `${emoji} ${sign} Horoscope ${moodEmoji} | ${date} #Shorts`;

  const description =
    `${content.reel_hook}\n\n` +
    `${content.caption}\n\n` +
    `${sign} is a ${element} sign — here's what the cosmos have in store for you today.\n` +
    YOUTUBE_DESCRIPTIONS_SUFFIX;

  const tags = [
    sign,
    `${sign} horoscope`,
    `${sign} zodiac`,
    `${sign} ${date}`,
    'horoscope',
    'daily horoscope',
    'zodiac',
    'astrology',
    'horoscope today',
    element,
    'cosmic energy',
    'spirituality',
    'YouTube Shorts',
    'Shorts',
    content.mood,
  ];

  return {
    title,
    description,
    tags,
    categoryId: '22', // People & Blogs — most appropriate for lifestyle/astrology
    privacyStatus: 'public',
  };
}
