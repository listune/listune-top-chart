import { NextResponse } from 'next/server';
import { trackCurrentRepo } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const country = searchParams.get('country') || 'global';
        const cleanup = searchParams.get('cleanup') === 'true';

        // --- TRACKS ---
        const tracks = await trackCurrentRepo.findMany({
            country,
            orderByRank: true,
        });

        const trackDups = findDuplicates(tracks, 'trackName');

        let deletedTracks = 0;
        if (cleanup && trackDups.length > 0) {
            console.log('Cleaning up track duplicates...');
            const allLoserIds = trackDups.flatMap(g => g.losers.map((l: any) => l.id));
            deletedTracks = await trackCurrentRepo.deleteByIds(allLoserIds);
        }

        return NextResponse.json({
            mode: cleanup ? 'CLEANUP_EXECUTED' : 'DRY_RUN',
            country,
            tracks: {
                total: tracks.length,
                duplicatesFound: trackDups.length,
                deleted: deletedTracks,
                examples: trackDups.slice(0, 5)
            }
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

function findDuplicates(items: any[], nameField: string) {
    const byRank: Record<number, any[]> = {};
    items.forEach(i => {
        if (!byRank[i.rank]) byRank[i.rank] = [];
        byRank[i.rank].push(i);
    });

    const duplicates: any[] = [];
    Object.entries(byRank).forEach(([rank, rankItems]) => {
        if (rankItems.length > 1) {
            const sorted = rankItems.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
            const winner = sorted[0];
            const losers = sorted.slice(1);

            duplicates.push({
                rank: parseInt(rank),
                winner: { name: winner[nameField], lastUpdated: winner.lastUpdated },
                losers: losers.map((l: any) => ({ id: l.id, name: l[nameField], lastUpdated: l.lastUpdated }))
            });
        }
    });
    return duplicates;
}
