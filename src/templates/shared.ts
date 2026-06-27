// src/templates/shared.ts

/**
 * All deterministic template data lives here.
 * No AI, no external calls — pure string templates.
 */

export const ZODIAC_EMOJIS: Record<string, string> = {
  aries: '♈',
  taurus: '♉',
  gemini: '♊',
  cancer: '♋',
  leo: '♌',
  virgo: '♍',
  libra: '♎',
  scorpio: '♏',
  sagittarius: '♐',
  capricorn: '♑',
  aquarius: '♒',
  pisces: '♓',
};

export const ZODIAC_ELEMENTS: Record<string, string> = {
  aries: 'Fire',
  leo: 'Fire',
  sagittarius: 'Fire',
  taurus: 'Earth',
  virgo: 'Earth',
  capricorn: 'Earth',
  gemini: 'Air',
  libra: 'Air',
  aquarius: 'Air',
  cancer: 'Water',
  scorpio: 'Water',
  pisces: 'Water',
};

export const MOOD_EMOJIS: Record<string, string> = {
  romantic: '💕',
  mysterious: '🔮',
  energetic: '⚡',
  calm: '🌊',
  ambitious: '🚀',
  reflective: '🌙',
  joyful: '✨',
  intense: '🔥',
  grounded: '🌿',
  spiritual: '🙏',
  playful: '🎭',
  confident: '👑',
};

export const PLATFORM_HASHTAGS: Record<string, string[]> = {
  core: [
    '#horoscope',
    '#zodiac',
    '#astrology',
    '#dailyhoroscope',
    '#astrologylover',
  ],
  reels: ['#reels', '#reelsinstagram', '#reelsvideo', '#viralreels'],
  shorts: ['#shorts', '#youtubeshorts', '#shortsvideo'],
  spiritual: ['#spirituality', '#universe', '#cosmicenergy', '#manifestation'],
  trending: ['#viral', '#trending', '#fyp', '#foryoupage'],
  tiktok: ['#tiktok', '#tiktokviral', '#tiktokastrology'],
};

export const FACEBOOK_CTAS: string[] = [
  '💬 Tag a friend whose sign this is!',
  '❤️ Like if this resonates with you!',
  '💬 Comment your thoughts below!',
  '🔔 Follow for your daily cosmic guidance!',
  '📤 Share this with someone who needs to hear it!',
  '💫 Save this for later!',
  '👇 Drop your sign in the comments!',
  '✨ React if this speaks to your soul!',
];

export const YOUTUBE_DESCRIPTIONS_SUFFIX = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔔 Subscribe for daily horoscope videos!
📲 Follow us on Instagram & Facebook for more cosmic guidance.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ Disclaimer: Horoscopes are for entertainment purposes only.
`;

export function getZodiacEmoji(sign: string): string {
  return ZODIAC_EMOJIS[sign.toLowerCase()] ?? '⭐';
}

export function getMoodEmoji(mood: string): string {
  return MOOD_EMOJIS[mood.toLowerCase()] ?? '✨';
}

export function capitalise(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Select a deterministic CTA from the pool using the video ID as seed.
 * Same ID always produces the same CTA — no randomness.
 */
export function pickDeterministic<T>(items: T[], seed: string): T {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return items[hash % items.length] as T;
}

export function buildHashtagString(tags: string[]): string {
  return tags.join(' ');
}
