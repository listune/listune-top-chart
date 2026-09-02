import { NextResponse } from 'next/server';
import { trackCurrentRepo } from '@/lib/db';

// Force dynamic rendering since we query the database
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const latestTrack = await trackCurrentRepo.findLatestUpdated();
    
    return NextResponse.json({ 
      lastUpdated: latestTrack?.lastUpdated?.toISOString() || null,
    });
  } catch (error) {
    console.error('Error fetching last updated:', error);
    return NextResponse.json(
      { error: 'Failed to fetch last updated' },
      { status: 500 }
    );
  }
}
