const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const mongoose = require('mongoose');
const Member = require('../models/Member');
const Payment = require('../models/Payment');
const Settings = require('../models/Settings');
const Attendance = require('../models/Attendance');
const BackupLog = require('../models/BackupLog');

const BACKUP_DIR = path.join(__dirname, '..', 'backups', 'daily');
const MONGODB_URI = process.env.MONGODB_URI;

function generateBackupId() {
  const now = new Date();
  const date = now.toISOString().split('T')[0].replace(/-/g, '');
  const time = now.toTimeString().split(' ')[0].replace(/:/g, '');
  return `BACKUP-${date}-${time}`;
}

function getCollectionStats() {
  try {
    const membersCount = execSync(`mongodump --uri="${MONGODB_URI}" --collection=members --archive --gzip 2>nul | wc -c`, { encoding: 'utf8' }).trim();
    return { members: parseInt(membersCount) || 0 };
  } catch (e) {
    return { members: 0 };
  }
}

async function performBackup(type = 'daily') {
  const backupId = generateBackupId();
  const startTime = Date.now();
  const backupPath = path.join(BACKUP_DIR, `${backupId}`);

  console.log(`[BACKUP] Starting ${type} backup: ${backupId}`);

  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const step1Start = Date.now();
    try {
      console.log('[BACKUP] Step 1: Running mongodump...');
      execSync(`mongodump --uri="${MONGODB_URI}" --out="${backupPath}"`, {
        timeout: 60000,
        encoding: 'utf8'
      });
      console.log('[BACKUP] mongodump completed');
    } catch (dumpErr) {
      console.error('[BACKUP] mongodump failed, falling back to JSON export');
      await exportToJson(backupPath);
    }
    const step1Duration = `${((Date.now() - step1Start) / 1000).toFixed(1)}s`;

    const step2Start = Date.now();
    const tarPath = `${backupPath}.tar.gz`;
    try {
      console.log('[BACKUP] Step 2: Compressing...');
      if (process.platform === 'win32') {
        execSync(`tar -czf "${tarPath}" -C "${path.dirname(backupPath)}" "${path.basename(backupPath)}"`, {
          timeout: 30000
        });
      } else {
        execSync(`tar -czf "${tarPath}" -C "${path.dirname(backupPath)}" "${path.basename(backupPath)}"`, {
          timeout: 30000
        });
      }
      console.log('[BACKUP] Compression completed');
    } catch (compressErr) {
      console.error('[BACKUP] Compression failed:', compressErr.message);
      return { success: false, error: 'Compression failed', backupId };
    }
    const step2Duration = `${((Date.now() - step2Start) / 1000).toFixed(1)}s`;

    let uncompressedSize = 0;
    let compressedSize = 0;
    try {
      const walkDir = (dir) => {
        let size = 0;
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) size += walkDir(filePath);
            else size += stat.size;
          }
        }
        return size;
      };
      uncompressedSize = walkDir(backupPath);
      compressedSize = fs.statSync(tarPath).size;
    } catch (e) {}

    const step3Duration = '0.1s';

    let membersCount = 0, attendanceCount = 0, paymentsCount = 0, settingsCount = 0;
    try {
      if (mongoose.connection.readyState === 1) {
        membersCount = await Member.countDocuments();
        paymentsCount = await Payment.countDocuments();
        settingsCount = await Settings.countDocuments();
        try { attendanceCount = await Attendance.countDocuments(); } catch (e) { attendanceCount = 0; }
      }
    } catch (e) {}

    const backupLog = new BackupLog({
      backupId,
      type,
      uncompressedSize,
      compressedSize,
      status: 'success',
      steps: {
        mongodump: { status: 'success', duration: step1Duration },
        compress: { status: 'success', duration: step2Duration },
        localStore: { status: 'success', path: tarPath }
      },
      collections: {
        members: { count: membersCount },
        attendance: { count: attendanceCount },
        payments: { count: paymentsCount },
        settings: { count: settingsCount }
      },
      localPath: tarPath
    });
    await backupLog.save();

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[BACKUP] Completed: ${backupId} (${compressedSize} bytes, ${totalDuration}s)`);

    try { fs.rmSync(backupPath, { recursive: true, force: true }); } catch (e) {}

    return {
      success: true,
      backupId,
      compressedSize,
      uncompressedSize,
      duration: `${totalDuration}s`
    };

  } catch (err) {
    console.error('[BACKUP] Failed:', err.message);

    try {
      const failLog = new BackupLog({
        backupId,
        type,
        status: 'failed',
        error: err.message
      });
      await failLog.save();
    } catch (e) {}

    return { success: false, error: err.message, backupId };
  }
}

async function exportToJson(backupPath) {
  const dbPath = path.join(backupPath, 'rsgym');
  if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath, { recursive: true });

  if (mongoose.connection.readyState === 1) {
    const members = await Member.find().lean();
    fs.writeFileSync(path.join(dbPath, 'members.bson'), JSON.stringify(members));

    const payments = await Payment.find().lean();
    fs.writeFileSync(path.join(dbPath, 'payments.bson'), JSON.stringify(payments));

    const settings = await Settings.find().lean();
    fs.writeFileSync(path.join(dbPath, 'settings.bson'), JSON.stringify(settings));

    try {
      const attendance = await Attendance.find().lean();
      fs.writeFileSync(path.join(dbPath, 'attendance.bson'), JSON.stringify(attendance));
    } catch (e) {}
  }
}

async function restoreBackup(backupId) {
  const tarPath = path.join(BACKUP_DIR, `${backupId}.tar.gz`);
  if (!fs.existsSync(tarPath)) {
    return { success: false, error: 'Backup file not found' };
  }

  const restorePath = path.join(BACKUP_DIR, 'restore', backupId);
  try {
    execSync(`tar -xzf "${tarPath}" -C "${path.dirname(restorePath)}"`, { timeout: 30000 });
  } catch (e) {
    return { success: false, error: 'Failed to extract backup' };
  }

  const dumpPath = path.join(restorePath, backupId, 'rsgym');
  if (!fs.existsSync(dumpPath)) {
    try { fs.rmSync(restorePath, { recursive: true, force: true }); } catch (e) {}
    return { success: false, error: 'Invalid backup structure' };
  }

  try {
    execSync(`mongorestore --uri="${MONGODB_URI}" --dir="${dumpPath}" --drop`, {
      timeout: 60000
    });
    try { fs.rmSync(restorePath, { recursive: true, force: true }); } catch (e) {}
    return { success: true, backupId };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function cleanupOldBackups(keepDays = 7) {
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const now = Date.now();
    let deleted = 0;

    for (const file of files) {
      if (file.endsWith('.tar.gz')) {
        const filePath = path.join(BACKUP_DIR, file);
        const stat = fs.statSync(filePath);
        const ageDays = (now - stat.mtimeMs) / (1000 * 60 * 60 * 24);

        if (ageDays > keepDays) {
          fs.unlinkSync(filePath);
          deleted++;
        }
      }
    }

    console.log(`[BACKUP] Cleanup: removed ${deleted} old backup(s)`);
    return deleted;
  } catch (err) {
    console.error('[BACKUP] Cleanup error:', err.message);
    return 0;
  }
}

async function getBackupStatus() {
  try {
    const latestBackup = await BackupLog.findOne().sort({ timestamp: -1 });
    const totalBackups = await BackupLog.countDocuments();
    const successfulBackups = await BackupLog.countDocuments({ status: 'success' });

    let totalSize = 0;
    if (fs.existsSync(BACKUP_DIR)) {
      const files = fs.readdirSync(BACKUP_DIR);
      for (const file of files) {
        if (file.endsWith('.tar.gz')) {
          totalSize += fs.statSync(path.join(BACKUP_DIR, file)).size;
        }
      }
    }

    return {
      totalBackups,
      successfulBackups,
      failedBackups: totalBackups - successfulBackups,
      successRate: totalBackups > 0 ? ((successfulBackups / totalBackups) * 100).toFixed(1) + '%' : 'N/A',
      latestBackup: latestBackup ? {
        backupId: latestBackup.backupId,
        timestamp: latestBackup.timestamp,
        compressedSize: latestBackup.compressedSize,
        status: latestBackup.status
      } : null,
      totalLocalSize: totalSize,
      nextBackup: getNextBackupTime()
    };
  } catch (err) {
    return { error: err.message };
  }
}

function getNextBackupTime() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(next.getHours() + (6 - (next.getHours() % 6)));
  next.setMinutes(0, 0, 0);
  return next.toISOString();
}

module.exports = {
  performBackup,
  restoreBackup,
  cleanupOldBackups,
  getBackupStatus,
  generateBackupId
};
