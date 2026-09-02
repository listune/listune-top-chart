import 'server-only';
import * as cheerio from 'cheerio';
import { TrackStatRaw } from '../types';

/**
 * Parses a number string that may contain commas, decimals, or units (M, K)
 */
function parseNumber(text: string): number {
  if (!text) return 0;
  
  // Remove commas and spaces
  let cleaned = text.replace(/[, ]/g, '');
  
  // Handle units (M = million, K = thousand)
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

/**
 * Scrapes kworb.net for global daily Spotify chart
 * URL: https://kworb.net/spotify/country/global_daily.html
 */
export async function scrapeKworbGlobalDailyTracks(): Promise<TrackStatRaw[]> {
  try {
    // Use Node's native fetch to avoid axios/undici issues
    const response = await fetch('https://kworb.net/spotify/country/global_daily.html', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const html = await response.text();
    const $ = cheerio.load(html);
    const tracks: TrackStatRaw[] = [];
    const seenRanks = new Set<number>(); // Track seen ranks to prevent duplicates
    
    // Find the main table with id="spotifydaily" - structure: Pos, P+, Artist and Title, Days, Pk, (x?), Streams, Streams+, 7Day, 7Day+, Total
    // Use only the specific table ID to avoid duplicates
    $('table#spotifydaily tr').each((index, element) => {
      // Skip header row
      if (index === 0) return;
      
      const $row = $(element);
      const cells = $row.find('td');
      
      if (cells.length < 7) return;
      
      // Extract rank (first column, index 0)
      const rankText = $(cells[0]).text().trim();
      const rank = parseInt(rankText.replace(/[^\d]/g, ''), 10);
      
      if (isNaN(rank) || rank < 1 || rank > 200) return; // Skip invalid ranks
      
      // CRITICAL: Check daily streams FIRST to identify valid data rows
      // Daily streams is in column index 6, and should be a large number
      // Invalid rows often have the "Days" value (index 3, typically small like 52) in the wrong place
      
      const streamsText = $(cells[6]).text().trim();
      const dailyStreams = parseNumber(streamsText);
      
      // Validation: Daily streams should be a large number (typically > 100,000)
      // If it's suspiciously small, this is likely an invalid row structure
      if (dailyStreams < 100000) {
        console.warn(`Skipping row ${rank} - daily streams too small (${dailyStreams}), likely invalid row structure. Raw: "${streamsText}"`);
        return;
      }
      
      // Artist and Title are in the third column (index 2)
      const artistTitleText = $(cells[2]).text().trim();
      
      // CRITICAL: Valid rows should have a link in the artist/title column
      // Invalid rows (summary/header rows) typically don't have links
      // const $artistTitleCell = $(cells[2]);
      // const hasLink = $artistTitleCell.find('a').length > 0;
      
      // Skip rows without links - these are likely summary/header rows
      // if (!hasLink) {
      //   console.warn(`Skipping row ${rank} - no link in artist/title column`);
      //   return;
      // }
      
      // Skip rows where artist/title column is empty, just a number, or a symbol
      if (!artistTitleText || /^[\d\s\-=]+$/.test(artistTitleText) || artistTitleText.length < 3) {
        console.warn(`Skipping invalid artist/title: "${artistTitleText}"`);
        return;
      }
      
      const parts = artistTitleText.split(' - ');
      
      let trackName = '';
      let artistName = '';
      
      if (parts.length >= 2) {
        artistName = parts[0].trim();
        trackName = parts[1].trim();
      } else {
        // Fallback if format is different
        trackName = artistTitleText;
        artistName = 'Unknown';
      }
      
      // Validate track and artist names - skip if they're just numbers or symbols
      // More aggressive validation: track/artist should contain letters
      const hasLetters = /[a-zA-Z]/.test(trackName) && /[a-zA-Z]/.test(artistName);
      if (!hasLetters) {
        console.warn(`Skipping row ${rank} - track/artist names don't contain letters: "${trackName}" / "${artistName}"`);
        return;
      }
      
      // Skip if track name is just a single symbol (like "=", "+", "-", etc.)
      if (!trackName || trackName.length < 2 || /^[=\+\-\s]+$/.test(trackName) || /^[\d\s\-=]+$/.test(trackName)) {
        console.warn(`Skipping row ${rank} - invalid track name: "${trackName}"`);
        return;
      }
      
      // Skip if artist name is just symbols or too short
      if (!artistName || artistName.length < 2 || /^[\d\s\-=]+$/.test(artistName)) {
        console.warn(`Skipping row ${rank} - invalid artist name: "${artistName}"`);
        return;
      }
      
      // Additional check: if track name is the same as the position change symbol (index 1), skip it
      const positionChange = $(cells[1]).text().trim();
      if (trackName === positionChange && positionChange.length <= 2) {
        console.warn(`Skipping row ${rank} - track name matches position change symbol: "${trackName}"`);
        return;
      }
      
      // Column structure (verified from HTML):
      // Index 0: Pos (rank) - e.g., "1"
      // Index 1: P+ (position change) - e.g., "="
      // Index 2: Artist and Title - e.g., "Taylor Swift - The Fate of Ophelia"
      // Index 3: Days (NOT what we want - this is number of days on chart) - e.g., "52"
      // Index 4: Pk (peak position) - e.g., "1"
      // Index 5: (x?) mini text - e.g., "(x51)"
      // Index 6: Streams (THIS IS WHAT WE WANT - daily streams) - e.g., "5,992,905"
      // Index 7: Streams+ (daily change) - e.g., "-994,294"
      // Index 8: 7Day (7-day total) - e.g., "48,313,295"
      // Index 9: 7Day+ (7-day change) - e.g., "-360,813"
      // Index 10: Total (all-time total) - e.g., "514,128,404"
      
      // Note: dailyStreams was already validated above (must be >= 100000)
      
      // Skip if we've already seen this rank (duplicate detection)
      // This check happens AFTER all validation to ensure we keep the valid entry
      if (seenRanks.has(rank)) {
        console.warn(`Skipping duplicate rank ${rank} - already have valid entry`);
        return;
      }
      
      // Total streams is in the last column (11th column, index 10, if present)
      let totalStreams: number | undefined;
      if (cells.length >= 11) {
        const totalText = $(cells[10]).text().trim();
        totalStreams = parseNumber(totalText) || undefined;
      }
      
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

      // Mark this rank as seen
      seenRanks.add(rank);
      
      tracks.push({
        trackName,
        artistName,
        rank,
        dailyStreams,
        totalStreams,
        trackId,
        spotifyUrl,
      });
    });
    
    // Sort by rank to ensure correct order
    tracks.sort((a, b) => a.rank - b.rank);
    const limit = parseInt(process.env.TOP_TRACKS_LIMIT || '25', 10);
    return tracks.slice(0, limit);
  } catch (error) {
    console.error('Error scraping kworb tracks:', error);
    throw new Error(`Failed to scrape kworb tracks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
