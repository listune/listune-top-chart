import { NextResponse } from 'next/server';
import { trackSnapshotRepo } from '@/lib/db';

// Force dynamic rendering since we use request.url
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const trackName = searchParams.get('trackName');
    const artistName = searchParams.get('artistName');
    const days = parseInt(searchParams.get('days') || '30', 10);
    const country = searchParams.get('country') || 'global';
    
    if (!trackName || !artistName) {
      return NextResponse.json(
        { error: 'trackName and artistName query parameters are required' },
        { status: 400 }
      );
    }
    
    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Fetch snapshots for this track
    const snapshots = await trackSnapshotRepo.findHistory(trackName, artistName, country, startDate);
    
    // Transform data for charts
    const chartData = snapshots.map(snapshot => ({
      date: snapshot.createdAt.toISOString(),
      dailyStreams: Number(snapshot.dailyStreams),
      totalStreams: snapshot.totalStreams ? Number(snapshot.totalStreams) : null,
      rank: snapshot.rank,
    }));
    
    return NextResponse.json({ 
      trackName,
      artistName,
      country,
      history: chartData,
      dataPoints: chartData.length,
    });
  } catch (error) {
    console.error('Error fetching track history:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Failed to fetch track history',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}