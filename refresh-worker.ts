/**
 * Standalone refresh worker - runs track scraping without Next.js.
 * Called by refresh-data.js via tsx.
 */

import 'dotenv/config';
import { trackSnapshotRepo, trackCurrentRepo, closeDbConnection } from './src/lib/db';
import * as cheerio from 'cheerio';

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};

interface TrackRaw {
  trackName: string;
  artistName: string;
  rank: number;
  dailyStreams: number;
  totalStreams?: number;
  trackId?: string;
  spotifyUrl?: string;
}

function parseNumber(text: string): number {
  if (!text) return 0;
  let cleaned = text.replace(/[, ]/g, '');
  let multiplier = 1;
  if (cleaned.endsWith('M')) { multiplier = 1000000; cleaned = cleaned.replace('M', ''); }
  else if (cleaned.endsWith('K')) { multiplier = 1000; cleaned = cleaned.replace('K', ''); }
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * multiplier);
}

async function scrapeKworbDailyTracks(countryCode: string): Promise<TrackRaw[]> {
  const url = `https://kworb.net/spotify/country/${countryCode}_daily.html`;
  const response = await fetch(url, { headers: FETCH_HEADERS });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);

  const html = await response.text();
  const $ = cheerio.load(html);
  const tracks: TrackRaw[] = [];
  const seenRanks = new Set<number>();

  $('table tr').each((index, element) => {
    if (index === 0) return;
    const cells = $(element).find('td');
    if (cells.length < 7) return;

    const rank = parseInt($(cells[0]).text().trim().replace(/[^\d]/g, ''), 10);
    if (isNaN(rank) || rank < 1 || rank > 100) return;

    const dailyStreams = parseNumber($(cells[6]).text().trim());
    if (dailyStreams < 10000) return;

    const artistTitleText = $(cells[2]).text().trim();
    if (!artistTitleText || /^[\d\s\-=]+$/.test(artistTitleText) || artistTitleText.length < 3) return;

    const parts = artistTitleText.split(' - ');
    let trackName = '', artistName = '';
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
      totalStreams = parseNumber($(cells[10]).text().trim()) || undefined;
    }

    tracks.push({ trackName, artistName, rank, dailyStreams, totalStreams, trackId, spotifyUrl });
  });

  tracks.sort((a, b) => a.rank - b.rank);
  const limit = parseInt(process.env.TOP_TRACKS_LIMIT || '25', 10);
  return tracks.slice(0, limit);
}

// --- Spotify metadata resolution via oEmbed (100% token-free & no rate-limits) ---

interface TrackMeta {
  spotifyId: string;
  imageUrl?: string;
  previewUrl?: string;
  url?: string;
}

async function resolveTrack(knownTrackId: string): Promise<TrackMeta | null> {
  try {
    const url = `https://open.spotify.com/track/${knownTrackId}`;
    const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TopChart/1.0' },
    });
    if (res.ok) {
      const data = await res.json();
      return {
        spotifyId: knownTrackId,
        imageUrl: data.thumbnail_url || undefined,
        url,
      };
    }
    return { spotifyId: knownTrackId, url };
  } catch {
    return { spotifyId: knownTrackId, url: `https://open.spotify.com/track/${knownTrackId}` };
  }
}

// --- Countries config ---

function getCountriesToScrape(): string[] {
  const env = process.env.SCRAPE_COUNTRIES;
  if (env) return env.split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
  return ['global', 'id'];
}

// --- Main refresh logic ---

async function refreshAllStats() {
  const countries = getCountriesToScrape();
  console.log(`Scraping ${countries.length} countries: ${countries.join(', ')}`);

  for (const country of countries) {
    console.log(`\n--- Scraping ${country} tracks ---`);
    
    try {
      const tracks = await scrapeKworbDailyTracks(country);
      console.log(`Scraped ${tracks.length} tracks`);

      // Store snapshots
      await trackSnapshotRepo.createMany(
        tracks.map(t => ({
          trackName: t.trackName,
          artistName: t.artistName,
          country,
          rank: t.rank,
          dailyStreams: BigInt(t.dailyStreams),
          totalStreams: t.totalStreams ? BigInt(t.totalStreams) : null,
        }))
      );

      // Process each track
      const startTime = new Date();
      for (const track of tracks) {
        // Get daily baseline
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const baseline = await trackSnapshotRepo.findBaseline(track.trackName, track.artistName, country, todayStart);
        const previousRank = baseline?.rank ?? null;
        const rankDelta = previousRank !== null ? track.rank - previousRank : null;

        // Check existing metadata
        const existing = await trackCurrentRepo.findUnique(track.trackName, track.artistName, country);

        let trackId = existing?.trackId ?? track.trackId ?? null;
        let imageUrl = existing?.imageUrl ?? null;
        let previewUrl = existing?.previewUrl ?? null;
        let spotifyUrl = existing?.spotifyUrl ?? track.spotifyUrl ?? (trackId ? `https://open.spotify.com/track/${trackId}` : null);

        // Enrich cover art if missing
        if ((!imageUrl || !trackId) && (trackId || track.trackId)) {
          const targetId = trackId || track.trackId!;
          const meta = await resolveTrack(targetId);
          if (meta) {
            trackId = meta.spotifyId;
            imageUrl = meta.imageUrl ?? imageUrl;
            spotifyUrl = meta.url ?? spotifyUrl;
          }
        }

        // Upsert
        await trackCurrentRepo.upsert({
          trackName: track.trackName,
          artistName: track.artistName,
          country,
          rank: track.rank,
          previousRank,
          rankDelta,
          dailyStreams: BigInt(track.dailyStreams),
          totalStreams: track.totalStreams ? BigInt(track.totalStreams) : null,
          trackId: trackId ?? null,
          imageUrl: imageUrl ?? null,
          previewUrl: previewUrl ?? null,
          spotifyUrl: spotifyUrl ?? null,
          lastUpdated: new Date(),
        });
      }

      // Cleanup stale
      const deletedCount = await trackCurrentRepo.deleteStale(country, startTime);
      if (deletedCount > 0) console.log(`  Cleaned up ${deletedCount} stale tracks`);

      console.log(`✅ ${country} done`);
    } catch (error) {
      console.error(`❌ Error scraping ${country}:`, error);
    }
  }
}

// Run
refreshAllStats()
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(() => closeDbConnection());
