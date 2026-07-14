const cron = require('node-cron');
const { performBackup, cleanupOldBackups } = require('../services/backupService');

function initBackupCron() {
  console.log('[CRON] Initializing backup schedule...');

  cron.schedule('0 3 * * *', async () => {
    console.log('[CRON] Running daily full backup at 3:00 AM...');
    try {
      const result = await performBackup('daily');
      if (result.success) {
        console.log(`[CRON] Daily backup completed: ${result.backupId}`);
      } else {
        console.error(`[CRON] Daily backup failed: ${result.error}`);
      }
    } catch (err) {
      console.error('[CRON] Daily backup error:', err.message);
    }
  }, { timezone: 'Asia/Kolkata' });

  cron.schedule('0 */6 * * *', async () => {
    const hour = new Date().getHours();
    if (hour === 3) return;
    console.log(`[CRON] Running incremental backup at ${hour}:00...`);
    try {
      const result = await performBackup('incremental');
      if (result.success) {
        console.log(`[CRON] Incremental backup completed: ${result.backupId}`);
      }
    } catch (err) {
      console.error('[CRON] Incremental backup error:', err.message);
    }
  }, { timezone: 'Asia/Kolkata' });

  cron.schedule('0 4 * * *', async () => {
    console.log('[CRON] Running backup cleanup (keep 7 days)...');
    try {
      const deleted = await cleanupOldBackups(7);
      console.log(`[CRON] Cleanup completed: ${deleted} backups removed`);
    } catch (err) {
      console.error('[CRON] Cleanup error:', err.message);
    }
  }, { timezone: 'Asia/Kolkata' });

  console.log('[CRON] Backup schedule initialized:');
  console.log('  - Daily backup: 3:00 AM IST');
  console.log('  - Incremental: Every 6 hours');
  console.log('  - Cleanup: 4:00 AM IST (keep 7 days)');
}

module.exports = { initBackupCron };
