// Helper launcher for check-data.ts
const { spawnSync } = require('child_process');
const result = spawnSync('npx', ['tsx', 'check-data.ts'], { stdio: 'inherit', shell: true });
process.exit(result.status || 0);