'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';

interface Track {
  trackId: string | null;
  name: string;
  mainArtistName: string;
  rank: number;
  previousRank: number | null;
  rankDelta: number | null;
  dailyStreams: number;
  totalStreams?: number | null;
  imageUrl?: string;
  previewUrl?: string | null;
  spotifyUrl?: string;
  lastUpdated?: string;
}

interface CountryInfo {
  code: string;
  name: string;
  flag: string;
}

interface RegionGroup {
  region: string;
  countries: CountryInfo[];
}

const REGION_COUNTRIES: RegionGroup[] = [
  {
    region: 'Worldwide',
    countries: [
      { code: 'global', name: 'Global Worldwide', flag: '🌍' },
    ],
  },
  {
    region: 'Asia & Pacific',
    countries: [
      { code: 'id', name: 'Indonesia', flag: '🇮🇩' },
      { code: 'my', name: 'Malaysia', flag: '🇲🇾' },
      { code: 'jp', name: 'Japan', flag: '🇯🇵' },
      { code: 'kr', name: 'South Korea', flag: '🇰🇷' },
      { code: 'in', name: 'India', flag: '🇮🇳' },
      { code: 'ph', name: 'Philippines', flag: '🇵🇭' },
      { code: 'au', name: 'Australia', flag: '🇦🇺' },
    ],
  },
  {
    region: 'Americas',
    countries: [
      { code: 'us', name: 'United States', flag: '🇺🇸' },
      { code: 'ca', name: 'Canada', flag: '🇨🇦' },
      { code: 'br', name: 'Brazil', flag: '🇧🇷' },
      { code: 'mx', name: 'Mexico', flag: '🇲🇽' },
      { code: 'ar', name: 'Argentina', flag: '🇦🇷' },
    ],
  },
  {
    region: 'Europe',
    countries: [
      { code: 'gb', name: 'United Kingdom', flag: '🇬🇧' },
      { code: 'de', name: 'Germany', flag: '🇩🇪' },
      { code: 'fr', name: 'France', flag: '🇫🇷' },
      { code: 'nl', name: 'Netherlands', flag: '🇳🇱' },
      { code: 'es', name: 'Spain', flag: '🇪🇸' },
      { code: 'it', name: 'Italy', flag: '🇮🇹' },
      { code: 'se', name: 'Sweden', flag: '🇸🇪' },
      { code: 'tr', name: 'Turkey', flag: '🇹🇷' },
    ],
  },
];

const ALL_COUNTRIES: CountryInfo[] = REGION_COUNTRIES.flatMap(r => r.countries);
const QUICK_COUNTRIES = [
  { code: 'global', name: 'Global', flag: '🌍' },
  { code: 'id', name: 'Indonesia', flag: '🇮🇩' },
  { code: 'my', name: 'Malaysia', flag: '🇲🇾' },
  { code: 'us', name: 'USA', flag: '🇺🇸' },
  { code: 'gb', name: 'UK', flag: '🇬🇧' },
  { code: 'jp', name: 'Japan', flag: '🇯🇵' },
];

interface ApiEndpoint {
  id: string;
  name: string;
  method: 'GET' | 'POST';
  path: string;
  description: string;
  params?: { key: string; default?: string; placeholder?: string; description?: string }[];
  exampleResponse: object | string;
}

