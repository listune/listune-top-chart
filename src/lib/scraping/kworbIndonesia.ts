import 'server-only';
import * as cheerio from 'cheerio';
import { TrackStatRaw } from '../types';

/**
 * Scrapes kworb.net for Indonesia daily Spotify chart
 * URL: https://kworb.net/spotify/country/id_daily.html
 */
export async function scrapeKworbIndonesiaDailyTracks(): Promise<TrackStatRaw[]> {
  try {
    const response = await fetch('https://kworb.net/spotify/country/id_daily.html', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const html = await response.text();
    const $ = cheerio.load(html);
    const tracks: TrackStatRaw[] = [];
    
    // Find the main table - structure: Pos, P+, Artist and Title, Days, Pk, Streams, Streams+, 7Day, 7Day+, Total
    $('table tr').each((index, element) => {
      // Skip header row
      if (index === 0) return;
      
      const $row = $(element);
      const cells = $row.find('td');
      
      if (cells.length >= 7) {
        // Extract rank (first column)
        const rankText = $(cells[0]).text().trim();
        const rank = parseInt(rankText.replace(/[^\d]/g, ''), 10);
        
        if (isNaN(rank)) return;
        
        // Artist and Title are in the third column (index 2)
        const artistTitleText = $(cells[2]).text().trim();
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
        
        // Daily streams (7th column, index 6)
        const streamsText = $(cells[6]).text().trim();
        const dailyStreams = parseNumber(streamsText);
        
        // Total streams (11th column, index 10, if present)
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

        if (!trackName || !artistName) return;
        
        tracks.push({
          trackName,
          artistName,
          rank,
          dailyStreams,
          totalStreams,
          trackId,
          spotifyUrl,
        });
      }
    });
    
    const limit = parseInt(process.env.TOP_TRACKS_LIMIT || '25', 10);
    return tracks.slice(0, limit);
  } catch (error) {
    console.error('Error scraping kworb Indonesia tracks:', error);
    throw new Error(`Failed to scrape kworb Indonesia tracks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

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
