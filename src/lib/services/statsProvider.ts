import { trackSnapshotRepo, trackCurrentRepo } from '../db';
import { scrapeKworbGlobalDailyTracks } from '../scraping/kworbTracks';
import { scrapeKworbIndonesiaDailyTracks } from '../scraping/kworbIndonesia';
import { scrapeKworbCountryDailyTracks, getCountriesToScrape } from '../scraping/kworbCountry';
import { resolveTrackMetadata } from '../spotify/metadata';
import { TrackStat } from '../types';

export interface SpotifyStatsProvider {
  refreshAllStats(): Promise<void>;
  getTopTracks(limit: number, country?: string): Promise<TrackStat[]>;
}

class SpotifyStatsProviderImpl implements SpotifyStatsProvider {
  /**
   * Refreshes all track stats by scraping kworb, storing snapshots, computing deltas, and enriching with Spotify metadata
   */
  async refreshAllStats(): Promise<void> {
    console.log('Starting stats refresh...');

    try {
      // Step 1: Scrape global kworb tracks
      console.log('Scraping global kworb tracks...');
      const trackRaws = await scrapeKworbGlobalDailyTracks();
      console.log(`Scraped ${trackRaws.length} global tracks`);

      // Step 2: Clean up invalid track entries
      await this.cleanupInvalidTracks('global');

      // Step 3: Store global snapshots
      await this.storeTrackSnapshots(trackRaws, 'global');

      // Step 4: Update global current stats with rank deltas
      await this.updateTrackCurrents(trackRaws, 'global');

      // Step 5: Scrape all configured countries
      const countries = getCountriesToScrape().filter(c => c !== 'global');
      for (const countryCode of countries) {
        console.log(`Scraping ${countryCode} tracks...`);
        let countryTrackRaws;

        if (countryCode === 'id') {
          countryTrackRaws = await scrapeKworbIndonesiaDailyTracks();
        } else {
          countryTrackRaws = await scrapeKworbCountryDailyTracks(countryCode);
        }

        console.log(`Scraped ${countryTrackRaws.length} ${countryCode} tracks`);

        await this.cleanupInvalidTracks(countryCode);
        await this.storeTrackSnapshots(countryTrackRaws, countryCode);
        await this.updateTrackCurrents(countryTrackRaws, countryCode);
      }

      console.log('Stats refresh completed successfully');
    } catch (error) {
      console.error('Error refreshing stats:', error);
      throw error;
    }
  }

  /**
   * Stores track snapshots in the database
   */
  private async storeTrackSnapshots(tracks: Array<{ trackName: string; artistName: string; rank: number; dailyStreams: number; totalStreams?: number }>, country: string = 'global'): Promise<void> {
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
  }

  /**
   * Gets the daily baseline snapshot for tracks
   */
  private async getDailyBaselineTrackSnapshot(trackName: string, artistName: string, country: string): Promise<{ rank: number } | null> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    return await trackSnapshotRepo.findBaseline(trackName, artistName, country, todayStart);
  }

  /**
   * Updates track current stats, computing rank deltas and enriching with Spotify metadata
   */
  private async updateTrackCurrents(tracks: Array<{ trackName: string; artistName: string; rank: number; dailyStreams: number; totalStreams?: number; trackId?: string; spotifyUrl?: string }>, country: string = 'global'): Promise<void> {
    const startTime = new Date();
    for (const track of tracks) {
      const dailyBaseline = await this.getDailyBaselineTrackSnapshot(track.trackName, track.artistName, country);
      const previousRank = dailyBaseline?.rank ?? null;
      const rankDelta = previousRank !== null ? track.rank - previousRank : null;

      // Get existing current record to check if we need to enrich metadata
      const existing = await trackCurrentRepo.findUnique(track.trackName, track.artistName, country);

      let trackId = existing?.trackId ?? track.trackId ?? null;
      let imageUrl = existing?.imageUrl ?? null;
      let previewUrl = existing?.previewUrl ?? null;
      let spotifyUrl = existing?.spotifyUrl ?? track.spotifyUrl ?? (trackId ? `https://open.spotify.com/track/${trackId}` : null);

      // Enrich with Spotify cover art / metadata if not already available
      if (!imageUrl || !trackId) {
        const metadata = await resolveTrackMetadata(track.trackName, track.artistName, trackId ?? track.trackId);
        if (metadata) {
          trackId = metadata.spotifyId || trackId;
          imageUrl = metadata.imageUrl ?? imageUrl;
          previewUrl = metadata.previewUrl ?? previewUrl;
          spotifyUrl = metadata.url ?? spotifyUrl;
        }
      }

      // Upsert current record
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

    // CLEANUP: Remove stale tracks
    console.log(`Cleaning up stale tracks for ${country}...`);
    const deletedCount = await trackCurrentRepo.deleteStale(country, startTime);
    console.log(`Deleted ${deletedCount} stale tracks in ${country}`);
  }

  /**
   * Cleans up invalid track entries from the database
   */
  private async cleanupInvalidTracks(country: string = 'global'): Promise<void> {
    console.log(`Cleaning up invalid tracks for ${country}...`);

    const invalidTracks = await trackCurrentRepo.findMany({
      country,
      dailyStreamsLt: BigInt(100000),
    });

    if (invalidTracks.length > 0) {
      console.log(`Found ${invalidTracks.length} tracks with suspiciously small daily streams`);

      for (const track of invalidTracks) {
        await trackCurrentRepo.deleteByTrack(track.trackName, track.artistName, country);
        await trackSnapshotRepo.deleteByTrack(track.trackName, track.artistName, country);
      }
    }

    const allTracks = await trackCurrentRepo.findMany({ country });

    const tracksToDelete = allTracks.filter(track => {
      const trackName = track.trackName.trim();
      return (
        trackName.length < 2 ||
        /^[=\+\-\s]+$/.test(trackName) ||
        /^[\d\s\-=]+$/.test(trackName) ||
        !/[a-zA-Z]/.test(trackName)
      );
    });

    if (tracksToDelete.length > 0) {
      console.log(`Found ${tracksToDelete.length} tracks with invalid names`);

      for (const track of tracksToDelete) {
        await trackCurrentRepo.deleteByTrack(track.trackName, track.artistName, country);
        await trackSnapshotRepo.deleteByTrack(track.trackName, track.artistName, country);
      }
    }

    console.log(`Cleanup completed for ${country}`);
  }

  /**
   * Gets top tracks from the database
   */
  async getTopTracks(limit: number = parseInt(process.env.TOP_TRACKS_LIMIT || '25', 10), country: string = 'global'): Promise<TrackStat[]> {
    const tracks = await trackCurrentRepo.findMany({
      country,
      limit,
      orderByRank: true,
    });

    return tracks.map(t => ({
      trackId: t.trackId ?? null,
      name: t.trackName,
      mainArtistName: t.artistName,
      rank: t.rank,
      previousRank: t.previousRank ?? null,
      rankDelta: t.rankDelta ?? null,
      dailyStreams: Number(t.dailyStreams),
      totalStreams: t.totalStreams ? Number(t.totalStreams) : null,
      imageUrl: t.imageUrl ?? undefined,
      previewUrl: t.previewUrl ?? null,
      spotifyUrl: t.spotifyUrl ?? undefined,
      lastUpdated: t.lastUpdated ?? new Date(),
    }));
  }
}

export const statsProvider: SpotifyStatsProvider = new SpotifyStatsProviderImpl();
