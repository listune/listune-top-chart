import { testDbConnection, getDatabaseDialect } from '@/lib/db';
import { NextResponse } from 'next/server';

// Test endpoint to diagnose database connection issues
// Access at: /api/test-db
export const dynamic = 'force-dynamic';

export async function GET() {
  const dialect = getDatabaseDialect();
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    dialect,
    databaseUrlPrefix: process.env.DATABASE_URL 
      ? process.env.DATABASE_URL.substring(0, 30) + '...' 
      : 'NOT SET',
    nodeEnv: process.env.NODE_ENV,
  };

  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      status: 'error',
      message: 'DATABASE_URL environment variable is not set',
      diagnostics,
    }, { status: 500 });
  }

  // Try to connect to database using Drizzle
  const connResult = await testDbConnection();

  if (connResult.success) {
    return NextResponse.json({
      status: 'success',
      message: 'Database connection successful',
      diagnostics: {
        ...diagnostics,
        connectionTest: 'passed',
        databaseVersion: connResult.version,
      },
    });
  }

  const error = connResult.error || {};
  return NextResponse.json({
    status: 'error',
    message: 'Database connection failed',
    error: {
      message: error.message || String(error),
      code: error.code,
      name: error.name,
    },
    diagnostics: {
      ...diagnostics,
      connectionTest: 'failed',
    },
  }, { status: 500 });
}
