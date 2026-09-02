/**
 * Unified Multi-Dialect Database Layer with Drizzle ORM
 * Supports MySQL (mysql2), PostgreSQL (pg), and SQLite (@libsql/client)
 */

import { drizzle as drizzleMysql } from 'drizzle-orm/mysql2';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql';
import { eq, and, lt, gte, desc, asc, inArray, sql } from 'drizzle-orm';
import mysql from 'mysql2/promise';
import { Pool as PgPool } from 'pg';
import { createClient as createLibsqlClient } from '@libsql/client';

import * as mysqlSchema from './db/schema/mysql';
import * as pgSchema from './db/schema/pg';
import * as sqliteSchema from './db/schema/sqlite';

export type DatabaseDialect = 'mysql' | 'postgresql' | 'sqlite';

export function getDatabaseDialect(): DatabaseDialect {
  const url = process.env.DATABASE_URL || '';
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    return 'postgresql';
  }
  if (url.startsWith('file:') || url.startsWith('sqlite:') || url.endsWith('.db')) {
    return 'sqlite';
  }
  return 'mysql';
}

export interface TrackSnapshotData {
  id?: string;
  trackName: string;
  artistName: string;
  country: string;
  rank: number;
  dailyStreams: bigint;
  totalStreams?: bigint | null;
  createdAt?: Date;
}

export interface TrackCurrentData {
  id?: string;
  trackId?: string | null;
  trackName: string;
  artistName: string;
  country: string;
  rank: number;
  previousRank?: number | null;
  rankDelta?: number | null;
  dailyStreams: bigint;
  totalStreams?: bigint | null;
  imageUrl?: string | null;
  previewUrl?: string | null;
  spotifyUrl?: string | null;
  lastUpdated?: Date;
}

// Global cache for serverless / dev hot-reloading
const globalForDb = globalThis as unknown as {
  dbInstance?: any;
  dbDialect?: DatabaseDialect;
  mysqlPool?: mysql.Pool;
  pgPool?: PgPool;
  libsqlClient?: ReturnType<typeof createLibsqlClient>;
};

