import { mysqlTable, varchar, int, bigint, datetime, uniqueIndex, index } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

export const trackSnapshots = mysqlTable(
  'TrackSnapshot',
  {
    id: varchar('id', { length: 191 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    trackName: varchar('trackName', { length: 500 }).notNull(),
    artistName: varchar('artistName', { length: 255 }).notNull(),
    country: varchar('country', { length: 10 }).default('global').notNull(),
    rank: int('rank').notNull(),
    dailyStreams: bigint('dailyStreams', { mode: 'bigint' }).notNull(),
    totalStreams: bigint('totalStreams', { mode: 'bigint' }),
    createdAt: datetime('createdAt', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => [
    index('TrackSnapshot_createdAt_idx').on(table.createdAt),
    index('TrackSnapshot_trackName_artistName_idx').on(table.trackName, table.artistName),
    index('TrackSnapshot_country_idx').on(table.country),
  ]
);

export const trackCurrents = mysqlTable(
  'TrackCurrent',
  {
    id: varchar('id', { length: 191 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    trackId: varchar('trackId', { length: 255 }),
    trackName: varchar('trackName', { length: 500 }).notNull(),
    artistName: varchar('artistName', { length: 255 }).notNull(),
    country: varchar('country', { length: 10 }).default('global').notNull(),
    rank: int('rank').notNull(),
    previousRank: int('previousRank'),
    rankDelta: int('rankDelta'),
    dailyStreams: bigint('dailyStreams', { mode: 'bigint' }).notNull(),
    totalStreams: bigint('totalStreams', { mode: 'bigint' }),
    imageUrl: varchar('imageUrl', { length: 500 }),
    previewUrl: varchar('previewUrl', { length: 500 }),
    spotifyUrl: varchar('spotifyUrl', { length: 500 }),
    lastUpdated: datetime('lastUpdated', { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)`).notNull(),
  },
  (table) => [
    uniqueIndex('TrackCurrent_trackName_artistName_country_key').on(table.trackName, table.artistName, table.country),
    index('TrackCurrent_rank_idx').on(table.rank),
    index('TrackCurrent_trackName_artistName_idx').on(table.trackName, table.artistName),
    index('TrackCurrent_country_idx').on(table.country),
  ]
);
