export interface TrackStat {
  trackId: string | null;
  name: string;
  mainArtistName: string;
  rank: number;
  previousRank: number | null;
  rankDelta: number | null; // negative = moved up, positive = moved down
  dailyStreams: number;
  totalStreams?: number | null;
  imageUrl?: string;
  previewUrl?: string | null;
  spotifyUrl?: string;
  lastUpdated: Date;
}

export interface TrackStatRaw {
  trackName: string;
  artistName: string;
  rank: number;
  dailyStreams: number;
  totalStreams?: number;
  trackId?: string;
  spotifyUrl?: string;
}

// Historical data types for charts
export interface TrackHistoryDataPoint {
  date: string;
  dailyStreams: number;
  totalStreams: number | null;
  rank: number;
}

export interface TrackHistoryResponse {
  trackName: string;
  artistName: string;
  country: string;
  history: TrackHistoryDataPoint[];
  dataPoints: number;
}
