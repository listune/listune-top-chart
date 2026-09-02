import 'dotenv/config';
import { trackCurrentRepo, trackSnapshotRepo, closeDbConnection } from './src/lib/db';

async function checkData() {
  try {
    const globalTracks = await trackCurrentRepo.count('global');
    const idTracks = await trackCurrentRepo.count('id');
    const totalSnapshots = await trackSnapshotRepo.count();
    const totalTracks = await trackCurrentRepo.count();

    console.log('📊 Current data status in Database:');
    console.log('- Total Track Current records:', totalTracks);
    console.log('- Global tracks:', globalTracks);
    console.log('- Indonesia tracks:', idTracks);
    console.log('- Total Track Snapshots:', totalSnapshots);

    if (totalTracks === 0) {
      console.log('\n⚠️ No track data found. You can run data refresh using:');
      console.log('node refresh-data.js');
    } else {
      console.log('\n✅ Database is populated with track data!');
    }
  } catch (error) {
    console.error('Error checking data:', error);
  } finally {
    await closeDbConnection();
    process.exit(0);
  }
}

checkData();
