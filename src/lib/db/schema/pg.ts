import { pgTable, varchar, integer, bigint, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const trackSnapshots = pgTable(
  'TrackSnapshot',
  {
    id: varchar('id', { length: 191 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    trackName: varchar('trackName', { length: 500 }).notNull(),
    artistName: varchar('artistName', { length: 255 }).notNull(),
    country: varchar('country', { length: 10 }).default('global').notNull(),
    rank: integer('rank').notNull(),
    dailyStreams: bigint('dailyStreams', { mode: 'bigint' }).notNull(),
    totalStreams: bigint('totalStreams', { mode: 'bigint' }),
    createdAt: timestamp('createdAt', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [
    index('TrackSnapshot_createdAt_idx').on(table.createdAt),
    index('TrackSnapshot_trackName_artistName_idx').on(table.trackName, table.artistName),
    index('TrackSnapshot_country_idx').on(table.country),
  ]
);

export const trackCurrents = pgTable(
  'TrackCurrent',
  {
    id: varchar('id', { length: 191 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    trackId: varchar('trackId', { length: 255 }),
    trackName: varchar('trackName', { length: 500 }).notNull(),
    artistName: varchar('artistName', { length: 255 }).notNull(),
    country: varchar('country', { length: 10 }).default('global').notNull(),
    rank: integer('rank').notNull(),
    previousRank: integer('previousRank'),
    rankDelta: integer('rankDelta'),
    dailyStreams: bigint('dailyStreams', { mode: 'bigint' }).notNull(),
    totalStreams: bigint('totalStreams', { mode: 'bigint' }),
    imageUrl: varchar('imageUrl', { length: 500 }),
    previewUrl: varchar('previewUrl', { length: 500 }),
    spotifyUrl: varchar('spotifyUrl', { length: 500 }),
    lastUpdated: timestamp('lastUpdated', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [
    uniqueIndex('TrackCurrent_trackName_artistName_country_key').on(table.trackName, table.artistName, table.country),
    index('TrackCurrent_rank_idx').on(table.rank),
    index('TrackCurrent_trackName_artistName_idx').on(table.trackName, table.artistName),
    index('TrackCurrent_country_idx').on(table.country),
  ]
);