function createDbClient() {
  const dialect = getDatabaseDialect();
  const dbUrl = process.env.DATABASE_URL || '';

  if (dialect === 'postgresql') {
    const pool = globalForDb.pgPool ?? new PgPool({ connectionString: dbUrl });
    globalForDb.pgPool = pool;
    return {
      dialect,
      db: drizzlePg(pool, { schema: pgSchema }),
      tables: pgSchema,
    };
  }

  if (dialect === 'sqlite') {
    const client = globalForDb.libsqlClient ?? createLibsqlClient({ url: dbUrl.startsWith('file:') ? dbUrl : `file:${dbUrl}` });
    globalForDb.libsqlClient = client;

    // Auto-create tables & indexes for SQLite if not already created
    client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS "TrackSnapshot" (
        "id" text PRIMARY KEY NOT NULL,
        "trackName" text NOT NULL,
        "artistName" text NOT NULL,
        "country" text DEFAULT 'global' NOT NULL,
        "rank" integer NOT NULL,
        "dailyStreams" integer NOT NULL,
        "totalStreams" integer,
        "createdAt" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "TrackSnapshot_createdAt_idx" ON "TrackSnapshot" ("createdAt");
      CREATE INDEX IF NOT EXISTS "TrackSnapshot_trackName_artistName_idx" ON "TrackSnapshot" ("trackName", "artistName");
      CREATE INDEX IF NOT EXISTS "TrackSnapshot_country_idx" ON "TrackSnapshot" ("country");

      CREATE TABLE IF NOT EXISTS "TrackCurrent" (
        "id" text PRIMARY KEY NOT NULL,
        "trackId" text,
        "trackName" text NOT NULL,
        "artistName" text NOT NULL,
        "country" text DEFAULT 'global' NOT NULL,
        "rank" integer NOT NULL,
        "previousRank" integer,
        "rankDelta" integer,
        "dailyStreams" integer NOT NULL,
        "totalStreams" integer,
        "imageUrl" text,
        "previewUrl" text,
        "spotifyUrl" text,
        "lastUpdated" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "TrackCurrent_trackName_artistName_country_key" ON "TrackCurrent" ("trackName", "artistName", "country");
      CREATE INDEX IF NOT EXISTS "TrackCurrent_rank_idx" ON "TrackCurrent" ("rank");
      CREATE INDEX IF NOT EXISTS "TrackCurrent_trackName_artistName_idx" ON "TrackCurrent" ("trackName", "artistName");
      CREATE INDEX IF NOT EXISTS "TrackCurrent_country_idx" ON "TrackCurrent" ("country");
    `).catch(() => {});

    return {
      dialect,
      db: drizzleLibsql(client, { schema: sqliteSchema }),
      tables: sqliteSchema,
    };
  }

  // MySQL (Default)
  const pool = globalForDb.mysqlPool ?? mysql.createPool({
    uri: dbUrl,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  });
  globalForDb.mysqlPool = pool;
  return {
    dialect,
    db: drizzleMysql(pool, { schema: mysqlSchema, mode: 'default' }),
    tables: mysqlSchema,
  };
}

const clientInfo = globalForDb.dbInstance ?? createDbClient();
if (process.env.NODE_ENV !== 'production') {
  globalForDb.dbInstance = clientInfo;
}

export const db = clientInfo.db;
export const currentDialect = clientInfo.dialect;
export const schemas = clientInfo.tables;

/**
 * Unified repository for TrackSnapshots
 */
export const trackSnapshotRepo = {
  async createMany(items: TrackSnapshotData[]): Promise<void> {
    if (items.length === 0) return;
    const { trackSnapshots } = clientInfo.tables;
    const records = items.map((item) => ({
      id: item.id || crypto.randomUUID(),
      trackName: item.trackName,
      artistName: item.artistName,
      country: item.country || 'global',
      rank: item.rank,
      dailyStreams: item.dailyStreams,
      totalStreams: item.totalStreams ?? null,
      createdAt: item.createdAt || new Date(),
    }));

    // Batch insert
    const batchSize = 50;
    for (let i = 0; i < records.length; i += batchSize) {
      const chunk = records.slice(i, i + batchSize);
      await (clientInfo.db as any).insert(trackSnapshots).values(chunk);
    }
  },

  async findBaseline(trackName: string, artistName: string, country: string, beforeDate: Date): Promise<{ rank: number } | null> {
    const { trackSnapshots } = clientInfo.tables;
    const rows = await (clientInfo.db as any)
      .select({ rank: trackSnapshots.rank })
      .from(trackSnapshots)
      .where(
        and(
          eq(trackSnapshots.trackName, trackName),
          eq(trackSnapshots.artistName, artistName),
          eq(trackSnapshots.country, country),
          lt(trackSnapshots.createdAt, beforeDate)
        )
      )
      .orderBy(desc(trackSnapshots.createdAt))
      .limit(1);

    return rows.length > 0 ? rows[0] : null;
  },

  async findHistory(trackName: string, artistName: string, country: string, sinceDate: Date): Promise<Array<{
    createdAt: Date;
    dailyStreams: bigint;
    totalStreams: bigint | null;
    rank: number;
  }>> {
    const { trackSnapshots } = clientInfo.tables;
    const rows = await (clientInfo.db as any)
      .select({
        createdAt: trackSnapshots.createdAt,
        dailyStreams: trackSnapshots.dailyStreams,
        totalStreams: trackSnapshots.totalStreams,
        rank: trackSnapshots.rank,
      })
      .from(trackSnapshots)
      .where(
        and(
          eq(trackSnapshots.trackName, trackName),
          eq(trackSnapshots.artistName, artistName),
          eq(trackSnapshots.country, country),
          gte(trackSnapshots.createdAt, sinceDate)
        )
      )
      .orderBy(asc(trackSnapshots.createdAt));

    return rows.map((r: any) => ({
      ...r,
      createdAt: r.createdAt instanceof Date ? r.createdAt : new Date(Number(r.createdAt)),
    }));
  },

  async deleteByTrack(trackName: string, artistName: string, country: string): Promise<number> {
    const { trackSnapshots } = clientInfo.tables;
    const res = await (clientInfo.db as any)
      .delete(trackSnapshots)
      .where(
        and(
          eq(trackSnapshots.trackName, trackName),
          eq(trackSnapshots.artistName, artistName),
          eq(trackSnapshots.country, country)
        )
      );
    return res?.rowsAffected ?? 0;
  },

  async count(): Promise<number> {
    const { trackSnapshots } = clientInfo.tables;
    const res = await (clientInfo.db as any).select({ count: sql<number>`count(*)` }).from(trackSnapshots);
    return Number(res[0]?.count ?? 0);
  },
};

/**
 * Unified repository for TrackCurrents
 */
export const trackCurrentRepo = {
  async findUnique(trackName: string, artistName: string, country: string): Promise<TrackCurrentData | null> {
    const { trackCurrents } = clientInfo.tables;
    const rows = await (clientInfo.db as any)
      .select()
      .from(trackCurrents)
      .where(
        and(
          eq(trackCurrents.trackName, trackName),
          eq(trackCurrents.artistName, artistName),
          eq(trackCurrents.country, country)
        )
      )
      .limit(1);

    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      ...r,
      lastUpdated: r.lastUpdated instanceof Date ? r.lastUpdated : new Date(Number(r.lastUpdated)),
    };
  },

  async findMany(options?: {
    country?: string;
    dailyStreamsLt?: bigint;
    limit?: number;
    orderByRank?: boolean;
  }): Promise<TrackCurrentData[]> {
    const { trackCurrents } = clientInfo.tables;
    const conditions = [];

    if (options?.country) {
      conditions.push(eq(trackCurrents.country, options.country));
    }
    if (options?.dailyStreamsLt !== undefined) {
      conditions.push(lt(trackCurrents.dailyStreams, options.dailyStreamsLt));
    }

    let query = (clientInfo.db as any).select().from(trackCurrents);
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    if (options?.orderByRank) {
      query = query.orderBy(asc(trackCurrents.rank));
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const rows = await query;
    return rows.map((r: any) => ({
      ...r,
      lastUpdated: r.lastUpdated instanceof Date ? r.lastUpdated : new Date(Number(r.lastUpdated)),
    }));
  },

  async findLatestUpdated(): Promise<{ lastUpdated: Date } | null> {
    const { trackCurrents } = clientInfo.tables;
    const rows = await (clientInfo.db as any)
      .select({ lastUpdated: trackCurrents.lastUpdated })
      .from(trackCurrents)
      .orderBy(desc(trackCurrents.lastUpdated))
      .limit(1);

    if (rows.length === 0) return null;
    const lu = rows[0].lastUpdated;
    return {
      lastUpdated: lu instanceof Date ? lu : new Date(Number(lu)),
    };
  },

  async upsert(data: TrackCurrentData): Promise<void> {
    const { trackCurrents } = clientInfo.tables;
    const existing = await this.findUnique(data.trackName, data.artistName, data.country);

    if (existing) {
      await (clientInfo.db as any)
        .update(trackCurrents)
        .set({
          rank: data.rank,
          previousRank: data.previousRank ?? existing.previousRank,
          rankDelta: data.rankDelta ?? existing.rankDelta,
          dailyStreams: data.dailyStreams,
          totalStreams: data.totalStreams ?? existing.totalStreams,
          trackId: data.trackId || existing.trackId,
          imageUrl: data.imageUrl || existing.imageUrl,
          previewUrl: data.previewUrl || existing.previewUrl,
          spotifyUrl: data.spotifyUrl || existing.spotifyUrl,
          lastUpdated: new Date(),
        })
        .where(
          and(
            eq(trackCurrents.trackName, data.trackName),
            eq(trackCurrents.artistName, data.artistName),
            eq(trackCurrents.country, data.country)
          )
        );
    } else {
      await (clientInfo.db as any).insert(trackCurrents).values({
        id: data.id || crypto.randomUUID(),
        trackId: data.trackId || null,
        trackName: data.trackName,
        artistName: data.artistName,
        country: data.country || 'global',
        rank: data.rank,
        previousRank: data.previousRank ?? null,
        rankDelta: data.rankDelta ?? null,
        dailyStreams: data.dailyStreams,
        totalStreams: data.totalStreams ?? null,
        imageUrl: data.imageUrl || null,
        previewUrl: data.previewUrl || null,
        spotifyUrl: data.spotifyUrl || null,
        lastUpdated: new Date(),
      });
    }
  },

  async deleteStale(country: string, beforeDate: Date): Promise<number> {
    const { trackCurrents } = clientInfo.tables;
    const res = await (clientInfo.db as any)
      .delete(trackCurrents)
      .where(and(eq(trackCurrents.country, country), lt(trackCurrents.lastUpdated, beforeDate)));
    return res?.rowsAffected ?? 0;
  },

  async deleteByTrack(trackName: string, artistName: string, country: string): Promise<number> {
    const { trackCurrents } = clientInfo.tables;
    const res = await (clientInfo.db as any)
      .delete(trackCurrents)
      .where(
        and(
          eq(trackCurrents.trackName, trackName),
          eq(trackCurrents.artistName, artistName),
          eq(trackCurrents.country, country)
        )
      );
    return res?.rowsAffected ?? 0;
  },

  async deleteByIds(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const { trackCurrents } = clientInfo.tables;
    const res = await (clientInfo.db as any)
      .delete(trackCurrents)
      .where(inArray(trackCurrents.id, ids));
    return res?.rowsAffected ?? 0;
  },

  async count(country?: string): Promise<number> {
    const { trackCurrents } = clientInfo.tables;
    let query = (clientInfo.db as any).select({ count: sql<number>`count(*)` }).from(trackCurrents);
    if (country) {
      query = query.where(eq(trackCurrents.country, country));
    }
    const res = await query;
    return Number(res[0]?.count ?? 0);
  },
};

/**
 * Health check & diagnostic query execution
 */
export async function testDbConnection(): Promise<{ success: boolean; version?: string; error?: any }> {
  try {
    const dialect = getDatabaseDialect();
    if (dialect === 'sqlite') {
      const res = await (clientInfo.db as any).run(sql`SELECT 1 as test`);
      return { success: true, version: 'SQLite LibSQL' };
    }
    const res = await (clientInfo.db as any).execute(sql`SELECT version() as version`);
    const version = Array.isArray(res) && res[0]?.[0]?.version ? res[0][0].version : 'Connected';
    return { success: true, version: String(version) };
  } catch (error) {
    return { success: false, error };
  }
}

/**
 * Clean disconnect for standalone CLI workers and scripts
 */
export async function closeDbConnection(): Promise<void> {
  if (globalForDb.mysqlPool) {
    await globalForDb.mysqlPool.end();
    globalForDb.mysqlPool = undefined;
  }
  if (globalForDb.pgPool) {
    await globalForDb.pgPool.end();
    globalForDb.pgPool = undefined;
  }
  if (globalForDb.libsqlClient) {
    globalForDb.libsqlClient.close();
    globalForDb.libsqlClient = undefined;
  }
  globalForDb.dbInstance = undefined;
}
