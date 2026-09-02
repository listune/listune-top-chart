/**
 * Resolves track metadata (album cover art and Spotify URL) using official Spotify oEmbed API.
 * 100% free, requires NO access token/credentials, and does NOT get blocked by 429 rate limits.
 */
export async function resolveTrackOEmbed(
  trackId: string
): Promise<{ spotifyId: string; imageUrl?: string; url: string } | null> {
  try {
    const url = `https://open.spotify.com/track/${trackId}`;
    const response = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TopChart/1.0',
      },
    });

    if (!response.ok) {
      return { spotifyId: trackId, url };
    }

    const data = await response.json();
    return {
      spotifyId: trackId,
      imageUrl: data.thumbnail_url || undefined,
      url,
    };
  } catch (error) {
    return { spotifyId: trackId, url: `https://open.spotify.com/track/${trackId}` };
  }
}

/**
 * Resolves track metadata from Spotify oEmbed
 */
export async function resolveTrackMetadata(
  trackName: string,
  artistName: string,
  knownTrackId?: string
): Promise<{ spotifyId: string; imageUrl?: string; previewUrl?: string; url?: string } | null> {
  if (knownTrackId) {
    const oembed = await resolveTrackOEmbed(knownTrackId);
    if (oembed) {
      return {
        spotifyId: knownTrackId,
        imageUrl: oembed.imageUrl,
        url: oembed.url,
      };
    }
  }

  return null;
}
