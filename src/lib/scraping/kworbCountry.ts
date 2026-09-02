import 'server-only';
import * as cheerio from 'cheerio';
import { TrackStatRaw } from '../types';

/**
 * Supported country codes for kworb.net scraping.
 * Each entry maps a country code to its display name and flag emoji.
 */
export const SUPPORTED_COUNTRIES: Record<string, { name: string; flag: string }> = {
  global: { name: 'Global', flag: '🌍' },
  nl: { name: 'Netherlands', flag: '🇳🇱' },
  us: { name: 'United States', flag: '🇺🇸' },
  gb: { name: 'United Kingdom', flag: '🇬🇧' },
  id: { name: 'Indonesia', flag: '🇮🇩' },
  jp: { name: 'Japan', flag: '🇯🇵' },
  de: { name: 'Germany', flag: '🇩🇪' },
  fr: { name: 'France', flag: '🇫🇷' },
  br: { name: 'Brazil', flag: '🇧🇷' },
  mx: { name: 'Mexico', flag: '🇲🇽' },
  kr: { name: 'South Korea', flag: '🇰🇷' },
  in: { name: 'India', flag: '🇮🇳' },
  au: { name: 'Australia', flag: '🇦🇺' },
  es: { name: 'Spain', flag: '🇪🇸' },
  it: { name: 'Italy', flag: '🇮🇹' },
  ca: { name: 'Canada', flag: '🇨🇦' },
  se: { name: 'Sweden', flag: '🇸🇪' },
  ph: { name: 'Philippines', flag: '🇵🇭' },
  tr: { name: 'Turkey', flag: '🇹🇷' },
  ar: { name: 'Argentina', flag: '🇦🇷' },
};

/**
 * Returns the list of country codes that should be scraped.
 * Reads from SCRAPE_COUNTRIES env var (comma-separated), defaults to global + id.
 */
export function getCountriesToScrape(): string[] {
  const env = process.env.SCRAPE_COUNTRIES;
  if (env) {
    return env.split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
  }
  return ['global', 'id'];
}

/**
 * Scrapes kworb.net for a country's daily Spotify chart.
 * URL pattern: https://kworb.net/spotify/country/{cc}_daily.html
 */
export async function scrapeKworbCountryDailyTracks(countryCode: string): Promise<TrackStatRaw[]> {
  const url = `https://kworb.net/spotify/country/${countryCode}_daily.html`;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const tracks: TrackStatRaw[] = [];
    const seenRanks = new Set<number>();

    $('table tr').each((index, element) => {
      if (index === 0) return;

      const $row = $(element);
      const cells = $row.find('td');

      if (cells.length < 7) return;

      const rankText = $(cells[0]).text().trim();
      const rank = parseInt(rankText.replace(/[^\d]/g, ''), 10);
      if (isNaN(rank) || rank < 1 || rank > 100) return;

      const streamsText = $(cells[6]).text().trim();
      const dailyStreams = parseNumber(streamsText);
      if (dailyStreams < 10000) return; // lower threshold for smaller countries

      const artistTitleText = $(cells[2]).text().trim();
      if (!artistTitleText || /^[\d\s\-=]+$/.test(artistTitleText) || artistTitleText.length < 3) return;

      const parts = artistTitleText.split(' - ');
      let trackName = '';
      let artistName = '';

      if (parts.length >= 2) {
        artistName = parts[0].trim();
        trackName = parts[1].trim();
      } else {
        trackName = artistTitleText;
        artistName = 'Unknown';
      }

      if (!/[a-zA-Z]/.test(trackName) || !/[a-zA-Z]/.test(artistName)) return;
      if (!trackName || trackName.length < 2 || /^[=\+\-\s]+$/.test(trackName)) return;
      if (!artistName || artistName.length < 2 || /^[\d\s\-=]+$/.test(artistName)) return;

      if (seenRanks.has(rank)) return;
      seenRanks.add(rank);

      const artistTitleCell = $(cells[2]);
      const trackLink = artistTitleCell.find('a[href*="/track/"]').attr('href');
      let trackId: string | undefined;
      let spotifyUrl: string | undefined;
      if (trackLink) {
        const match = trackLink.match(/\/track\/([a-zA-Z0-9]+)/);
        if (match) {
          trackId = match[1];
          spotifyUrl = `https://open.spotify.com/track/${trackId}`;
        }
      }

      let totalStreams: number | undefined;
      if (cells.length >= 11) {
        const totalText = $(cells[10]).text().trim();
        totalStreams = parseNumber(totalText) || undefined;
      }

      tracks.push({ trackName, artistName, rank, dailyStreams, totalStreams, trackId, spotifyUrl });
    });

    tracks.sort((a, b) => a.rank - b.rank);
    const trackLimit = parseInt(process.env.TOP_TRACKS_LIMIT || '25', 10);
    return tracks.slice(0, trackLimit);
  } catch (error) {
    console.error(`Error scraping kworb ${countryCode} tracks:`, error);
    throw new Error(`Failed to scrape kworb ${countryCode} tracks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function parseNumber(text: string): number {
  if (!text) return 0;
  let cleaned = text.replace(/[, ]/g, '');
  let multiplier = 1;
  if (cleaned.endsWith('M')) {
    multiplier = 1000000;
    cleaned = cleaned.replace('M', '');
  } else if (cleaned.endsWith('K')) {
    multiplier = 1000;
    cleaned = cleaned.replace('K', '');
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * multiplier);
}