const ENDPOINTS: ApiEndpoint[] = [
  {
    id: 'tracks',
    name: 'Top Daily Tracks',
    method: 'GET',
    path: '/api/stats/tracks',
    description: 'Fetch real-time top chart tracks with streams, ranks, and enriched Spotify cover art.',
    params: [
      { key: 'country', default: 'global', placeholder: 'global, id, my, us, gb...', description: 'Country code or global' },
      { key: 'limit', default: '10', placeholder: '10', description: 'Number of tracks to return (default 25)' },
    ],
    exampleResponse: {
      tracks: [
        {
          trackId: "3h5T5JypYU7huFiVYhv1dr",
          name: "BbY WOW (w/ Judeline, rusowsky)",
          mainArtistName: "KAROL G",
          rank: 1,
          previousRank: 1,
          rankDelta: 0,
          dailyStreams: 8520410,
          totalStreams: 3241029000,
          imageUrl: "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0221deb742375f88edfb2e7368",
          spotifyUrl: "https://open.spotify.com/track/3h5T5JypYU7huFiVYhv1dr",
          lastUpdated: "2026-09-02T03:00:00.000Z"
        }
      ]
    },
  },
  {
    id: 'history',
    name: 'Track History & Deltas',
    method: 'GET',
    path: '/api/stats/tracks/history',
    description: 'Get historical streaming trajectory and rank progression over time for any track.',
    params: [
      { key: 'trackName', default: 'BbY WOW', placeholder: 'e.g. BbY WOW', description: 'Track title' },
      { key: 'artistName', default: 'KAROL G', placeholder: 'e.g. KAROL G', description: 'Main artist name' },
      { key: 'country', default: 'global', placeholder: 'global, id, us...', description: 'Country chart code' },
      { key: 'days', default: '30', placeholder: '30', description: 'Days of historical data' },
    ],
    exampleResponse: {
      trackName: "BbY WOW",
      artistName: "KAROL G",
      country: "global",
      dataPoints: 2,
      history: [
        { date: "2026-09-01T00:00:00.000Z", dailyStreams: 8301200, totalStreams: 3232500000, rank: 2 },
        { date: "2026-09-02T00:00:00.000Z", dailyStreams: 8520410, totalStreams: 3241029000, rank: 1 }
      ]
    },
  },
  {
    id: 'countries',
    name: 'Supported Countries',
    method: 'GET',
    path: '/api/stats/countries',
    description: 'List all countries currently supported for daily top chart scraping.',
    exampleResponse: {
      countries: [
        { code: 'global', name: 'Global', flag: '🌍' },
        { code: 'id', name: 'Indonesia', flag: '🇮🇩' },
        { code: 'my', name: 'Malaysia', flag: '🇲🇾' },
        { code: 'us', name: 'United States', flag: '🇺🇸' }
      ]
    },
  },
  {
    id: 'last-updated',
    name: 'Last Sync Timestamp',
    method: 'GET',
    path: '/api/stats/last-updated',
    description: 'Retrieve the timestamp of the latest chart refresh in the database.',
    exampleResponse: {
      lastUpdated: "2026-09-02T03:30:15.000Z"
    },
  },
];

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toLocaleString();
}

