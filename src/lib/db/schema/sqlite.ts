import { sqliteTable, text, integer, uniqueIndex, index, customType } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

const sqliteBigInt = customType<{ data: bigint; driverData: number | string }>({
  dataType() {
    return 'integer';
  },
  toDriver(val: bigint) {
    return Number(val);
  },
  fromDriver(val: number | string) {
    return BigInt(val);
  },
});

export const trackSnapshots = sqliteTable(
  'TrackSnapshot',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    trackName: text('trackName').notNull(),
    artistName: text('artistName').notNull(),
    country: text('country').default('global').notNull(),
    rank: integer('rank').notNull(),
    dailyStreams: sqliteBigInt('dailyStreams').notNull(),
    totalStreams: sqliteBigInt('totalStreams'),
    createdAt: integer('createdAt', { mode: 'timestamp_ms' }).default(sql`(strftime('%s', 'now') * 1000)`).notNull(),
  },
  (table) => [
    index('TrackSnapshot_createdAt_idx').on(table.createdAt),
    index('TrackSnapshot_trackName_artistName_idx').on(table.trackName, table.artistName),
    index('TrackSnapshot_country_idx').on(table.country),
  ]
);

export const trackCurrents = sqliteTable(
  'TrackCurrent',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    trackId: text('trackId'),
    trackName: text('trackName').notNull(),
    artistName: text('artistName').notNull(),
    country: text('country').default('global').notNull(),
    rank: integer('rank').notNull(),
    previousRank: integer('previousRank'),
    rankDelta: integer('rankDelta'),
    dailyStreams: sqliteBigInt('dailyStreams').notNull(),
    totalStreams: sqliteBigInt('totalStreams'),
    imageUrl: text('imageUrl'),
    previewUrl: text('previewUrl'),
    spotifyUrl: text('spotifyUrl'),
    lastUpdated: integer('lastUpdated', { mode: 'timestamp_ms' }).default(sql`(strftime('%s', 'now') * 1000)`).notNull(),
  },
  (table) => [
    uniqueIndex('TrackCurrent_trackName_artistName_country_key').on(table.trackName, table.artistName, table.country),
    index('TrackCurrent_rank_idx').on(table.rank),
    index('TrackCurrent_trackName_artistName_idx').on(table.trackName, table.artistName),
    index('TrackCurrent_country_idx').on(table.country),
  ]
);