export default function Home() {
  // Showcase State
  const [selectedCountry, setSelectedCountry] = useState('global');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [countryDropdownSearch, setCountryDropdownSearch] = useState('');
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close country dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCountryDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Playground State
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint>(ENDPOINTS[0]);
  const [paramInputs, setParamInputs] = useState<Record<string, string>>({
    country: 'global',
    limit: '10',
  });
  const [apiResponse, setApiResponse] = useState<string>('');
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseDuration, setResponseDuration] = useState<number | null>(null);
  const [responseSize, setResponseSize] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState<'curl' | 'js' | 'python'>('curl');
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  // Fetch showcase tracks
  const fetchShowcaseTracks = useCallback(async (countryCode: string) => {
    setLoadingTracks(true);
    try {
      const res = await fetch(`/api/stats/tracks?country=${countryCode}&limit=25`);
      if (res.ok) {
        const data = await res.json();
        setTracks(data.tracks || []);
      } else {
        setTracks([]);
      }
    } catch (err) {
      console.error('Failed to load showcase tracks:', err);
      setTracks([]);
    } finally {
      setLoadingTracks(false);
    }
  }, []);

  useEffect(() => {
    fetchShowcaseTracks(selectedCountry);
  }, [selectedCountry, fetchShowcaseTracks]);

  // Handle endpoint selection
  const handleSelectEndpoint = (ep: ApiEndpoint) => {
    setSelectedEndpoint(ep);
    const defaults: Record<string, string> = {};
    ep.params?.forEach(p => {
      if (p.default) defaults[p.key] = p.default;
    });
    setParamInputs(defaults);
    setApiResponse('');
    setResponseStatus(null);
    setResponseDuration(null);
  };

  // Build full request URL for playground
  const fullRequestUrl = useMemo(() => {
    const url = new URL(selectedEndpoint.path, 'http://localhost');
    Object.entries(paramInputs).forEach(([key, val]) => {
      if (val && val.trim()) {
        url.searchParams.set(key, val.trim());
      }
    });
    return `${selectedEndpoint.path}${url.search}`;
  }, [selectedEndpoint, paramInputs]);

  // Execute playground request
  const handleExecuteRequest = async () => {
    setIsExecuting(true);
    setApiResponse('');
    setResponseStatus(null);
    const start = performance.now();

    try {
      const res = await fetch(fullRequestUrl);
      const duration = Math.round(performance.now() - start);
      setResponseDuration(duration);
      setResponseStatus(res.status);

      const text = await res.text();
      setResponseSize((text.length / 1024).toFixed(2) + ' KB');

      try {
        const json = JSON.parse(text);
        setApiResponse(JSON.stringify(json, null, 2));
      } catch {
        setApiResponse(text);
      }
    } catch (error: any) {
      const duration = Math.round(performance.now() - start);
      setResponseDuration(duration);
      setResponseStatus(500);
      setApiResponse(JSON.stringify({ error: error.message || 'Network error' }, null, 2));
    } finally {
      setIsExecuting(false);
    }
  };

  // Filtered tracks for showcase
  const filteredTracks = useMemo(() => {
    if (!searchFilter.trim()) return tracks;
    const q = searchFilter.toLowerCase();
    return tracks.filter(
      t => t.name.toLowerCase().includes(q) || t.mainArtistName.toLowerCase().includes(q)
    );
  }, [tracks, searchFilter]);

  // Top 1 Track Spotlight
  const top1Track = useMemo(() => {
    if (tracks.length === 0) return null;
    return tracks.find(t => t.rank === 1) || tracks[0];
  }, [tracks]);

  // Max daily streams for proportional progress bar
  const maxStreams = useMemo(() => {
    if (tracks.length === 0) return 1;
    return Math.max(...tracks.map(t => t.dailyStreams));
  }, [tracks]);

  const currentCountry = useMemo(() => {
    return ALL_COUNTRIES.find(c => c.code === selectedCountry) || ALL_COUNTRIES[0];
  }, [selectedCountry]);

  // Filtered country list for dropdown
  const filteredDropdownRegions = useMemo(() => {
    if (!countryDropdownSearch.trim()) return REGION_COUNTRIES;
    const q = countryDropdownSearch.toLowerCase();
    return REGION_COUNTRIES.map(r => ({
      ...r,
      countries: r.countries.filter(
        c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
      ),
    })).filter(r => r.countries.length > 0);
  }, [countryDropdownSearch]);

  // Generated code snippets
  const codeSnippets = useMemo(() => {
    const completeUrl = `${origin}${fullRequestUrl}`;

    return {
      curl: `curl -X ${selectedEndpoint.method} "${completeUrl}" \\
  -H "Accept: application/json"`,
      js: `// Native fetch example
const res = await fetch("${completeUrl}");
const data = await res.json();
console.log(data);`,
      python: `import requests

url = "${completeUrl}"
response = requests.get(url)
data = response.json()
print(data)`,
    };
  }, [selectedEndpoint, fullRequestUrl, origin]);

  const copyToClipboard = (text: string, type: 'code' | 'json') => {
    navigator.clipboard.writeText(text);
    if (type === 'code') {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    }
  };

  return (
    <div className="bg-canvas">
      {/* Sticky Navigation */}
      <nav className="navbar">
        <div className="container navbar-inner">
          <a href="#" className="brand-wrapper">
            <img src="/listune.png" alt="Listune Logo" className="brand-logo-img" />
            <div>
              <span className="brand-name">Listune</span>
              <span className="brand-badge">Top Chart API</span>
            </div>
          </a>

          <div className="nav-links">
            <a href="#showcase" className="nav-link">Top Charts</a>
            <a href="#playground" className="nav-link">API Playground</a>
            <div className="status-pill">
              <span className="status-dot"></span>
              <span>V2.0 Live</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="container">
        {/* Hero Section */}
        <section className="hero-section">
          <div className="hero-pill">
            <span>🎵 Spotify Daily Top Charts</span>
            <span className="hero-pill-dot">•</span>
            <span>Public API</span>
          </div>

          <h1 className="hero-title">
            Spotify Daily Top Charts <br />
            <span className="hero-title-gradient">Data & REST API</span>
          </h1>

          <p className="hero-desc">
            Daily Spotify top tracks for Global and 20+ countries with daily stream counts, rank changes, album artwork, and public JSON endpoints.
          </p>

          <div className="hero-actions">
            <a href="#showcase" className="btn-primary">
              Browse Charts →
            </a>
            <a href="#playground" className="btn-secondary">
              API Documentation
            </a>
          </div>
        </section>

        {/* 3 Features Highlights */}
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-num">01 / REGIONS</div>
            <div className="feature-title">20+ Countries</div>
            <div className="feature-desc">
              Daily top track charts from Global to Indonesia, Malaysia, US, UK, Japan, and more.
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-num">02 / DATA</div>
            <div className="feature-title">Streams & Rank Changes</div>
            <div className="feature-desc">
              Daily stream counts, total plays, and day-to-day rank movement indicators (▲, ▼, =).
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-num">03 / API</div>
            <div className="feature-title">Public JSON Endpoints</div>
            <div className="feature-desc">
              Clean REST endpoints ready for Discord bots, dashboards, and music applications.
            </div>
          </div>
        </div>

        {/* ==========================================================================
           SECTION 1: TOP TRACKS SHOWCASE (REDESIGNED WITH LUXURY COUNTRY SELECTOR)
           ========================================================================== */}
        <section id="showcase" className="showcase-wrapper">
          {/* Header */}
          <div className="showcase-header-bar">
            <div className="showcase-title-area">
              <div className="showcase-badge">
                <span className="showcase-badge-dot"></span>
                <span>Live Daily Chart Showcase</span>
              </div>
              <h2 className="showcase-heading">Top Daily Tracks</h2>
              <p className="showcase-subtext">
                Currently displaying <b>{currentCountry.flag} {currentCountry.name}</b> daily top chart
              </p>
            </div>

            {/* Controls Toolbar: Search + Country Dropdown + View Switcher (SEJAJAR) */}
            <div className="chart-controls-toolbar">
              {/* Search Box */}
              <div className="search-box-custom">
                <svg
                  className="search-icon-svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                  type="text"
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  placeholder={`Search ${currentCountry.name} tracks or artists...`}
                />
                {searchFilter && (
                  <button onClick={() => setSearchFilter('')} className="search-clear">
                    ✕
                  </button>
                )}
              </div>

              {/* Action Group: Country Dropdown & View Switcher */}
              <div className="toolbar-actions-group">
                {/* Country Dropdown */}
                <div className="country-dropdown-wrapper" ref={dropdownRef}>
                  <button
                    type="button"
                    className="country-dropdown-trigger"
                    onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                    aria-expanded={isCountryDropdownOpen}
                  >
                    <span className="country-trigger-left">
                      <span className="country-trigger-flag">{currentCountry.flag}</span>
                      <span className="country-trigger-name">{currentCountry.name}</span>
                    </span>
                    <svg
                      className={`country-chevron ${isCountryDropdownOpen ? 'open' : ''}`}
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>

                  {isCountryDropdownOpen && (
                    <div className="country-dropdown-menu">
                      <div className="country-dropdown-search">
                        <input
                          type="text"
                          placeholder="Search 21+ countries..."
                          value={countryDropdownSearch}
                          onChange={e => setCountryDropdownSearch(e.target.value)}
                          autoFocus
                        />
                      </div>
                      <div className="country-dropdown-list">
                        {filteredDropdownRegions.map(group => (
                          <div key={group.region} className="country-dropdown-group">
                            <div className="country-dropdown-group-title">{group.region}</div>
                            {group.countries.map(c => {
                              const isSelected = selectedCountry === c.code;
                              return (
                                <button
                                  key={c.code}
                                  type="button"
                                  onClick={() => {
                                    setSelectedCountry(c.code);
                                    setIsCountryDropdownOpen(false);
                                    setCountryDropdownSearch('');
                                  }}
                                  className={`country-dropdown-option ${isSelected ? 'selected' : ''}`}
                                >
                                  <div className="dropdown-opt-left">
                                    <span className="dropdown-opt-flag">{c.flag}</span>
                                    <span className="dropdown-opt-name">{c.name}</span>
                                  </div>
                                  <div className="dropdown-opt-right">
                                    <span className="dropdown-opt-code">{c.code.toUpperCase()}</span>
                                    {isSelected && <span className="dropdown-opt-check">✓</span>}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ))}
                        {filteredDropdownRegions.length === 0 && (
                          <div className="dropdown-empty-msg">
                            No country found for &quot;{countryDropdownSearch}&quot;
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* View Switcher */}
                <div className="view-switcher">
                  <button
                    onClick={() => setViewMode('table')}
                    className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
                    title="Leaderboard Table View"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="8" y1="6" x2="21" y2="6"></line>
                      <line x1="8" y1="12" x2="21" y2="12"></line>
                      <line x1="8" y1="18" x2="21" y2="18"></line>
                      <line x1="3" y1="6" x2="3.01" y2="6"></line>
                      <line x1="3" y1="12" x2="3.01" y2="12"></line>
                      <line x1="3" y1="18" x2="3.01" y2="18"></line>
                    </svg>
                    <span>Leaderboard</span>
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                    title="Bento Grid View"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7"></rect>
                      <rect x="14" y="3" width="7" height="7"></rect>
                      <rect x="14" y="14" width="7" height="7"></rect>
                      <rect x="3" y="14" width="7" height="7"></rect>
                    </svg>
                    <span>Bento Grid</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SPOTLIGHT HERO: #1 TRACK OF SELECTED COUNTRY */}
          {!loadingTracks && top1Track && !searchFilter && (
            <div className="spotlight-card">
              <div className="spotlight-left">
                <div className="spotlight-art-wrapper">
                  {top1Track.imageUrl ? (
                    <img
                      src={top1Track.imageUrl}
                      alt={top1Track.name}
                      className="spotlight-img"
                    />
                  ) : (
                    <div className="spotlight-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111' }}>
                      ♫
                    </div>
                  )}
                  <div className="spotlight-crown-badge">👑</div>
                </div>

                <div style={{ minWidth: 0 }}>
                  <div className="spotlight-tag">
                    <span>#1 Trending in {currentCountry.name}</span>
                  </div>
                  <h3 className="spotlight-title" title={top1Track.name}>
                    {top1Track.name}
                  </h3>
                  <div className="spotlight-artist">{top1Track.mainArtistName}</div>
                </div>
              </div>

              <div className="spotlight-right">
                <div className="spotlight-stat">
                  <div className="spotlight-stat-label">Daily Streams</div>
                  <div className="spotlight-stat-val">{formatNumber(top1Track.dailyStreams)}</div>
                </div>

                {top1Track.spotifyUrl && (
                  <a
                    href={top1Track.spotifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="spotlight-play-btn"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                    </svg>
                    <span>Listen on Spotify</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* VIEW 1: LEADERBOARD TABLE ROWS */}
          {loadingTracks ? (
            <div className="leaderboard-list">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="leaderboard-row" style={{ opacity: 0.4, height: '74px' }}>
                  <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                    Loading chart rankings...
                  </div>
                </div>
              ))}
            </div>
          ) : filteredTracks.length > 0 ? (
            viewMode === 'table' ? (
              <div className="leaderboard-list">
                {filteredTracks.map(track => {
                  const isTop1 = track.rank === 1;
                  const isTop2 = track.rank === 2;
                  const isTop3 = track.rank === 3;
                  const rankNumClass = isTop1 ? 'top-1' : isTop2 ? 'top-2' : isTop3 ? 'top-3' : '';
                  const percentWidth = Math.max(8, Math.round((track.dailyStreams / maxStreams) * 100));

                  return (
                    <div key={`${track.rank}-${track.name}`} className="leaderboard-row">
                      {/* Left: Rank, Delta, Art, Title, Artist */}
                      <div className="row-left">
                        <div className={`row-rank-num ${rankNumClass}`}>
                          {track.rank < 10 ? `0${track.rank}` : track.rank}
                        </div>

                        <div
                          className={`row-delta ${
                            track.rankDelta === null
                              ? 'delta-same'
                              : track.rankDelta < 0
                              ? 'delta-up'
                              : track.rankDelta > 0
                              ? 'delta-down'
                              : 'delta-same'
                          }`}
                        >
                          {track.rankDelta === null
                            ? '='
                            : track.rankDelta < 0
                            ? `▲ ${Math.abs(track.rankDelta)}`
                            : track.rankDelta > 0
                            ? `▼ ${track.rankDelta}`
                            : '='}
                        </div>

                        {track.imageUrl ? (
                          <img
                            src={track.imageUrl}
                            alt={track.name}
                            className="row-art"
                            loading="lazy"
                          />
                        ) : (
                          <div className="row-art-fallback">♫</div>
                        )}

                        <div className="row-track-meta">
                          <div className="row-track-name" title={track.name}>
                            {track.name}
                          </div>
                          <div className="row-track-artist" title={track.mainArtistName}>
                            {track.mainArtistName}
                          </div>
                        </div>
                      </div>

                      {/* Right: Streams Meter & Spotify Link */}
                      <div className="row-right">
                        <div className="row-streams-meter">
                          <div className="meter-val">{formatNumber(track.dailyStreams)}</div>
                          <div className="meter-bar-track">
                            <div
                              className="meter-bar-fill"
                              style={{ width: `${percentWidth}%` }}
                            ></div>
                          </div>
                        </div>

                        {track.spotifyUrl && (
                          <a
                            href={track.spotifyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="row-spotify-link"
                            title="Open on Spotify"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* VIEW 2: BENTO GRID VIEW */
              <div className="bento-grid">
                {filteredTracks.map(track => {
                  const rankClass = track.rank === 1 ? 'top-1' : '';

                  return (
                    <div key={`${track.rank}-${track.name}`} className="bento-card">
                      <div className="bento-top">
                        <span className={`bento-rank-tag ${rankClass}`}>
                          #{track.rank}
                        </span>

                        <span
                          className={`delta-badge ${
                            track.rankDelta === null
                              ? 'delta-same'
                              : track.rankDelta < 0
                              ? 'delta-up'
                              : track.rankDelta > 0
                              ? 'delta-down'
                              : 'delta-same'
                          }`}
                        >
                          {track.rankDelta === null
                            ? '='
                            : track.rankDelta < 0
                            ? `▲ ${Math.abs(track.rankDelta)}`
                            : track.rankDelta > 0
                            ? `▼ ${track.rankDelta}`
                            : '='}
                        </span>
                      </div>

                      <div className="bento-img-container">
                        {track.imageUrl ? (
                          <img
                            src={track.imageUrl}
                            alt={track.name}
                            className="bento-img"
                            loading="lazy"
                          />
                        ) : (
                          <div className="bento-img-fallback">♫</div>
                        )}
                      </div>

                      <div className="bento-title" title={track.name}>
                        {track.name}
                      </div>
                      <div className="bento-artist" title={track.mainArtistName}>
                        {track.mainArtistName}
                      </div>

                      <div className="bento-footer">
                        <div>
                          <span className="stream-label">Daily Streams</span>
                          <span className="stream-val">{formatNumber(track.dailyStreams)}</span>
                        </div>

                        {track.spotifyUrl && (
                          <a
                            href={track.spotifyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="spotify-icon-btn"
                            title="Open on Spotify"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="empty-state">
              No tracks found for this country or search keyword.
            </div>
          )}
        </section>


        {/* ==========================================================================
           SECTION 2: REST API PLAYGROUND & DOCS
           ========================================================================== */}
        <section id="playground" className="playground-section">
          <div className="showcase-header-bar">
            <div className="showcase-title-area">
              <div className="showcase-badge">
                <span className="showcase-badge-dot"></span>
                <span>Developer REST API</span>
              </div>
              <h2 className="showcase-heading">Interactive API Playground</h2>
              <p className="showcase-subtext">
                Test requests in real-time, inspect response schemas, and copy code snippets.
              </p>
            </div>
          </div>

          <div className="playground-layout">
            {/* Left Sidebar: Endpoints List */}
            <div className="endpoints-sidebar">
              <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Endpoints Directory
              </div>

              {ENDPOINTS.map(ep => {
                const isActive = selectedEndpoint.id === ep.id;
                return (
                  <button
                    key={ep.id}
                    onClick={() => handleSelectEndpoint(ep)}
                    className={`endpoint-btn ${isActive ? 'active' : ''}`}
                  >
                    <div className="endpoint-top">
                      <span className="endpoint-name">{ep.name}</span>
                      <span className="method-tag">{ep.method}</span>
                    </div>
                    <div className="endpoint-path">{ep.path}</div>
                  </button>
                );
              })}
            </div>

            {/* Right Workspace: Console + Request Builder + Response Viewer */}
            <div className="console-wrapper">
              {/* Request URL Bar & Execute Button */}
              <div className="console-card">
                <div className="url-bar">
                  <span className="url-method">{selectedEndpoint.method}</span>
                  <div className="url-input-display">{fullRequestUrl}</div>
                  <button
                    onClick={handleExecuteRequest}
                    disabled={isExecuting}
                    className="btn-send"
                  >
                    {isExecuting ? (
                      <>
                        <span className="spinner"></span>
                        <span>Executing...</span>
                      </>
                    ) : (
                      <>
                        <span>Send Request</span>
                        <span>→</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Query Parameters Inputs */}
                {selectedEndpoint.params && selectedEndpoint.params.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
                    <div className="params-title">Query Parameters</div>
                    <div className="params-grid">
                      {selectedEndpoint.params.map(p => (
                        <div key={p.key} className="param-field">
                          <label className="param-label">
                            <span>{p.key}</span>
                            {p.description && <span className="param-desc">{p.description}</span>}
                          </label>
                          <input
                            type="text"
                            value={paramInputs[p.key] || ''}
                            onChange={e =>
                              setParamInputs(prev => ({ ...prev, [p.key]: e.target.value }))
                            }
                            placeholder={p.placeholder}
                            className="param-text-input"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Code Snippets Section */}
              <div className="console-card">
                <div className="code-tabs-header">
                  <div className="code-tabs">
                    <button
                      onClick={() => setActiveCodeTab('curl')}
                      className={`code-tab-btn ${activeCodeTab === 'curl' ? 'active' : ''}`}
                    >
                      cURL
                    </button>
                    <button
                      onClick={() => setActiveCodeTab('js')}
                      className={`code-tab-btn ${activeCodeTab === 'js' ? 'active' : ''}`}
                    >
                      JavaScript
                    </button>
                    <button
                      onClick={() => setActiveCodeTab('python')}
                      className={`code-tab-btn ${activeCodeTab === 'python' ? 'active' : ''}`}
                    >
                      Python
                    </button>
                  </div>

                  <button
                    onClick={() => copyToClipboard(codeSnippets[activeCodeTab], 'code')}
                    className="copy-btn"
                  >
                    {copiedCode ? '✓ Copied' : 'Copy Code'}
                  </button>
                </div>

                <div className="code-block">
                  {codeSnippets[activeCodeTab]}
                </div>
              </div>

              {/* Live Response Panel */}
              <div className="console-card">
                <div className="response-header-bar">
                  <div className="response-meta">
                    <span className="response-tag">Response Body</span>
                    {responseStatus !== null && (
                      <span
                        className={`status-code ${
                          responseStatus >= 200 && responseStatus < 300
                            ? 'status-2xx'
                            : 'status-error'
                        }`}
                      >
                        {responseStatus} {responseStatus === 200 ? 'OK' : 'Error'}
                      </span>
                    )}
                    {responseDuration !== null && (
                      <span className="duration-tag">{responseDuration}ms</span>
                    )}
                    {responseSize && (
                      <span className="size-tag">{responseSize}</span>
                    )}
                  </div>

                  {apiResponse && (
                    <button
                      onClick={() => copyToClipboard(apiResponse, 'json')}
                      className="copy-btn"
                    >
                      {copiedJson ? '✓ Copied JSON' : 'Copy JSON'}
                    </button>
                  )}
                </div>

                {apiResponse ? (
                  <div className="response-viewer">
                    {apiResponse}
                  </div>
                ) : (
                  <div className="response-empty-state">
                    <div style={{ fontSize: '20px' }}>📡</div>
                    <div>Click <b>Send Request</b> to execute and view real JSON response</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="footer">
          <div className="footer-top">
            <div className="footer-brand">
              <img src="/listune.png" alt="Listune Logo" className="footer-logo-img" />
              <span>Listune Top Chart API</span>
              <span style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '12px' }}>
                • Public Spotify Data API
              </span>
            </div>

            <div className="footer-links">
              <a href="#showcase" className="footer-link">Top Charts</a>
              <a href="#playground" className="footer-link">API Reference</a>
              <a
                href="https://kworb.net/spotify/"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-link"
              >
                Kworb.net
              </a>
              <a
                href="https://github.com/lrmn7/listune-top-chart"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-link"
              >
                GitHub
              </a>
            </div>
          </div>

          <div className="footer-disclaimer-box">
            <p>
              <b>Disclaimer:</b> Listune is an independent project and is <b>not affiliated with, endorsed by, or sponsored by Spotify AB</b>. All Spotify trademarks, logos, and album artworks belong to Spotify AB and their respective rights holders. Daily streaming data and chart rankings are aggregated from <a href="https://kworb.net" target="_blank" rel="noopener noreferrer">Kworb.net</a>.
            </p>
          </div>

          <div className="footer-bottom">
            <div>
              © 2026 Listune. All rights reserved. • Made with ♥ by{' '}
              <a
                href="https://lrmn.wtf/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--text-secondary)', textDecoration: 'underline', textUnderlineOffset: '2px' }}
              >
                L RMN
              </a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
