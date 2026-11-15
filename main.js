const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const { exec } = require('child_process');
const XLSX = require('xlsx');

// ===== 自动更新配置（GitHub）=====
const GITHUB_REPO = 'wdwwangdawei/class-service';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const UPDATE_ASSET_NAME = 'app.asar';

// 数据目录放在 AppData（与程序分离，覆盖安装不丢数据）
const DATA_DIR = path.join(app.getPath('userData'), 'data');
const TABLES_FILE = path.join(DATA_DIR, 'tables.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const SECRETS_FILE = path.join(DATA_DIR, 'secrets.json');
const RANK_FILE = path.join(DATA_DIR, 'rank.json');
const ROSTER_FILE = path.join(DATA_DIR, 'roster.json');
const DUTY_FILE = path.join(DATA_DIR, 'duty.json');
const HOMEWORK_FILE = path.join(DATA_DIR, 'homework.json');

// 兼容旧版本：如果旧位置有数据，自动迁移
function migrateOldData() {
  // 1) 旧版：数据放在 exe 同级的 data 目录
  const exeDir = path.dirname(process.execPath);
  const oldExeDataDir = path.join(exeDir, 'data');
  // 2) 旧版应用名 group-schedule-manager 的 AppData 数据目录（改名前）
  const oldAppDataDir = path.join(app.getPath('appData'), 'group-schedule-manager', 'data');

  const sources = [oldExeDataDir, oldAppDataDir];

  for (const oldDataDir of sources) {
    if (fs.existsSync(oldDataDir) && !fs.existsSync(TABLES_FILE)) {
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        const files = ['tables.json', 'config.json', 'operation-log.json'];
        let migrated = false;
        for (const f of files) {
          const src = path.join(oldDataDir, f);
          const dst = path.join(DATA_DIR, f);
          if (fs.existsSync(src) && !fs.existsSync(dst)) {
            fs.copyFileSync(src, dst);
            migrated = true;
          }
        }
        if (migrated) console.log('数据已从旧位置迁移到: ' + DATA_DIR);
        break;
      } catch(e) {
        console.error('数据迁移失败: ' + e.message);
      }
    }
  }
}

function loadSecrets() {
  ensureDataDir();
  if (!fs.existsSync(SECRETS_FILE)) {
    const defaults = {
      defaultPassword: '0912',
      superAdminPassword: '258000',
      creatorPassword: 'wdw258000',
      githubToken: process.env.CLASS_SERVICE_GITHUB_TOKEN || process.env.GITHUB_TOKEN || ''
    };
    fs.writeFileSync(SECRETS_FILE, JSON.stringify(defaults, null, 2), 'utf-8');
    return defaults;
  }
  try {
    const data = fs.readFileSync(SECRETS_FILE, 'utf-8').replace(/^\uFEFF/, '');
    const secrets = JSON.parse(data);
    if (!secrets.defaultPassword) secrets.defaultPassword = '0912';
    if (!secrets.superAdminPassword) secrets.superAdminPassword = '258000';
    if (!secrets.creatorPassword) secrets.creatorPassword = 'wdw258000';
    secrets.githubToken = secrets.githubToken || process.env.CLASS_SERVICE_GITHUB_TOKEN || process.env.GITHUB_TOKEN || '';
    return secrets;
  } catch (e) {
    console.error('加载 secrets.json 失败:', e);
    return { defaultPassword: '0912', superAdminPassword: '258000', creatorPassword: 'wdw258000', githubToken: process.env.CLASS_SERVICE_GITHUB_TOKEN || process.env.GITHUB_TOKEN || '' };
  }
}

function loadConfig() {
  ensureDataDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    const defaultConfig = { password: '', passwordEnabled: false, uninstallPasswordEnabled: false, lastRunVersion: '', soundEnabled: true, soundVolume: 50, language: 'zh', fontFamily: 'Microsoft YaHei', bgmEnabled: false, bgmVolume: 30, passwordLocked: false, tablesLocked: false, autoSave: true, autoLock: false, themeSkin: 'default', displayTheme: 'light' };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    return defaultConfig;
  }
  try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf-8').replace(/^\uFEFF/, '');
    const config = JSON.parse(data);
    let configChanged = false;
    if (config.password === undefined) config.password = '';
    if (config.passwordEnabled === undefined) config.passwordEnabled = false;
    // 旧版遗留默认密码（0000/0912）一次性取消，避免升级后用户不知情被锁在启动页
    if (config.defaultPasswordCleared !== true) {
      if (config.password === '0000' || config.password === '0912') {
        config.password = '';
        config.passwordEnabled = false;
      }
      config.defaultPasswordCleared = true;
      configChanged = true;
    }
    if (!config.password) config.passwordEnabled = false;
    if (config.uninstallPasswordEnabled === undefined) config.uninstallPasswordEnabled = true;
    if (!config.lastRunVersion) config.lastRunVersion = '';
    if (config.soundEnabled === undefined) config.soundEnabled = true;
    if (config.soundVolume === undefined) config.soundVolume = 50;
    if (config.language === undefined) config.language = 'zh';
    if (config.fontFamily === undefined) config.fontFamily = 'Microsoft YaHei';
    if (config.bgmEnabled === undefined) config.bgmEnabled = false;
    if (config.bgmVolume === undefined) config.bgmVolume = 30;
    if (config.passwordLocked === undefined) config.passwordLocked = false;
    if (config.tablesLocked === undefined) config.tablesLocked = false;
    if (config.autoSave === undefined) config.autoSave = true;
    if (config.autoLock === undefined) config.autoLock = false;
    if (config.themeSkin === undefined) config.themeSkin = 'default';
    if (config.displayTheme === undefined) config.displayTheme = 'light';
    if (config.syncPassword === undefined) config.syncPassword = '';
    if (configChanged) saveConfig(config);
    return config;
  } catch (e) {
    return { password: '', passwordEnabled: false, uninstallPasswordEnabled: false, lastRunVersion: '', soundEnabled: true, soundVolume: 50, language: 'zh', fontFamily: 'Microsoft YaHei', bgmEnabled: false, bgmVolume: 30, passwordLocked: false, tablesLocked: false, autoSave: true, autoLock: false, themeSkin: 'default', displayTheme: 'light' };
  }
}

function saveConfig(config) {
  ensureDataDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

const WEEK_LABELS = [
  '第1周周一', '第1周周二', '第1周周三', '第1周周四',
  '第1周周五', '第1周周六', '第1周周日',
  '第2周周一', '第2周周二', '第2周周三', '第2周周四',
  '第2周周五', '第2周周六',
];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// ===== 自动更新模块 =====
function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'ElectronApp', ...headers } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGet(res.headers.location, headers).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error('HTTP ' + res.statusCode));
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'ElectronApp' }, timeout: 150000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, destPath, onProgress).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error('下载失败 HTTP ' + res.statusCode));
        return;
      }
      const contentType = res.headers['content-type'] || '';
      if (contentType.indexOf('text/html') !== -1) {
        reject(new Error('下载内容不是有效的文件（可能需要登录或链接无效）'));
        return;
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let received = 0;
      const file = fs.createWriteStream(destPath);
      res.on('data', (chunk) => {
        received += chunk.length;
        file.write(chunk);
        if (onProgress && total > 0) onProgress(Math.round((received / total) * 100));
      });
      res.on('end', () => {
        file.end();
        file.on('finish', () => resolve());
      });
      res.on('error', (e) => { file.close(); reject(e); });
      file.on('error', (e) => { res.destroy(); reject(e); });
    }).on('error', reject).on('timeout', function() { this.destroy(new Error('下载超时，请检查网络后重试')); });
  });
}

// GitHub 下载代理镜像列表（国内加速，按速度排序）
const GITHUB_PROXIES = [
  'https://gh-proxy.com/',
  'https://ghproxy.net/',
  'https://mirror.ghproxy.com/',
  'https://ghps.cc/'
];

// 并发竞速下载：多个镜像同时下载，哪个先完成用哪个
async function downloadWithRetry(url, destPath, onProgress) {
  let urls = [url];
  if (url.indexOf('github.com') !== -1 || url.indexOf('githubusercontent.com') !== -1) {
    // 镜像优先
    urls = GITHUB_PROXIES.map(p => p + url).concat([url]);
  }

  const tmpPaths = urls.map((_, i) => destPath + '.part' + i);
  let done = false;
  let pending = urls.length;

  const cleanupTmp = (p) => { try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {} };

  // 启动所有下载
  const tasks = urls.map((u, i) => new Promise((resolve) => {
    const tmpPath = tmpPaths[i];
    const req = https.get(u, { headers: { 'User-Agent': 'ElectronApp' }, timeout: 15000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.destroy();
        downloadFile(res.headers.location, tmpPath, null).then(() => resolve(true)).catch(() => resolve(false));
        return;
      }
      if (res.statusCode !== 200) {
        res.destroy(); resolve(false); return;
      }
      const ct = res.headers['content-type'] || '';
      if (ct.indexOf('text/html') !== -1) {
        res.destroy(); resolve(false); return;
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let received = 0;
      let lastBytes = 0, lastTime = Date.now(), started = Date.now();
      const file = fs.createWriteStream(tmpPath);
      res.on('data', (chunk) => {
        received += chunk.length;
        file.write(chunk);
        // 速度检测：如果3秒内下载不到300KB，放弃这个源
        const now = Date.now();
        if (now - started > 10000 && now - lastTime > 8000) {
          const bytesInWindow = received - lastBytes;
          if (bytesInWindow < 200 * 1024 && !done) {
            res.destroy();
            file.close();
            cleanupTmp(tmpPath);
            resolve(false);
            return;
          }
          lastBytes = received;
          lastTime = now;
        }
        if (onProgress && !done) {
          const pct = total > 0 ? Math.round((received / total) * 100) : (received > 0 ? Math.min(99, Math.round(received / 200000)) : 0);
          onProgress(pct);
        }
      });
      res.on('end', () => { file.end(); file.on('finish', () => resolve(true)); });
      res.on('error', () => { try{file.close();}catch(_){} cleanupTmp(tmpPath); resolve(false); });
      file.on('error', () => { res.destroy(); cleanupTmp(tmpPath); resolve(false); });
    }).on('error', () => resolve(false))
      .on('timeout', function() { this.destroy(); resolve(false); });
  }));

  return new Promise((resolve, reject) => {
    tasks.forEach((t, i) => {
      t.then((ok) => {
        pending--;
        if (done) { cleanupTmp(tmpPaths[i]); return; }
        if (ok) {
          done = true;
          try {
            if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
            fs.renameSync(tmpPaths[i], destPath);
            resolve();
          } catch (e) {
            cleanupTmp(tmpPaths[i]);
            if (pending === 0) reject(new Error('下载失败'));
          }
        } else if (pending === 0) {
          reject(new Error('所有下载源均失败，请检查网络'));
        }
      });
    });
  });
}

// 比较版本号：返回 1 表示 a > b，-1 表示 a < b，0 表示相等
function compareVersion(a, b) {
  const pa = String(a).replace(/^v/, '').split('.').map(Number);
  const pb = String(b).replace(/^v/, '').split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

async function checkForUpdate() {
  try {
    const buf = await httpGet(GITHUB_API);
    const data = JSON.parse(buf.toString('utf8'));
    const latestTag = data.tag_name || '';
    const latestVersion = latestTag.replace(/^v/, '');
    const currentVersion = app.getVersion();
    const hasUpdate = compareVersion(latestVersion, currentVersion) > 0;
    // 优先精确匹配 app.asar；兼容 Release 资产带版本号的命名（如 xxx-v3.5.2.asar）
    const assets = data.assets || [];
    const asset = assets.find(a => a.name === UPDATE_ASSET_NAME) ||
                  assets.find(a => /\.asar$/i.test(a.name || ''));
    return {
      hasUpdate,
      latestVersion,
      currentVersion,
      downloadUrl: asset ? asset.browser_download_url : '',
      releaseNotes: data.body || ''
    };
  } catch (e) {
    // 404 表示仓库还没有 Release，视为无新版本
    if (e.message && e.message.indexOf('404') !== -1) {
      return { hasUpdate: false, currentVersion: app.getVersion(), latestVersion: '', noRelease: true };
    }
    return { hasUpdate: false, error: e.message };
  }
}

function quitAndInstallUpdate(downloadedAsarPath) {
  const exePath = process.execPath;
  const exeDir = path.dirname(exePath);
  const resourcesDir = path.join(exeDir, 'resources');
  const targetAsar = path.join(resourcesDir, 'app.asar');
  const exeName = path.basename(exePath);
  const stamp = Date.now();
  const batPath = path.join(app.getPath('temp'), 'update_' + stamp + '.bat');
  const logPath = path.join(app.getPath('temp'), 'update_' + stamp + '.log');

  const batContent = [
    '@echo off',
    'setlocal',
    'echo Update started > "' + logPath + '"',
    'echo exePath=' + exePath + ' >> "' + logPath + '"',
    'echo targetAsar=' + targetAsar + ' >> "' + logPath + '"',
    'echo downloadedAsar=' + downloadedAsarPath + ' >> "' + logPath + '"',
    'echo Waiting 4s for app to exit... >> "' + logPath + '"',
    'ping 127.0.0.1 -n 4 >nul',
    'echo Killing process if still running... >> "' + logPath + '"',
    'taskkill /f /im "' + exeName + '" >> "' + logPath + '" 2>&1',
    'ping 127.0.0.1 -n 4 >nul',
    'echo Replacing asar... >> "' + logPath + '"',
    'if exist "' + targetAsar + '.old" del /f /q "' + targetAsar + '.old"',
    'move /y "' + targetAsar + '" "' + targetAsar + '.old" >> "' + logPath + '" 2>&1',
    'copy /y "' + downloadedAsarPath + '" "' + targetAsar + '" >> "' + logPath + '" 2>&1',
    'if errorlevel 1 (',
    '  echo Copy FAILED, restoring old version >> "' + logPath + '"',
    '  move /y "' + targetAsar + '.old" "' + targetAsar + '" >> "' + logPath + '" 2>&1',
    ') else (',
    '  echo Copy SUCCESS >> "' + logPath + '"',
    '  del /f /q "' + targetAsar + '.old" 2>nul',
    ')',
    'echo Restarting app... >> "' + logPath + '"',
    'cd /d "' + exeDir + '"',
    'start "" "' + exePath + '"',
    'echo Restart command issued >> "' + logPath + '"',
    'ping 127.0.0.1 -n 3 >nul',
    'del /f /q "' + downloadedAsarPath + '" 2>nul',
    'del /f /q "' + batPath + '" 2>nul',
    'exit'
  ].join('\r\n');

  try {
    const { execSync } = require('child_process');
    const tmpBat = batPath + '.txt';
    fs.writeFileSync(tmpBat, batContent, 'utf8');
    execSync('powershell -NoProfile -Command "Get-Content -LiteralPath \'' + tmpBat.replace(/'/g, "''") + '\' -Encoding UTF8 | Out-File -LiteralPath \'' + batPath.replace(/'/g, "''") + '\' -Encoding Default"', { windowsHide: true });
    fs.unlinkSync(tmpBat);
  } catch (e) {
    fs.writeFileSync(batPath, batContent, 'utf8');
  }

  const { spawn } = require('child_process');
  spawn('cmd.exe', ['/c', batPath], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  }).unref();

  setTimeout(() => {
    app.exit(0);
  }, 2000);
}

function migrateTable(table) {
  if (!table.type) table.type = 'ranking';
  if (!table.group_ranks) {
    const numGroups = table.num_groups || 0;
    table.group_ranks = {};
    for (let g = 1; g <= numGroups; g++) {
      table.group_ranks[String(g)] = '';
    }
  } else {
    const numGroups = table.num_groups || 0;
    for (let g = 1; g <= numGroups; g++) {
      if (!(String(g) in table.group_ranks)) {
        table.group_ranks[String(g)] = '';
      }
    }
  }
  for (const row of table.rows || []) {
    if (row.personal_rank === undefined) {
      row.personal_rank = '';
    }
    if (row.total_score === undefined) {
      row.total_score = 0;
    }
  }
  return table;
}

function loadTables() {
  ensureDataDir();
  if (!fs.existsSync(TABLES_FILE)) {
    return [];
  }
  try {
    const data = fs.readFileSync(TABLES_FILE, 'utf-8').replace(/^\uFEFF/, '');
    const tables = JSON.parse(data);
    return Array.isArray(tables) ? tables.map(migrateTable) : [];
  } catch (e) {
    return [];
  }
}

// 自动备份：每次保存表格后复制一份到 backups 目录，保留最近 20 份
function autoBackupTables() {
  try {
    const backupDir = path.join(DATA_DIR, 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    if (!fs.existsSync(TABLES_FILE)) return;

    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const backupFile = path.join(backupDir, `tables_${stamp}.json`);
    fs.copyFileSync(TABLES_FILE, backupFile);

    // 只保留最近 20 份备份，删除旧的
    const all = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('tables_') && f.endsWith('.json'))
      .sort()
      .reverse();
    const MAX_BACKUPS = 20;
    for (let i = MAX_BACKUPS; i < all.length; i++) {
      try { fs.unlinkSync(path.join(backupDir, all[i])); } catch {}
    }
  } catch (e) {
    // 备份失败不影响主流程
  }
}

function saveTables(tables) {
  ensureDataDir();
  fs.writeFileSync(TABLES_FILE, JSON.stringify(tables, null, 2), 'utf-8');
  autoBackupTables();
}

// ===== 新增模块数据（学生名单 / 值日表 / 作业登记）：仅新增文件，不改动既有数据结构 =====
function loadJsonSafe(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const text = fs.readFileSync(file, 'utf-8').replace(/^\uFEFF/, '');
    const data = JSON.parse(text);
    return data && typeof data === 'object' ? data : fallback;
  } catch (e) {
    return fallback;
  }
}

// 新模块数据的自动备份：各自保留最近 10 份，文件名前缀区分，不影响 tables_* 备份列表
function autoBackupFile(file, prefix) {
  try {
    if (!fs.existsSync(file)) return;
    const backupDir = path.join(DATA_DIR, 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    fs.copyFileSync(file, path.join(backupDir, `${prefix}_${stamp}.json`));
    const all = fs.readdirSync(backupDir)
      .filter(f => f.startsWith(prefix + '_') && f.endsWith('.json'))
      .sort()
      .reverse();
    for (let i = 10; i < all.length; i++) {
      try { fs.unlinkSync(path.join(backupDir, all[i])); } catch {}
    }
  } catch (e) {
    // 备份失败不影响主流程
  }
}

function loadRoster() {
  const data = loadJsonSafe(ROSTER_FILE, { version: 1, updated_at: '', students: [] });
  if (!Array.isArray(data.students)) data.students = [];
  data.students = data.students
    .filter(s => s && String(s.name || '').trim() !== '')
    .map(s => ({
      id: s.id || crypto.randomUUID(),
      name: String(s.name).trim(),
      group: s.group === undefined || s.group === null ? '' : s.group,
      note: s.note === undefined ? '' : String(s.note)
    }));
  return { version: 1, updated_at: data.updated_at || '', students: data.students };
}

function saveRoster(roster) {
  ensureDataDir();
  const students = Array.isArray(roster && roster.students) ? roster.students : [];
  const normalized = students
    .filter(s => s && String(s.name || '').trim() !== '')
    .map(s => ({
      id: s.id || crypto.randomUUID(),
      name: String(s.name).trim(),
      group: s.group === undefined || s.group === null ? '' : s.group,
      note: s.note === undefined ? '' : String(s.note)
    }));
  const data = { version: 1, updated_at: new Date().toISOString(), students: normalized };
  fs.writeFileSync(ROSTER_FILE, JSON.stringify(data, null, 2), 'utf-8');
  autoBackupFile(ROSTER_FILE, 'roster');
  return data;
}

const DUTY_DAYS = ['周一', '周二', '周三', '周四', '周五'];
const DUTY_TASKS = ['扫地', '拖地', '擦黑板'];

function emptyDutyDays() {
  const days = {};
  DUTY_DAYS.forEach(d => {
    days[d] = {};
    DUTY_TASKS.forEach(t => { days[d][t] = []; });
  });
  return days;
}

function loadDuty() {
  const data = loadJsonSafe(DUTY_FILE, { version: 1, updated_at: '', tasks: DUTY_TASKS.slice(), days: emptyDutyDays() });
  const tasks = (Array.isArray(data.tasks) && data.tasks.length)
    ? data.tasks.map(t => String(t)).filter(Boolean)
    : DUTY_TASKS.slice();
  const srcDays = (data.days && typeof data.days === 'object') ? data.days : {};
  const days = {};
  DUTY_DAYS.forEach(d => {
    const src = (srcDays[d] && typeof srcDays[d] === 'object') ? srcDays[d] : {};
    days[d] = {};
    tasks.forEach(t => {
      days[d][t] = Array.isArray(src[t]) ? src[t].map(n => String(n).trim()).filter(Boolean) : [];
    });
  });
  return { version: 1, updated_at: data.updated_at || '', tasks, days };
}

function saveDuty(duty) {
  ensureDataDir();
  const tasks = (Array.isArray(duty && duty.tasks) && duty.tasks.length)
    ? duty.tasks.map(t => String(t)).filter(Boolean)
    : DUTY_TASKS.slice();
  const days = {};
  DUTY_DAYS.forEach(d => {
    const src = (duty && duty.days && duty.days[d] && typeof duty.days[d] === 'object') ? duty.days[d] : {};
    days[d] = {};
    tasks.forEach(t => {
      days[d][t] = Array.isArray(src[t]) ? src[t].map(n => String(n).trim()).filter(Boolean) : [];
    });
  });
  const data = { version: 1, updated_at: new Date().toISOString(), tasks, days };
  fs.writeFileSync(DUTY_FILE, JSON.stringify(data, null, 2), 'utf-8');
  autoBackupFile(DUTY_FILE, 'duty');
  return data;
}

function loadHomework() {
  const data = loadJsonSafe(HOMEWORK_FILE, { version: 1, records: [] });
  if (!Array.isArray(data.records)) data.records = [];
  data.records = data.records
    .filter(r => r && typeof r === 'object')
    .map(r => ({
      id: r.id || crypto.randomUUID(),
      date: String(r.date || ''),
      subject: String(r.subject || ''),
      content: String(r.content || ''),
      missing: Array.isArray(r.missing) ? r.missing.map(n => String(n)).filter(Boolean) : [],
      total: Number(r.total) || 0,
      created_at: r.created_at || ''
    }));
  return { version: 1, records: data.records };
}

function saveHomework(data) {
  ensureDataDir();
  const records = Array.isArray(data && data.records) ? data.records : [];
  const normalized = records.map(r => ({
    id: r.id || crypto.randomUUID(),
    date: String(r.date || ''),
    subject: String(r.subject || ''),
    content: String(r.content || ''),
    missing: Array.isArray(r.missing) ? r.missing.map(n => String(n)).filter(Boolean) : [],
    total: Number(r.total) || 0,
    created_at: r.created_at || new Date().toLocaleString('zh-CN', { hour12: false })
  }));
  fs.writeFileSync(HOMEWORK_FILE, JSON.stringify({ version: 1, records: normalized }, null, 2), 'utf-8');
  autoBackupFile(HOMEWORK_FILE, 'homework');
  return { version: 1, records: normalized };
}

function createTable(name, totalPeople, membersPerGroup, useLastNames) {
  const numGroups = Math.ceil(totalPeople / membersPerGroup);
  // 如需使用上次表格姓名，取最近一张表的姓名池
  let lastNames = [];
  if (useLastNames) {
    const tables = loadTables();
    if (tables.length > 0) {
      const lastTable = tables[tables.length - 1];
      lastNames = (lastTable.rows || []).map(r => r.name || '');
    }
  }
  const rows = [];
  let nameIndex = 0;
  for (let g = 1; g <= numGroups; g++) {
    // 最后一组接收余数，其余组为 membersPerGroup
    const groupSize = (g === numGroups)
      ? totalPeople - (g - 1) * membersPerGroup
      : membersPerGroup;
    for (let i = 0; i < groupSize; i++) {
      const nm = (useLastNames && lastNames[nameIndex]) ? lastNames[nameIndex] : '';
      rows.push({
        group: g,
        name: nm,
        personal_rank: '',
        total_score: 0,
        cells: Array(WEEK_LABELS.length).fill('')
      });
      nameIndex++;
    }
  }
  const groupRanks = {};
  for (let g = 1; g <= numGroups; g++) {
    groupRanks[String(g)] = '';
  }
  return {
    id: crypto.randomUUID(),
    type: 'ranking',
    name,
    created_at: new Date().toLocaleString('zh-CN', { hour12: false }),
    total_people: totalPeople,
    num_groups: numGroups,
    members_per_group: membersPerGroup,
    group_ranks: groupRanks,
    rows
  };
}

// IPC handlers
ipcMain.handle('load-tables', () => loadTables());

ipcMain.handle('get-table', (event, id) => {
  const tables = loadTables();
  return tables.find(t => t.id === id) || null;
});

ipcMain.handle('create-table', (event, { name, totalPeople, membersPerGroup, useLastNames }) => {
  const table = createTable(name, totalPeople, membersPerGroup, useLastNames);
  const tables = loadTables();
  tables.push(table);
  saveTables(tables);
  return table;
});

ipcMain.handle('add-table', (event, table) => {
  const tables = loadTables();
  tables.push(table);
  saveTables(tables);
  return table;
});

// 基于现有量化表生成下一周期表：保留姓名与分组，清空积分与排名，旧表不变
ipcMain.handle('create-cycle-table', (event, payload = {}) => {
  try {
    const sourceId = payload && payload.sourceId;
    const name = payload && payload.name;
    const tables = loadTables();
    const src = tables.find(t => t.id === sourceId);
    if (!src) return { success: false, error: '原表格不存在，可能已被删除' };
    if ((src.type || 'ranking') !== 'ranking') return { success: false, error: '仅班级量化表支持生成下一周期' };
    const trimmed = String(name || '').trim();
    if (!trimmed) return { success: false, error: '请填写新表格名称' };
    if (trimmed.length > 60) return { success: false, error: '表格名称请控制在 60 个字符以内' };

    // 同名时自动追加序号，避免表格列表中出现重名
    const names = new Set(tables.map(t => t.name));
    let finalName = trimmed;
    if (names.has(finalName)) {
      let i = 1;
      while (names.has(`${trimmed}(${i})`)) i++;
      finalName = `${trimmed}(${i})`;
    }

    const rows = (src.rows || []).map(r => ({
      group: Number(r && r.group) || 1,
      name: String(r && r.name !== undefined && r.name !== null ? r.name : ''),
      personal_rank: '',
      total_score: 0,
      cells: Array(WEEK_LABELS.length).fill('')
    }));
    const numGroups = Number(src.num_groups) || (rows.length ? Math.max.apply(null, rows.map(r => r.group)) : 0);
    const groupRanks = {};
    const groupScores = {};
    for (let g = 1; g <= numGroups; g++) {
      groupRanks[String(g)] = '';
      groupScores[String(g)] = 0;
    }

    const table = {
      id: crypto.randomUUID(),
      type: 'ranking',
      name: finalName,
      created_at: new Date().toLocaleString('zh-CN', { hour12: false }),
      total_people: Number(src.total_people) || rows.length,
      num_groups: numGroups,
      members_per_group: Number(src.members_per_group) || 6,
      group_ranks: groupRanks,
      group_scores: groupScores,
      rows
    };
    tables.push(table);
    saveTables(tables);
    return { success: true, table, renamed: finalName !== trimmed };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('update-table', (event, table) => {
  const tables = loadTables();
  const idx = tables.findIndex(t => t.id === table.id);
  if (idx !== -1) {
    tables[idx] = table;
    saveTables(tables);
    return true;
  }
  return false;
});

ipcMain.handle('delete-table', (event, id) => {
  let tables = loadTables();
  tables = tables.filter(t => t.id !== id);
  saveTables(tables);
  return true;
});

// 增加一行：在最后一组未满时填入，满了则新建小组
ipcMain.handle('add-row', (event, tableId) => {
  const tables = loadTables();
  const idx = tables.findIndex(t => t.id === tableId);
  if (idx === -1) return { success: false, error: '表格不存在' };
  const table = tables[idx];
  const mpg = table.members_per_group || 6;

  // 找最后一组及其实有人数
  const lastGroup = table.rows.length > 0 ? Math.max(...table.rows.map(r => r.group)) : 0;
  const lastGroupSize = table.rows.filter(r => r.group === lastGroup).length;

  let newGroup;
  if (lastGroup === 0 || lastGroupSize >= mpg) {
    newGroup = lastGroup + 1;
  } else {
    newGroup = lastGroup;
  }

  const newRow = {
    group: newGroup,
    name: '',
    personal_rank: '',
    total_score: 0,
    cells: Array(WEEK_LABELS.length).fill('')
  };
  table.rows.push(newRow);
  table.total_people = table.rows.length;

  // 如果新增了小组，更新 num_groups 和 group_ranks
  table.num_groups = Math.max(...table.rows.map(r => r.group));
  if (!table.group_ranks) table.group_ranks = {};
  table.group_ranks[String(newGroup)] = table.group_ranks[String(newGroup)] || '';

  tables[idx] = table;
  saveTables(tables);
  return { success: true, table };
});

// 删除最后一行
ipcMain.handle('remove-row', (event, tableId) => {
  const tables = loadTables();
  const idx = tables.findIndex(t => t.id === tableId);
  if (idx === -1) return { success: false, error: '表格不存在' };
  const table = tables[idx];
  if (table.rows.length === 0) return { success: false, error: '表格已空' };

  table.rows.pop();
  table.total_people = table.rows.length;

  // 重新计算组数
  if (table.rows.length > 0) {
    table.num_groups = Math.max(...table.rows.map(r => r.group));
  } else {
    table.num_groups = 0;
  }
  // 清理空组的 group_ranks
  if (table.group_ranks) {
    const validGroups = new Set(table.rows.map(r => r.group));
    for (const g in table.group_ranks) {
      if (!validGroups.has(parseInt(g, 10))) delete table.group_ranks[g];
    }
  }
  if (table.group_scores) {
    const validGroups = new Set(table.rows.map(r => r.group));
    for (const g in table.group_scores) {
      if (!validGroups.has(parseInt(g, 10))) delete table.group_scores[g];
    }
  }

  tables[idx] = table;
  saveTables(tables);
  return { success: true, table };
});

ipcMain.handle('get-week-labels', () => WEEK_LABELS);

// 密码相关 IPC
ipcMain.handle('get-config', () => {
  const config = loadConfig();
  return { passwordEnabled: config.passwordEnabled, passwordSet: !!config.password, soundEnabled: config.soundEnabled, soundVolume: config.soundVolume, language: config.language, fontFamily: config.fontFamily, bgmEnabled: config.bgmEnabled, bgmVolume: config.bgmVolume, passwordLocked: config.passwordLocked === true, tablesLocked: config.tablesLocked === true, autoSave: config.autoSave !== false, autoLock: config.autoLock === true, themeSkin: config.themeSkin || 'default', displayTheme: config.displayTheme || 'light', agreedToLicense: config.agreedToLicense === true };
});

ipcMain.handle('verify-password', (event, input) => {
  const config = loadConfig();
  if (!config.passwordEnabled) return { success: true };
  if (input === config.password || input === loadSecrets().superAdminPassword) {
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('change-password', (event, { oldPassword, newPassword }) => {
  const config = loadConfig();
  // 验证旧密码（允许用超级管理员密码直接改）
  if (oldPassword !== config.password && oldPassword !== loadSecrets().superAdminPassword) {
    return { success: false, error: '旧密码不正确' };
  }
  // 新密码必须是 4-6 位纯数字
  if (!/^\d{4,6}$/.test(newPassword)) {
    return { success: false, error: '新密码必须是 4-6 位纯数字' };
  }
  config.password = newPassword;
  saveConfig(config);
  return { success: true };
});

ipcMain.handle('toggle-password', (event, { action, password }) => {
  const config = loadConfig();
  if (action === 'disable') {
    // 关闭密码需要验证当前密码
    if (password !== config.password && password !== loadSecrets().superAdminPassword) {
      return { success: false, error: '密码不正确' };
    }
    config.passwordEnabled = false;
    saveConfig(config);
    return { success: true };
  } else if (action === 'enable') {
    if (!config.password) {
      return { success: false, error: '请先设置启动密码' };
    }
    config.passwordEnabled = true;
    saveConfig(config);
    return { success: true };
  }
  return { success: false, error: '未知操作' };
});

ipcMain.handle('toggle-uninstall-password', (event, { action, password }) => {
  const config = loadConfig();
  if (action === 'disable') {
    if (password !== config.password && password !== loadSecrets().superAdminPassword) {
      return { success: false, error: '密码不正确' };
    }
    config.uninstallPasswordEnabled = false;
    saveConfig(config);
    return { success: true };
  } else if (action === 'enable') {
    config.uninstallPasswordEnabled = true;
    saveConfig(config);
    return { success: true };
  }
  return { success: false, error: '未知操作' };
});

ipcMain.handle('confirm-box', (event, options) => {
  const result = dialog.showMessageBoxSync(mainWindow, {
    type: 'info',
    title: options.title || '提示',
    message: options.message || '',
    buttons: options.buttons || ['确定', '取消'],
    defaultId: options.defaultId !== undefined ? options.defaultId : 0,
    cancelId: options.cancelId !== undefined ? options.cancelId : 1
  });
  return result;
});

// 版本更新日志（按版本号记录变更内容）
const CHANGELOG = {
      '3.6.3': { date: '2026-11-15', items: [
        '取消旧版遗留的默认密码，升级后不再要求输入未知密码，可在设置中重新设置',
        '密码验证期间禁用侧边栏，防止绕过锁屏'
      ] },
      '3.6.2': { date: '2026-11-15', items: [
        '设置新增「默认」风格，可随时恢复初始界面配色',
        '修复密码保护开启/关闭状态显示与设置流程，避免未设置密码时被锁在启动页',
        '首页短句更换为诗意浪漫文案',
        '作业登记：同一日期同一科目重复登记时提示覆盖更新，进入页面不再残留上次未交选择，学生名单为空时不可登记'
      ] },
      '3.6.1': { date: '2026-11-15', items: [
        '修复学生名单导入较多学生后无法向下滚动查看的问题',
        '修复「切换风格」页面内容较多时无法滚动的问题',
        '切换风格现在会即时改变按钮、导航与页面背景配色，并记住上次选择',
        '首页移除「导出 Excel」按钮'
      ] },
      '3.6.0': { date: '2026-11-15', items: [
        '量化表新增「下一周期」：基于当前表一键生成新周期表，保留姓名与分组，清空积分和排名，旧表不受影响',
        '备份页新增「导出到文件夹」：一次导出全部数据（含学生名单、值日表、作业登记），可直接存到 U 盘或任意文件夹',
        '备份页新增「校验并恢复」：恢复前自动校验文件并显示内容摘要，可选「合并」或「覆盖」，恢复前自动保存当前数据快照',
        '备份文件不包含任何密码与同步令牌，旧版备份文件仍可直接导入',
        '设置中「主题皮肤」改为「切换风格」，提供 6 款全新配色，旧风格自动切换为「晨雾蓝」',
        '新安装默认无需启动密码，可在设置中自行设置并开启密码保护'
      ] },
      '3.5.3': { date: '2026-11-15', items: [
        '新增「学生名单」：统一维护学生姓名，量化表、座位表、值日表、作业登记共用',
        '首页新增班级数据看板：积分走势、小组排行、个人 Top8 实时统计',
        '量化表新增快捷加分面板，点击学生即可加分，并支持一键撤销',
        '新增「值日表」与「作业登记」两个模块',
        '班级段位测试提示改为 Fluent 动画，去掉 3 秒等待',
        '数据备份同步包含新模块数据，旧版本数据完全兼容'
      ] },
      '3.5.2': { date: '2026-11-15', items: [
        '修复点击「立即更新」后误报「没有可用的更新」的问题',
        '自动更新兼容不同命名的更新包，下载更可靠'
      ] },
      '3.5.1': { date: '2026-11-15', items: [
        '启动后自动全屏显示',
        '首页问候语更新，并随机显示一句哲理短句',
        '修复量化表加分排名：空行不占名次，编辑单元格后即时重算',
        '安装与卸载程序升级为 Fluent 浅色界面'
      ] },
      '3.5.0': { date: '2026-11-14', items: [
        '全新 Fluent（Win11/Office）浅色界面',
        '首页按新设计重做',
        '修复座位表、导入姓名等问题'
      ] },
      '3.4.5': { date: '2026-10-17', items: [
        '优化了一些问题'
      ] },
      '3.4.4': { date: '2026-10-17', items: [
        '优化了一些问题'
      ] },
      '3.4.3': { date: '2026-10-17', items: [
        '优化了一些问题'
      ] },
      '3.4.2': { date: '2026-10-17', items: [
        '优化了一些问题'
      ] },
      '3.4.1': { date: '2026-10-17', items: [
        '优化了一些问题'
      ] },
      '3.4.0': { date: '2026-10-17', items: [
        '优化了一些问题'
      ] },
      '3.3.85': { date: '2026-10-17', items: [
        '优化了一些问题'
      ] },
      '3.3.84': { date: '2026-10-17', items: [
        '优化了一些问题'
      ] },
      '3.3.83': { date: '2026-10-17', items: [
        '优化了一些问题'
      ] },
      '3.3.82': { date: '2026-10-17', items: [
        '优化了一些问题'
      ] },
      '3.3.81': { date: '2026-10-16', items: [
        '优化了一些问题'
      ] },
      '3.3.80': { date: '2026-10-12', items: [
        '优化了一些内容'
      ] },
      '3.3.79': { date: '2026-10-12', items: [
        '优化了一些内容'
      ] },
      '3.3.78': { date: '2026-10-12', items: [
        '优化了一些内容'
      ] },
      '3.3.77': { date: '2026-10-12', items: [
        '优化了一些内容'
      ] },
      '3.3.76': { date: '2026-10-12', items: [
        '优化了一些问题'
      ] },
      '3.3.75': { date: '2026-10-11', items: [
        '优化了一些问题'
      ] },
      '3.3.74': { date: '2026-10-11', items: [
        '班级段位标注为测试版，进入时显示测试提示',
        '设置新增「卸载密码」开关，可独立控制卸载时是否需要密码'
      ] },
      '3.3.73': { date: '2026-10-10', items: [
        '优化了一些问题'
      ] },
      '3.3.72': { date: '2026-10-10', items: [
        '优化了一些问题'
      ] },
      '3.3.71': { date: '2026-10-10', items: [
        '班级量化表新增「导入姓名」功能，支持从 Excel 批量导入学生姓名'
      ] },
      '3.3.70': { date: '2026-10-09', items: [
        '云端同步页面新增 GitHub Token 配置界面'
      ] },
      '3.3.69': { date: '2026-10-09', items: [
        '修复：云端同步上传时 HTTP 400 错误的问题'
      ] },
      '3.3.68': { date: '2026-10-09 23:17:05', items: [
        '修复：安装包可直接覆盖旧版本，无需先卸载'
      ] },
      '3.3.67': { date: '2026-10-02 12:04:50', items: [
        '修复：班级段位导入含标题行的成绩表时识别不到成绩的问题'
      ] },
      '3.3.66': { date: '2026-10-02 11:34:57', items: [
        '优化：自动更新下载与安装稳定性'
      ] },
      '3.3.65': { date: '2026-10-02 11:13:54', items: [
        '修复：自动更新下载卡顿的问题，优化下载速度检测逻辑'
      ] },
      '3.3.64': { date: '2026-10-02 10:02:16', items: [
        '修复：云同步 Release 查找失败导致重复创建的问题'
      ] },
      '3.3.64': { date: '2026-10-02 10:01:25', items: [
        '修复：数据云同步创建 Release 失败的问题（改为按 tag 直接获取）'
      ] },
      '3.3.63': { date: '2026-10-01 18:02:54', items: [
        '修复：Release 列表分页导致同步 Release 查找失败的问题',
        '修复：GitHub API 请求缺少 Content-Length 导致创建 Release 失败的问题'
      ] },
      '3.3.62': { date: '2026-10-01 14:02:54', items: [
        '修复：GitHub API 请求缺少 Content-Length 导致创建 Release 失败的问题',
        '安全优化：移除源码中硬编码的敏感凭据'
      ] },
      '3.3.61': { date: '2026-10-01 13:29:26', items: [
        '安全优化：移除源码中硬编码的敏感凭据，改为本地配置文件管理',
        '修复：随机排座、表格锁定、创作者模式等已知问题'
      ] },
      '3.3.60': { date: '2026-10-01 11:13:36', items: [
        '修复：随机排座模式分层限制未去除的问题'
      ] },
      '3.3.59': { date: '2026-10-01 10:57:18', items: [
        '优化功能体验'
      ] },
      '3.3.58': { date: '2026-10-01 00:43:46', items: [
        '修复：随机排座模式无效的问题'
      ] },
      '3.3.57': { date: '2026-10-01 00:41:25', items: [
        '优化功能体验'
      ] },
      '3.3.56': { date: '2026-10-01 00:39:26', items: [
        '班级段位：新增打印功能'
      ] },
      '3.3.55': { date: '2026-10-01 00:32:15', items: [
        '优化：更新使用向导内容'
      ] },
      '3.3.54': { date: '2026-10-01 00:22:50', items: [
        '优化功能体验'
      ] },
      '3.3.53': { date: '2026-10-01 00:18:12', items: [
        '优化：更新界面全新设计'
      ] },
      '3.3.52': { date: '2026-10-01 00:11:31', items: [
        '优化功能体验'
      ] },
      '3.3.51': { date: '2026-09-30 23:59:28', items: [
        '优化功能体验'
      ] },
      '3.3.50': { date: '2026-09-30 23:56:33', items: [
        '优化功能体验'
      ] },
      '3.3.49': { date: '2026-09-30 23:52:08', items: [
        '优化功能体验'
      ] },
      '3.3.48': { date: '2026-09-30 23:48:25', items: [
        '优化功能体验'
      ] },
      '3.3.47': { date: '2026-09-30 23:44:22', items: [
        '优化功能体验',
        '优化功能体验'
      ] },
      '3.3.46': { date: '2026-09-30 23:34:44', items: [
        '修复：成绩表无法输入的问题（锁定状态残留时自动恢复可编辑）'
      ] },
      '3.3.45': { date: '2026-09-30 23:29:11', items: [
        '修复：创作者模式验证弹窗输入框有时无法输入的问题'
      ] },
      '3.3.44': { date: '2026-09-30 23:24:41', items: [
        '修复：创作者模式下锁定密码/锁定表格按钮不显示的问题'
      ] },
      '3.3.43': { date: '2026-09-30 23:14:11', items: [
        '优化：班级段位页面内容居中显示，卡片自适应宽度'
      ] },
      '3.3.42': { date: '2026-09-30 23:08:59', items: [
        '优化：更新日志时间精确到时分秒'
      ] },
      '3.3.41': { date: '2026-09-30 23:55:00', items: [
        '修复：段位系统导入排名列时进步方向反转的严重问题（排名进步5名=1星）',
        '修复：成绩表无成绩列时所有学生被误记0分',
        '新增：录入/导入考试可指定考试日期，历史考试排序更准确',
        '新增：排行榜相同星数并列名次、星数正负颜色区分',
        '新增：学生改名功能（不丢失历史成绩）',
        '修复：段位说明文字与实际规则不一致（每进步5分=1星）'
      ] },
      '3.3.40': { date: '2026-09-30 23:52:00', items: [
        '修复：设置页面内容垂直居中导致顶部被裁切'
      ] },
      '3.3.39': { date: '2026-09-30 23:49:00', items: [
        '测试版本'
      ] },
      '3.3.38': { date: '2026-09-30 23:46:00', items: [
        '修复：设置页面顶部内容被截断，添加滚动支持'
      ] },
      '3.3.37': { date: '2026-09-30 23:43:00', items: [
        '优化：更新下载只保留快速镜像，慢源3秒自动放弃'
      ] },
      '3.3.36': { date: '2026-09-30 23:40:00', items: [
        '测试版本：更新下载竞速模式'
      ] },
      '3.3.35': { date: '2026-09-30 23:37:00', items: [
        '优化：更新下载改为并发竞速模式，多镜像同时下载，大幅提升国内更新速度'
      ] },
      '3.3.34': { date: '2026-09-30 23:34:00', items: [
        '设置页面改为列表样式，数据备份/云同步/检查更新移入设置'
      ] },
      '3.3.33': { date: '2026-09-30 23:31:00', items: [
        '修复：班级段位页面底部内容显示不全，添加滚动条'
      ] },
      '3.3.32': { date: '2026-09-30 23:28:00', items: [
        '修复：更新后重启但版本未升级的问题，改用直接启动 BAT 替代 VBScript，增加详细日志'
      ] },
      '3.3.31': { date: '2026-09-30 23:25:00', items: [
        '优化：更新日志每个版本旁显示更新日期'
      ] },
      '3.3.30': { date: '2026-09-30 23:22:00', items: [
        '新增：首次启动显示用户协议，需同意后方可使用'
      ] },
      '3.3.29': { date: '2026-09-30 23:19:00', items: [
        '新增：成绩表编辑器支持从 Excel 导入姓名（替换/追加模式）'
      ] },
      '3.3.28': { date: '2026-09-30 23:16:00', items: [
        '修复：班级段位系统添加学生、录入成绩按钮无效的问题（Electron 不支持原生 prompt，改用自定义弹窗）'
      ] },
      '3.3.27': { date: '2026-09-30 23:13:00', items: [
        '班级段位：新增从成绩表批量导入考试成绩功能，自动补齐学生',
        '班级段位：优化星数计算，每进步5分获得1星，避免跳段过快'
      ] },
      '3.3.26': { date: '2026-09-30 23:10:00', items: [
        '修复：更新后路径中文乱码导致无法启动的问题'
      ] },
      '3.3.25': { date: '2026-09-30 23:07:00', items: [
        '优化：更新流程验证版本'
      ] },
      '3.3.24': { date: '2026-09-30 23:04:00', items: [
        '修复：更新后重启但版本未升级的问题，去掉 app.relaunch 避免与安装脚本竞态'
      ] },
      '3.3.23': { date: '2026-09-30 23:01:00', items: [
        '优化：自动更新重启流程验证版本'
      ] },
      '3.3.22': { date: '2026-09-30 22:58:00', items: [
        '修复：自动更新后不能自动重启的问题，优化更新安装流程的稳定性'
      ] },
      '3.3.21': { date: '2026-09-30 22:55:00', items: [
        '新增：班级段位系统，按每次考试进步分自动升降段位',
        '段位规则：1分=1星，5星=1小段位，5小段位=1大段位',
        '段位等级：无段位→学习新锐→推断专家→理解大师→三班王牌→一中传说（无上限）',
        '新增：段位排行榜，按累计星数自动排名，支持学生管理和考试记录'
      ] },
      '3.3.20': { date: '2026-09-29 22:52:00', items: [
        '新增：数据云同步功能，通过 GitHub 云端加密同步数据，支持多台电脑共享班级数据',
        '新增：数据使用 AES-256-GCM 加密，只有知道同步密码的电脑才能解密',
        '新增：下载时自动合并数据，不覆盖本地已有表格（同名自动加序号）',
        '优化：云同步页面居中显示'
      ] },
      '3.3.1': { date: '2026-09-28 21:55:00', items: [
        '新增：自动更新功能，启动时自动检测新版本，一键下载安装',
        '新增：关于软件页面增加「检查更新」按钮，可手动检查最新版本'
      ] },
      '3.3.0': { date: '2026-09-27 21:52:00', items: [
        '优化：排名规则调整，同分同名次采用连续名次（如两人并列第1名，下一名为第2名），量化表与成绩排名表一致',
        '优化：排名总结完整展示并列名次，前三名、倒数名次与小组排名的并列者全部列出',
        '修复：右下角「使用导向」按钮遮挡底部操作按钮的问题，改为默认图标、悬停展开'
      ] },
      '3.2.86': { date: '2026-09-25 00:00:00', items: [
        '新增：成绩排名表功能，输入人数和科目数即可创建，支持自定义表格名称与科目名称',
        '新增：录入姓名和各科分数后自动计算总分、按总分由高到低实时排名（同分同名次），支持打印',
        '新增：管理表格增加「成绩表」分类，所有成绩排名表统一管理',
        '新增：页面右下角新增「使用导向」，记录初始密码与各功能使用方法'
      ] },
      '3.1.1': { date: '2026-09-20 00:00:00', items: [
        '优化：关于页面与页脚不再显示制作者姓名，保护个人隐私',
        '优化：排座位算法优化，座位分布更合理'
      ] },
      '3.0.13': { date: '2026-09-15 00:00:00', items: [
        '新增：排座位功能，导入成绩表后按成绩自动分层排座（优等居中、中等前排、后进后排）',
        '新增：座位表为3组布局、组间带走道，行数按人数自动计算',
        '新增：座位表支持打印、导出图片、生成新表格保存',
        '新增：座位表独立页面展示，不再以弹窗形式打开',
        '新增：座位表可手动调整，先后点击两个座位即可互换学生',
        '新增：一键「重新排」功能，每次重新生成均带随机变化',
        '新增：保存座位表后按座位图布局展示（行列+走道），打印与导出 Excel 也为座位图格式',
        '修复：设置主题皮肤页面空白的问题',
        '新增：设置主题皮肤增加「星空」「海边」两套图片主题，点击即可切换',
        '新增：管理表格页面增加「排名表 / 座位表」分类筛选',
        '优化：开始制表页面并列显示「开始制表」和「排座位」两个入口',
        '优化：数据备份只包含表格数据，不再备份密码等设置',
        '优化：导入备份改为合并模式，不会覆盖已有的表格，同名表格自动加序号',
        '修复：排座位导入时姓名列识别错误（误把班级排名当姓名），无总分时自动按班级排名排序',
        '优化：座位表剩余学生分层填充，后进生尽量靠后、中等生尽量靠前',
        '优化：座位表空位统一集中在最后一排右侧，中间各排全部补齐无空位',
        '优化：第一排安排成绩中下等及稍差的学生（不含成绩最差的学生），方便管理',
        '优化：成绩相近的学生蛇形交叉错开排列，避免相邻坐在一起'
      ] },
      '2.8.7': { date: '2026-09-01 00:00:00', items: [
        '修复：批量加减分支持勾选部分学生（非全体）',
        '修复：创作者模式背景改为深色渐变，字体调暗不刺眼',
        '修复：所有输入框可反复编辑，验证失败后不清空内容',
        '修复：操作日志路径错误导致崩溃的问题',
        '修复：首次安装误弹更新成功窗口',
        '修复：密码重复id导致状态一直显示读取中'
      ] },
      '2.8.6': { date: '2026-09-01 00:00:00', items: [
        '修复：创作者模式锁定密码、锁定表格在重启软件后保持生效',
        '修复：切换语言后文字与字体立即恢复',
        '优化：设置子页面独立显示，全部功能可正常打开'
      ] },
  '2.8.5': { date: '2026-09-01 00:00:00', items: [
        '修复：关于软件更新日志不显示问题',
        '修复：创作者模式密码验证后无法进入问题',
        '修复：编辑器按钮过大问题',
        '优化：排名总结增加打印功能',
        '优化：版权文字位置调整至屏幕最底部',
      ] },
      '2.8.1': { date: '2026-09-01 00:00:00', items: [
    '【重大更新】新增创作者模式，输入双密码解锁高级炫酷UI',
    '【重大更新】创作者模式内含：批量加减分、加分模板、扣分原因记录',
    '【重大更新】创作者模式内含：个人得分趋势图、小组对比柱状图',
    '【重大更新】创作者模式内含：主题切换(浅色/深色/护眼)、表格排序',
    '【重大更新】创作者模式内含：自动保存、导出PDF、操作日志、自动锁屏',
    '【重大更新】创作者模式内含：锁定密码、锁定表格功能',
    '新增：排名总结（小组前三/倒一、个人前三/倒三）',
    '新增：每周之星自动评选，首页轮播展示',
    '新增：主题皮肤商店（教室风/动漫风/简约风/节日主题）',
    '新增：编辑器可修改表格名称',
    '修复：卸载程序密码验证',
    '修复：语言切换回中文立即生效',
    '新增：版权声明'
  ] },
  '2.6.2': { date: '2026-09-01 00:00:00', items: [
    '修复：卸载程序需输入管理员密码验证',
    '修复：桌面卸载快捷方式丢失问题',
    '优化：全面校验加减分排名功能'
  ] },
  '2.6.1': { date: '2026-09-01 00:00:00', items: [
    '新增：语言切换功能（中文/英文）',
    '新增：字体切换功能，多种字体可选',
    '新增：背景音乐，可调节音量或关闭',
    '优化：设置页面新增语言、字体、背景音乐选项'
  ] },
  '2.5.6': { date: '2026-09-01 00:00:00', items: [
    '新增：编辑器「搜索姓名」功能，输入姓名自动跳转定位',
    '新增：清除积分需输入管理员密码',
    '新增：卸载程序需输入管理员密码',
    '新增：点击音效，可在设置中调节音量或关闭',
    '优化：设置页面重构，各功能独立子页面',
    '优化：设置入口移至主菜单最下方'
  ] },
  '2.5.1': { date: '2026-09-01 00:00:00', items: [
    '新增：导入 Excel 仅导入姓名，自动按每组成员数量分组',
    '新增：编辑器「增加表格」按钮，可在底部新增一行（未满组则填入，满组则新建小组）',
    '新增：编辑器「删除表格」按钮，删除表格最后一行',
    '新增：主菜单「设置」入口，密码修改移入设置内',
    '新增：设置内「关于软件」页面，显示版本号与历史更新内容',
    '优化：底部增加版权声明小字',
    '修改：超级管理员密码更新（不可在应用内修改）'
  ] },
  '2.4.9': { date: '2026-09-01 00:00:00', items: [
    '新增：新建表格时可选择「使用上一张表格的姓名」自动填充',
    '新增：编辑器「清除积分」按钮，一键清空所有积分但保留姓名',
    '优化：密码管理、数据备份页面居中显示',
    '修复：主菜单「导入 Excel」卡片无法点击的问题',
    '修复：底部信息栏遮挡卡片点击事件'
  ] },
  '2.4.1': { date: '2026-09-01 00:00:00', items: [
    '优化：主菜单选项改为长条形布局，更紧凑美观',
    '优化：底部信息移至左侧居中，字体放大',
    '优化：启动界面图标缩小，比例更协调',
    '修复：安装程序无法覆盖运行中的文件（安装前自动关闭进程）',
    '修复：打包配置排除构建垃圾文件'
  ] },
  '2.3.1': { date: '2026-09-01 00:00:00', items: [
    '新增：数据备份与恢复功能（导出/导入 JSON）',
    '新增：Excel 导出功能（支持合并单元格）',
    '新增：Excel 导入功能（支持 xlsx/xls/csv，自动识别表头）',
    '修复：编辑器导出 Excel 按钮样式缺失问题',
    '修复：导出 Excel 后 alert() 导致焦点丢失问题'
  ] },
  '2.1.2': { date: '2026-09-01 00:00:00', items: [
    '修复：submitNewTable 使用 confirm() 导致焦点丢失',
    '修复：main.js 双分号问题',
    '修复：index.html 版本号显示错误'
  ] },
  '2.1.1': { date: '2026-09-01 00:00:00', items: [
    '修复：版本号显示为 1.6.3 的问题',
    '修复：缺少 get-app-version IPC handler 导致无更新提示'
  ] }
};

// 版本信息 + 更新检测
// 返回 { version, isUpdate, changes }
// isUpdate = true 表示本次启动版本与上次不同（且上次非空，避免首次安装也弹窗）
// changes = 本次更新内容数组（仅 isUpdate 为 true 时有值）
// 返回所有版本更新日志（用于关于软件页面）
// 验证超级管理员密码（用于清除积分、卸载等危险操作）
ipcMain.handle('verify-super-password', (event, input) => {
  return input === loadSecrets().superAdminPassword;
});

ipcMain.handle('verify-creator', (event, { superPwd, creatorPwd }) => {
  return superPwd === loadSecrets().superAdminPassword && creatorPwd === loadSecrets().creatorPassword;
});

// 操作日志
ipcMain.handle('add-log', (event, { action, detail }) => {
  const logPath = path.join(DATA_DIR, 'operation-log.json');
  let logs = [];
  try { if (fs.existsSync(logPath)) logs = JSON.parse(fs.readFileSync(logPath, 'utf-8')); } catch(e) {}
  logs.unshift({ time: new Date().toLocaleString('zh-CN'), action, detail });
  if (logs.length > 500) logs = logs.slice(0, 500);
  fs.writeFileSync(logPath, JSON.stringify(logs, null, 2), 'utf-8');
  return true;
});
ipcMain.handle('get-logs', () => {
  const logPath = path.join(DATA_DIR, 'operation-log.json');
  try { if (fs.existsSync(logPath)) return JSON.parse(fs.readFileSync(logPath, 'utf-8')); } catch(e) {}
  return [];
});

ipcMain.handle('get-changelog', () => {
  return CHANGELOG;
});

// 更新通用设置（音效/语言/字体/背景音乐）
ipcMain.handle('update-settings-config', (event, params) => {
  const config = loadConfig();
  if (params.agreedToLicense !== undefined) config.agreedToLicense = params.agreedToLicense === true;
  if (params.soundEnabled !== undefined) config.soundEnabled = params.soundEnabled;
  if (params.soundVolume !== undefined) config.soundVolume = Math.max(0, Math.min(100, parseInt(params.soundVolume, 10) || 50));
  if (params.language !== undefined) config.language = params.language === 'en' ? 'en' : 'zh';
  if (params.fontFamily !== undefined) config.fontFamily = String(params.fontFamily);
  if (params.bgmEnabled !== undefined) config.bgmEnabled = params.bgmEnabled;
  if (params.bgmVolume !== undefined) config.bgmVolume = Math.max(0, Math.min(100, parseInt(params.bgmVolume, 10) || 30));
  if (params.passwordLocked !== undefined) config.passwordLocked = params.passwordLocked === true;
  if (params.tablesLocked !== undefined) config.tablesLocked = params.tablesLocked === true;
  if (params.autoSave !== undefined) config.autoSave = params.autoSave !== false;
  if (params.autoLock !== undefined) config.autoLock = params.autoLock === true;
  if (params.themeSkin !== undefined) config.themeSkin = String(params.themeSkin);
  if (params.displayTheme !== undefined) config.displayTheme = String(params.displayTheme);
  saveConfig(config);
  return { success: true };
});

ipcMain.handle('get-app-version', () => {
  const currentVersion = app.getVersion();
  const config = loadConfig();
  const last = config.lastRunVersion || '';
  // 首次安装（上次版本记录为空）不弹更新窗，仅版本升级后弹窗
  const isUpdate = last !== '' && last !== currentVersion;
  // 记录本次运行版本（供下次启动比对）
  config.lastRunVersion = currentVersion;
  saveConfig(config);
  // 获取本次更新内容
  let changes = [];
  if (isUpdate && CHANGELOG[currentVersion]) {
    changes = CHANGELOG[currentVersion].items || [];
  }
  return { version: currentVersion, isUpdate, changes };
});

// ===== 自动更新 IPC =====
ipcMain.handle('check-update', async () => {
  return await checkForUpdate();
});

ipcMain.handle('download-update', async (event, downloadUrl) => {
  try {
    const tmpPath = path.join(app.getPath('temp'), 'update_app_' + Date.now() + '.tmp');
    const asarPath = tmpPath.replace(/\.tmp$/, '.asar');
    await downloadWithRetry(downloadUrl, tmpPath, (percent) => {
      event.sender.send('update-download-progress', percent);
    });
    fs.renameSync(tmpPath, asarPath);
    return { success: true, tmpPath: asarPath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('install-update', (event, tmpPath) => {
  quitAndInstallUpdate(tmpPath);
  return { success: true };
});

ipcMain.handle('print-table', (event, table) => {
  const printWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const weekHeaders = WEEK_LABELS.map(w => `<th>${w}</th>`).join('');
  // 座位表：按座位图网格打印（含走道）
  let bodyMain;
  if (table.type === 'score') {
    // 成绩排名表：名次 / 姓名 / 各科 / 总分，按总分降序，同分同名次（1,1,3）
    const subjects = Array.isArray(table.subjects) ? table.subjects : [];
    const num = v => {
      if (v === null || v === undefined || String(v).trim() === '') return 0;
      const n = parseFloat(v);
      return isNaN(n) ? 0 : n;
    };
    const fmt = n => String(Math.round(n * 100) / 100);
    const rawRows = (table.score_rows || []).map(r => ({
      name: r.name || '',
      scores: Array.isArray(r.scores) ? r.scores : [],
      total: (r.scores || []).reduce((a, v) => a + num(v), 0),
      active: !!((r.name && String(r.name).trim() !== '') || (r.scores || []).some(v => v !== null && v !== undefined && String(v).trim() !== ''))
    })).filter(r => r.active);
    rawRows.sort((a, b) => b.total - a.total);
    let rank = 0, lastTotal = null, seen = 0;
    const subjHeads = subjects.map(s => `<th>${escapeHtml(s || '')}</th>`).join('');
    const scoreRowsHtml = rawRows.map(r => {
      seen++;
      if (r.total !== lastTotal) { rank = seen; lastTotal = r.total; }
      const cells = subjects.map((s, i) => `<td>${escapeHtml(r.scores[i] === undefined || r.scores[i] === null ? '' : r.scores[i])}</td>`).join('');
      return `<tr><td style="background:#e0f2f1;font-weight:bold;">${rank}</td><td style="font-weight:bold;">${escapeHtml(r.name)}</td>${cells}<td style="background:#fff3e0;font-weight:bold;color:#e65100;">${fmt(r.total)}</td></tr>`;
    }).join('\n');
    bodyMain = `
<table class="score">
  <thead>
    <tr><th>名次</th><th>姓名</th>${subjHeads}<th>总分</th></tr>
  </thead>
  <tbody>
    ${scoreRowsHtml}
  </tbody>
</table>`;
  } else if (table.type === 'seat') {
    const layout = table.seat_layout || { rows: 0, totalCols: 0, aisle: [], seatCols: [] };
    const cellMap = {};
    (table.rows || []).forEach(r => {
      if (r.seat_row !== undefined && r.seat_col !== undefined) cellMap[r.seat_row + '_' + r.seat_col] = escapeHtml(r.name || '');
    });
    const aisleSet = {};
    (layout.aisle || []).forEach(a => { aisleSet[a] = true; });
    let gridHtml = '';
    for (let r = 0; r < layout.rows; r++) {
      gridHtml += '<tr>';
      for (let c = 0; c < layout.totalCols; c++) {
        if (aisleSet[c]) {
          gridHtml += '<td class="aisle"></td>';
        } else {
          const nm = cellMap[r + '_' + c] || '';
          gridHtml += nm ? `<td>${nm}</td>` : '<td class="empty"></td>';
        }
      }
      gridHtml += '</tr>\n';
    }
    bodyMain = `
<table class="seat">
  <caption>—— 讲 台 ——</caption>
  <tbody>
    ${gridHtml}
  </tbody>
</table>`;
  } else {
  // 统计每个小组实际行数（最后一组可能不足 members_per_group）
  const groupSizes = {};
  table.rows.forEach(r => { groupSizes[r.group] = (groupSizes[r.group] || 0) + 1; });
  let rowsHtml = '';
  let currentGroup = null;
  for (const row of table.rows) {
    const groupNum = row.group;
    let groupCell = '';
    let grCell = '';
    let gsCell = '';
    if (groupNum !== currentGroup) {
      currentGroup = groupNum;
      const gs = groupSizes[groupNum];
      groupCell = `<td rowspan="${gs}" style="background:#eaf2f8;font-weight:bold;">第${groupNum}组</td>`;
      const grVal = (table.group_ranks && table.group_ranks[String(groupNum)]) || '';
      grCell = `<td rowspan="${gs}" style="background:#fff8e1;font-weight:bold;">${escapeHtml(grVal)}</td>`;
      const gsVal = (table.group_scores && table.group_scores[String(groupNum)] !== undefined) ? table.group_scores[String(groupNum)] : 0;
      gsCell = `<td rowspan="${gs}" style="background:#e8f5e9;font-weight:bold;color:#1b5e20;">${gsVal}</td>`;
    }
    const scoreVal = row.total_score !== undefined ? row.total_score : 0;
    const cells = row.cells.map(c => `<td>${escapeHtml(c)}</td>`).join('');
    rowsHtml += `<tr>${groupCell}${grCell}${gsCell}<td>${escapeHtml(row.name)}</td><td style="background:#e8f5e9;font-weight:bold;">${escapeHtml(row.personal_rank)}</td><td style="background:#fff3e0;font-weight:bold;color:#e65100;">${scoreVal}</td>${cells}</tr>\n`;
  }
  bodyMain = `
<table>
  <thead>
    <tr><th>第几小组</th><th>小组排名</th><th>小组总分</th><th>学生姓名</th><th>个人排名</th><th>总分</th>${weekHeaders}</tr>
  </thead>
  <tbody>
    ${rowsHtml}
  </tbody>
</table>`;
  }

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(table.name)}</title>
<style>
  body { font-family: "Microsoft YaHei", sans-serif; padding: 20px; }
  h1 { text-align: center; color: #2c5f8d; }
  .info { text-align: center; color: #666; margin-bottom: 15px; font-size: 14px; }
  table { border-collapse: collapse; width: 100%; font-size: 11px; }
  th, td { border: 1px solid #333; padding: 6px 4px; text-align: center; }
  th { background: #2c5f8d; color: white; }
  table.seat { border-collapse: separate; border-spacing: 6px; width: auto; margin: 0 auto; }
  table.seat caption { font-size: 18px; font-weight: bold; letter-spacing: 8px; color: #2c5f8d; margin-bottom: 18px; }
  table.seat td { width: 78px; height: 40px; border: 1px solid #888; border-radius: 8px; font-size: 13px; padding: 2px 4px; }
  table.seat td.aisle { border: none; width: 24px; background: transparent; }
  table.seat td.empty { background: #f5f5f5; border-style: dashed; }
  table.score { width: auto; min-width: 60%; margin: 0 auto; font-size: 13px; }
  table.score th, table.score td { min-width: 56px; padding: 7px 10px; }
  @media print {
    body { padding: 0; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
<div class="no-print" style="text-align:center;margin-bottom:10px;">
  <button onclick="window.print()" style="padding:8px 24px;font-size:14px;cursor:pointer;background:#27ae60;color:white;border:none;border-radius:4px;">打印</button>
  <button onclick="window.close()" style="padding:8px 24px;font-size:14px;cursor:pointer;background:#95a5a6;color:white;border:none;border-radius:4px;margin-left:10px;">关闭</button>
</div>
<h1>${escapeHtml(table.name)}</h1>
${table.type === 'score'
  ? `<div class="info">学生人数：${table.total_people} | 科目数：${table.num_subjects || (table.subjects || []).length} | 创建时间：${table.created_at}</div>`
  : `<div class="info">总人数：${table.total_people} | 小组数：${table.num_groups} | 每组人数：${table.members_per_group} | 创建时间：${table.created_at}</div>`}
${bodyMain}
</body>
</html>`;

  printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  return true;
});

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ===== 数据备份/恢复 =====
// 导出全部数据（表格+配置）为 JSON 备份文件
ipcMain.handle('backup-export', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '选择备份保存位置',
    defaultPath: `班级服务-备份-${new Date().toISOString().slice(0,10)}.json`,
    filters: [{ name: 'JSON 备份', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) return { success: false, error: '已取消' };
  try {
    ensureDataDir();
    // 仅备份表格数据，不含密码、设置等任何配置
    const backup = {
      version: app.getVersion(),
      backupTime: new Date().toISOString(),
      tables: loadTables(),
      roster: loadRoster(),
      duty: loadDuty(),
      homework: loadHomework()
    };
    fs.writeFileSync(result.filePath, JSON.stringify(backup, null, 2), 'utf-8');
    return { success: true, path: result.filePath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// 从 JSON 备份恢复数据（合并模式：不覆盖已有表格）
ipcMain.handle('backup-import', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择备份文件',
    filters: [{ name: 'JSON 备份', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return { success: false, error: '已取消' };
  try {
    const raw = fs.readFileSync(result.filePaths[0], 'utf-8');
    const data = JSON.parse(raw);
    if (!data.tables || !Array.isArray(data.tables)) {
      return { success: false, error: '备份文件格式不正确' };
    }
    // 合并：保留现有表格，把备份表格追加进来
    const existing = loadTables();
    const existingIds = new Set(existing.map(t => t.id));
    const existingNames = new Set(existing.map(t => t.name));
    let added = 0;
    let renamed = 0;
    for (const rawT of data.tables) {
      const t = migrateTable(rawT);
      // 重新分配 id，避免与现有表格冲突
      t.id = crypto.randomUUID();
      // 同名表格追加序号，避免混淆
      if (existingNames.has(t.name)) {
        let i = 1;
        const base = t.name;
        while (existingNames.has(base + '(' + i + ')')) i++;
        t.name = base + '(' + i + ')';
        renamed++;
      }
      existingNames.add(t.name);
      existing.push(t);
      added++;
    }
    saveTables(existing);
    // 新模块数据：仅当当前数据为空时从备份恢复，避免覆盖现有内容
    const restoredModules = [];
    try {
      if (data.roster && Array.isArray(data.roster.students) && data.roster.students.length) {
        if (loadRoster().students.length === 0) {
          saveRoster(data.roster);
          restoredModules.push('学生名单');
        }
      }
      if (data.duty && data.duty.days) {
        const cur = loadDuty();
        const hasAny = Object.keys(cur.days).some(d => Object.keys(cur.days[d]).some(t => cur.days[d][t].length));
        if (!hasAny) {
          saveDuty(data.duty);
          restoredModules.push('值日表');
        }
      }
      if (data.homework && Array.isArray(data.homework.records) && data.homework.records.length) {
        if (loadHomework().records.length === 0) {
          saveHomework(data.homework);
          restoredModules.push('作业登记');
        }
      }
    } catch (e) {
      // 新模块恢复失败不影响表格恢复
    }
    return { success: true, count: added, renamed: renamed, total: existing.length, restoredModules };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ===== 完整备份（导出到指定文件夹 / 校验后恢复）=====
const BACKUP_FORMAT = 'class-service-full-backup';
// 仅备份界面偏好类配置，任何密码、同步令牌、锁定状态都不进入备份
const BACKUP_CONFIG_KEYS = ['soundEnabled', 'soundVolume', 'language', 'fontFamily', 'bgmEnabled', 'bgmVolume', 'themeSkin', 'displayTheme', 'autoSave'];

function sanitizeConfigForBackup(config) {
  const out = {};
  BACKUP_CONFIG_KEYS.forEach(k => {
    if (config && config[k] !== undefined) out[k] = config[k];
  });
  return out;
}

function buildFullBackup() {
  return {
    app: 'class-service-manager',
    format: BACKUP_FORMAT,
    formatVersion: 1,
    version: app.getVersion(),
    backupTime: new Date().toISOString(),
    tables: loadTables(),
    roster: loadRoster(),
    duty: loadDuty(),
    homework: loadHomework(),
    config: sanitizeConfigForBackup(loadConfig())
  };
}

// 校验备份结构，避免把无关 JSON 或损坏文件导入
function validateBackupData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: '备份文件内容无法识别' };
  }
  if (!Array.isArray(data.tables)) {
    return { ok: false, error: '备份文件缺少表格数据，可能不是本软件的备份文件' };
  }
  for (const t of data.tables) {
    if (!t || typeof t !== 'object') return { ok: false, error: '备份文件中的表格数据已损坏' };
    if (!Array.isArray(t.rows) && !Array.isArray(t.score_rows)) {
      return { ok: false, error: `表格「${t.name || '未命名'}」数据不完整` };
    }
  }
  if (data.roster !== undefined && data.roster !== null) {
    if (typeof data.roster !== 'object' || (data.roster.students !== undefined && !Array.isArray(data.roster.students))) {
      return { ok: false, error: '备份文件中的学生名单数据已损坏' };
    }
  }
  if (data.duty !== undefined && data.duty !== null) {
    if (typeof data.duty !== 'object' || (data.duty.days !== undefined && (typeof data.duty.days !== 'object' || Array.isArray(data.duty.days)))) {
      return { ok: false, error: '备份文件中的值日表数据已损坏' };
    }
  }
  if (data.homework !== undefined && data.homework !== null) {
    if (typeof data.homework !== 'object' || (data.homework.records !== undefined && !Array.isArray(data.homework.records))) {
      return { ok: false, error: '备份文件中的作业登记数据已损坏' };
    }
  }
  if (data.config !== undefined && data.config !== null && typeof data.config !== 'object') {
    return { ok: false, error: '备份文件中的设置数据已损坏' };
  }
  return { ok: true };
}

function summarizeBackup(data) {
  const tables = data.tables || [];
  const byType = { ranking: 0, score: 0, seat: 0 };
  tables.forEach(t => {
    const ty = (t && t.type) || 'ranking';
    byType[ty] = (byType[ty] || 0) + 1;
  });
  let dutyDays = 0;
  if (data.duty && data.duty.days && typeof data.duty.days === 'object') {
    DUTY_DAYS.forEach(d => {
      const day = data.duty.days[d];
      if (day && typeof day === 'object' && Object.keys(day).some(k => Array.isArray(day[k]) && day[k].length)) dutyDays++;
    });
  }
  return {
    version: data.version || '',
    backupTime: data.backupTime || '',
    isFull: data.format === BACKUP_FORMAT,
    tableCount: tables.length,
    rankingCount: byType.ranking || 0,
    scoreCount: byType.score || 0,
    seatCount: byType.seat || 0,
    rosterCount: data.roster && Array.isArray(data.roster.students) ? data.roster.students.length : 0,
    dutyDays,
    homeworkCount: data.homework && Array.isArray(data.homework.records) ? data.homework.records.length : 0,
    hasConfig: !!(data.config && typeof data.config === 'object')
  };
}

function timestampForFile(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// 导出全部数据到用户选择的文件夹（U 盘、桌面、任意目录均可）
ipcMain.handle('backup-export-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择导出文件夹（如 U 盘或备份目录）',
    buttonLabel: '导出到此文件夹',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) return { success: false, error: '已取消' };
  try {
    const folder = result.filePaths[0];
    const stamp = timestampForFile(new Date());
    let filePath = path.join(folder, `班级服务-完整备份-${stamp}.json`);
    let i = 1;
    while (fs.existsSync(filePath)) {
      filePath = path.join(folder, `班级服务-完整备份-${stamp}(${i}).json`);
      i++;
    }
    const backup = buildFullBackup();
    fs.writeFileSync(filePath, JSON.stringify(backup, null, 2), 'utf-8');
    return { success: true, path: filePath, summary: summarizeBackup(backup) };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// 只读取并校验备份文件，返回摘要，不修改任何数据
ipcMain.handle('backup-validate', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择要恢复的备份文件',
    filters: [
      { name: '备份文件', extensions: ['json'] },
      { name: '全部文件', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) return { success: false, error: '已取消' };
  const filePath = result.filePaths[0];
  try {
    const raw = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
    const data = JSON.parse(raw);
    const check = validateBackupData(data);
    if (!check.ok) return { success: false, error: check.error };
    return { success: true, path: filePath, summary: summarizeBackup(data) };
  } catch (e) {
    return { success: false, error: '文件读取或解析失败：' + e.message };
  }
});

// 按合并 / 覆盖两种策略恢复完整备份；恢复前自动保存当前数据快照
ipcMain.handle('backup-import-full', async (event, payload = {}) => {
  try {
    const filePath = payload && payload.filePath;
    const mode = payload && payload.mode;
    if (!filePath || !fs.existsSync(filePath)) return { success: false, error: '备份文件不存在' };
    if (mode !== 'merge' && mode !== 'overwrite') return { success: false, error: '恢复方式无效' };
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, ''));
    const check = validateBackupData(data);
    if (!check.ok) return { success: false, error: check.error };

    // 恢复前快照：完整备份当前数据，失败则终止恢复
    ensureDataDir();
    const backupDir = path.join(DATA_DIR, 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const preBackupPath = path.join(backupDir, `preimport_${timestampForFile(new Date()).replace(/[-_]/g, '').replace(/(\d{8})(\d{6})/, '$1_$2')}.json`);
    fs.writeFileSync(preBackupPath, JSON.stringify(buildFullBackup(), null, 2), 'utf-8');

    const existingTables = loadTables();
    let tablesAdded = 0;
    let rosterAdded = 0;
    let dutyFilled = 0;
    let homeworkAdded = 0;

    if (mode === 'overwrite') {
      // 覆盖：用备份完全替换当前数据（表格 id 去重，避免内部冲突）
      const usedIds = new Set();
      const usedNames = new Set();
      const newTables = data.tables.map(raw => {
        const t = migrateTable(JSON.parse(JSON.stringify(raw)));
        if (!t.id || usedIds.has(t.id)) t.id = crypto.randomUUID();
        usedIds.add(t.id);
        let nm = String(t.name || '未命名表格');
        if (usedNames.has(nm)) {
          let i = 1;
          while (usedNames.has(`${nm}(${i})`)) i++;
          nm = `${nm}(${i})`;
        }
        t.name = nm;
        usedNames.add(nm);
        return t;
      });
      saveTables(newTables);
      tablesAdded = newTables.length;
      // 仅恢复备份中确实存在的模块，缺失模块保留当前数据，避免误清空
      if (data.roster && Array.isArray(data.roster.students)) saveRoster(data.roster);
      if (data.duty && data.duty.days && typeof data.duty.days === 'object') saveDuty(data.duty);
      if (data.homework && Array.isArray(data.homework.records)) saveHomework(data.homework);
      if (data.config && typeof data.config === 'object') {
        const cur = loadConfig();
        BACKUP_CONFIG_KEYS.forEach(k => {
          if (data.config[k] !== undefined) cur[k] = data.config[k];
        });
        saveConfig(cur);
      }
      rosterAdded = (data.roster && Array.isArray(data.roster.students)) ? data.roster.students.length : 0;
      homeworkAdded = (data.homework && Array.isArray(data.homework.records)) ? data.homework.records.length : 0;
    } else {
      // 合并：只追加不重复的内容，绝不覆盖现有数据
      const existingNames = new Set(existingTables.map(t => t.name));
      data.tables.forEach(raw => {
        const t = migrateTable(JSON.parse(JSON.stringify(raw)));
        t.id = crypto.randomUUID();
        let nm = String(t.name || '未命名表格');
        if (existingNames.has(nm)) {
          let i = 1;
          while (existingNames.has(`${nm}(${i})`)) i++;
          nm = `${nm}(${i})`;
        }
        t.name = nm;
        existingNames.add(nm);
        existingTables.push(t);
        tablesAdded++;
      });
      if (tablesAdded) saveTables(existingTables);

      // 学生名单：按姓名去重，保留现有记录
      if (data.roster && Array.isArray(data.roster.students) && data.roster.students.length) {
        const cur = loadRoster();
        const names = new Set(cur.students.map(s => s.name));
        data.roster.students.forEach(s => {
          const nm = String((s && s.name) || '').trim();
          if (!nm || names.has(nm)) return;
          names.add(nm);
          cur.students.push({
            id: crypto.randomUUID(),
            name: nm,
            group: (s && s.group !== undefined && s.group !== null) ? s.group : '',
            note: String((s && s.note) || '')
          });
          rosterAdded++;
        });
        if (rosterAdded) saveRoster(cur);
      }

      // 值日表：只补全当前为空的时段，已有安排不动
      if (data.duty && data.duty.days && typeof data.duty.days === 'object') {
        const cur = loadDuty();
        DUTY_DAYS.forEach(d => {
          const srcDay = data.duty.days[d];
          if (!srcDay || typeof srcDay !== 'object') return;
          cur.tasks.forEach(task => {
            if (cur.days[d][task].length > 0) return;
            const src = Array.isArray(srcDay[task]) ? srcDay[task].map(n => String(n).trim()).filter(Boolean) : [];
            if (src.length) {
              cur.days[d][task] = src;
              dutyFilled++;
            }
          });
        });
        if (dutyFilled) saveDuty(cur);
      }

      // 作业登记：按「日期+科目+内容」去重后追加
      if (data.homework && Array.isArray(data.homework.records) && data.homework.records.length) {
        const cur = loadHomework();
        const seen = new Set(cur.records.map(r => [r.date, r.subject, r.content].join('|')));
        data.homework.records.forEach(r => {
          if (!r || typeof r !== 'object') return;
          const key = [String(r.date || ''), String(r.subject || ''), String(r.content || '')].join('|');
          if (seen.has(key)) return;
          seen.add(key);
          cur.records.push({
            id: crypto.randomUUID(),
            date: String(r.date || ''),
            subject: String(r.subject || ''),
            content: String(r.content || ''),
            missing: Array.isArray(r.missing) ? r.missing.map(n => String(n)).filter(Boolean) : [],
            total: Number(r.total) || 0,
            created_at: r.created_at || new Date().toLocaleString('zh-CN', { hour12: false })
          });
          homeworkAdded++;
        });
        if (homeworkAdded) saveHomework(cur);
      }
    }

    return {
      success: true,
      mode,
      tablesAdded,
      rosterAdded,
      dutyFilled,
      homeworkAdded,
      total: loadTables().length,
      preBackupPath
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ===== 自动备份列表与恢复 =====
ipcMain.handle('list-auto-backups', () => {
  const backupDir = path.join(DATA_DIR, 'backups');
  if (!fs.existsSync(backupDir)) return [];
  try {
    return fs.readdirSync(backupDir)
      .filter(f => f.startsWith('tables_') && f.endsWith('.json'))
      .sort()
      .reverse()
      .map(f => {
        const full = path.join(backupDir, f);
        const stat = fs.statSync(full);
        // 从文件名解析时间：tables_YYYYMMDD_HHmmss.json
        const m = f.match(/tables_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\.json/);
        let time = '';
        if (m) time = `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}`;
        return { file: f, time: time, size: stat.size };
      });
  } catch (e) {
    return [];
  }
});

ipcMain.handle('restore-auto-backup', (event, fileName) => {
  try {
    const backupDir = path.join(DATA_DIR, 'backups');
    const src = path.join(backupDir, fileName);
    if (!fs.existsSync(src)) return { success: false, error: '备份文件不存在' };
    // 恢复前先把当前数据再存一份到恢复前备份目录
    const preRestoreDir = path.join(DATA_DIR, 'backups', '_prerestore');
    if (!fs.existsSync(preRestoreDir)) fs.mkdirSync(preRestoreDir, { recursive: true });
    if (fs.existsSync(TABLES_FILE)) {
      const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      fs.copyFileSync(TABLES_FILE, path.join(preRestoreDir, `tables_${stamp}.json`));
    }
    fs.copyFileSync(src, TABLES_FILE);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ===== GitHub 数据云同步（密码加密） =====
const SYNC_REPO = 'wdwwangdawei/class-service';
const SYNC_RELEASE_TAG = 'data-sync';
const SYNC_ASSET_NAME = 'data.enc';

// 用密码派生 AES-256 密钥（PBKDF2）
function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
}

// 加密数据
function encryptData(data, password) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveKey(password, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
}

// 解密数据
function decryptData(encryptedB64, password) {
  const buf = Buffer.from(encryptedB64, 'base64');
  const salt = buf.subarray(0, 16);
  const iv = buf.subarray(16, 28);
  const tag = buf.subarray(28, 44);
  const encrypted = buf.subarray(44);
  const key = deriveKey(password, salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

// 获取或创建 data-sync Release
async function getOrCreateSyncRelease() {
  // 直接按 tag 名获取，避免 Releases 列表分页导致找不到旧 tag
  let release = await githubApi(`https://api.github.com/repos/${SYNC_REPO}/releases/tags/${SYNC_RELEASE_TAG}`);
  if (release && release.id) {
    return release;
  }
  release = await githubApi(`https://api.github.com/repos/${SYNC_REPO}/releases`, 'POST', {
    tag_name: SYNC_RELEASE_TAG,
    name: '数据同步',
    body: '加密的同步数据文件',
    draft: false,
    prerelease: false
  });
  if (!release || !release.id) {
    throw new Error('创建 Release 失败：' + (release && release.message ? release.message : '未知错误'));
  }
  return release;
}

// GitHub API 封装
async function githubApi(url, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      headers: {
        'User-Agent': 'ClassServiceApp',
        'Accept': 'application/vnd.github+json'
      }
    };
    const token = (loadSecrets().githubToken || '').trim();
    if (token) {
      options.headers['Authorization'] = 'token ' + token;
    }
    let bodyStr = null;
    if (body) {
      bodyStr = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// 设置同步密码
ipcMain.handle('sync-set-password', async (event, password) => {
  try {
    const config = loadConfig();
    config.syncPassword = password || '';
    saveConfig(config);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// 设置 GitHub Token
ipcMain.handle('sync-set-token', async (event, token) => {
  try {
    ensureDataDir();
    const secrets = loadSecrets();
    secrets.githubToken = (token || '').trim();
    fs.writeFileSync(SECRETS_FILE, JSON.stringify(secrets, null, 2), 'utf-8');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// 获取 GitHub Token 状态（不返回完整 token，只返回是否已设置）
ipcMain.handle('sync-get-token', async () => {
  try {
    const token = (loadSecrets().githubToken || '').trim();
    return { success: true, hasToken: !!token, tokenPrefix: token ? token.substring(0, 6) + '...' : '' };
  } catch (e) {
    return { success: false, hasToken: false, error: e.message };
  }
});

// 上传数据到 GitHub（加密）
ipcMain.handle('sync-upload', async (event, password) => {
  try {
    const config = loadConfig();
    const pwd = password || config.syncPassword;
    if (!pwd) return { success: false, error: '请先设置同步密码' };

    ensureDataDir();
    const tables = loadTables();
    const payload = {
      version: app.getVersion(),
      syncTime: new Date().toISOString(),
      tables: tables
    };
    const encrypted = encryptData(payload, pwd);

    // 获取或创建 release
    const release = await getOrCreateSyncRelease();

    // 删除旧的 data.enc 资产
    const oldAsset = (release.assets || []).find(a => a.name === SYNC_ASSET_NAME);
    if (oldAsset) {
      await githubApi(`https://api.github.com/repos/${SYNC_REPO}/releases/assets/${oldAsset.id}`, 'DELETE');
    }

    // 上传新的加密数据
    if (!release.upload_url) throw new Error('Release 缺少 upload_url');
    const uploadUrl = release.upload_url.replace(/\{.*\}$/, `?name=${encodeURIComponent(SYNC_ASSET_NAME)}`);
    const bytes = Buffer.from(encrypted, 'utf8');
    if (bytes.length === 0) throw new Error('加密数据为空');
    const token = (loadSecrets().githubToken || '').trim();
    const uploadHeaders = {
      'User-Agent': 'ClassServiceApp',
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/octet-stream',
      'Content-Length': bytes.length
    };
    if (token) uploadHeaders['Authorization'] = 'token ' + token;
    const result = await new Promise((resolve, reject) => {
      const urlObj = new URL(uploadUrl);
      const req = https.request(urlObj, {
        method: 'POST',
        headers: uploadHeaders
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          if (res.statusCode !== 201) { reject(new Error('上传失败：HTTP ' + res.statusCode + ' ' + (data || '').slice(0, 300))); return; }
          try { resolve(JSON.parse(data)); } catch { resolve({}); }
        });
      });
      req.on('error', reject);
      req.end(bytes);
    });

    if (result && result.id) {
      return { success: true, time: payload.syncTime, count: tables.length };
    }
    return { success: false, error: '上传失败' };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// 从 GitHub 下载数据（解密）
ipcMain.handle('sync-download', async (event, password) => {
  try {
    const config = loadConfig();
    const pwd = password || config.syncPassword;
    if (!pwd) return { success: false, error: '请先输入同步密码' };

    const release = await githubApi(`https://api.github.com/repos/${SYNC_REPO}/releases/tags/${SYNC_RELEASE_TAG}`);
    if (!release || !release.assets || release.assets.length === 0) {
      return { success: false, error: '云端暂无同步数据' };
    }
    const asset = release.assets.find(a => a.name === SYNC_ASSET_NAME);
    if (!asset) return { success: false, error: '云端暂无同步数据' };

    // 下载加密数据（用 API 接口，避免 browser_download_url 的 302 重定向问题）
    const encryptedB64 = await new Promise((resolve, reject) => {
      const opts = {
        method: 'GET',
        headers: (() => {
          const h = {
            'User-Agent': 'ClassServiceApp',
            'Accept': 'application/octet-stream'
          };
          const token = (loadSecrets().githubToken || '').trim();
          if (token) h['Authorization'] = 'token ' + token;
          return h;
        })()
      };
      const req = https.request(`https://api.github.com/repos/${SYNC_REPO}/releases/assets/${asset.id}`, opts, (res) => {
        // 跟随重定向（objects.githubusercontent.com）
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          https.get(res.headers.location, { headers: (() => { const h = { 'User-Agent': 'ClassServiceApp' }; const token = (loadSecrets().githubToken || '').trim(); if (token) h['Authorization'] = 'token ' + token; return h; })() }, (r2) => {
            if (r2.statusCode !== 200) { reject(new Error('下载失败：HTTP ' + r2.statusCode)); return; }
            let data = '';
            r2.on('data', c => data += c);
            r2.on('end', () => resolve(data));
          }).on('error', reject);
          return;
        }
        if (res.statusCode !== 200) { reject(new Error('下载失败：HTTP ' + res.statusCode)); return; }
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.end();
    });

    // 解密
    let payload;
    try {
      payload = decryptData(encryptedB64.trim(), pwd);
    } catch (e) {
      return { success: false, error: '密码错误或数据已损坏' };
    }

    // 合并数据到本地（不覆盖已有表格）
    const existing = loadTables();
    const existingNames = new Set(existing.map(t => t.name));
    let added = 0, renamed = 0;
    for (const rawT of (payload.tables || [])) {
      const t = migrateTable(rawT);
      t.id = crypto.randomUUID();
      if (existingNames.has(t.name)) {
        let i = 1;
        const base = t.name;
        while (existingNames.has(base + '(' + i + ')')) i++;
        t.name = base + '(' + i + ')';
        renamed++;
      }
      existingNames.add(t.name);
      existing.push(t);
      added++;
    }
    saveTables(existing);

    return { success: true, count: added, renamed, total: existing.length, time: payload.syncTime };
  } catch (e) {
    if (e.message && e.message.indexOf('404') !== -1) {
      return { success: false, error: '云端暂无同步数据' };
    }
    return { success: false, error: e.message };
  }
});

// 获取同步状态
ipcMain.handle('sync-get-status', () => {
  const config = loadConfig();
  return { hasPassword: !!config.syncPassword };
});

// ===== Excel 导出 =====
// 将指定表格导出为 .xlsx 文件
ipcMain.handle('export-excel', async (event, table) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出 Excel',
    defaultPath: `${table.name || '排名表'}.xlsx`,
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  });
  if (result.canceled || !result.filePath) return { success: false, error: '已取消' };
  try {
    const wb = XLSX.utils.book_new();
    // 座位表：按座位图网格导出（含走道列）
    if (table.type === 'seat') {
      const layout = table.seat_layout || { rows: 0, totalCols: 0, aisle: [], seatCols: [] };
      const cellMap = {};
      (table.rows || []).forEach(r => {
        if (r.seat_row !== undefined && r.seat_col !== undefined) cellMap[r.seat_row + '_' + r.seat_col] = r.name || '';
      });
      const gridData = [];
      const headerRow = ['—— 讲 台 ——'];
      const padLen = Math.max(layout.totalCols, 1) - 1;
      for (let i = 0; i < padLen; i++) headerRow.push('');
      gridData.push(headerRow);
      for (let r = 0; r < layout.rows; r++) {
        const line = [];
        for (let c = 0; c < layout.totalCols; c++) {
          line.push((layout.aisle || []).indexOf(c) !== -1 ? '' : (cellMap[r + '_' + c] || ''));
        }
        gridData.push(line);
      }
      const wsGrid = XLSX.utils.aoa_to_sheet(gridData);
      // 合并表头单元格
      const merges = layout.totalCols > 1 ? [{ s: { r: 0, c: 0 }, e: { r: 0, c: layout.totalCols - 1 } }] : [];
      wsGrid['!merges'] = merges;
      wsGrid['!cols'] = Array(Math.max(layout.totalCols, 1)).fill({ wch: 9 });
      wsGrid['!rows'] = [{ hpt: 32 }, ...Array(Math.max(layout.rows, 0)).fill({ hpt: 24 })];
      XLSX.utils.book_append_sheet(wb, wsGrid, '座位表');
      XLSX.writeFile(wb, result.filePath);
      return { success: true, path: result.filePath };
    }
    // 表头
    const headers = ['第几小组', '小组排名', '小组总分', '学生姓名', '个人排名', '总分', ...WEEK_LABELS];
    const data = [headers];
    // 统计每个小组实际行数
    const groupSizes = {};
    table.rows.forEach(r => { groupSizes[r.group] = (groupSizes[r.group] || 0) + 1; });
    const groupStartRow = {};
    const seen = new Set();
    table.rows.forEach((r, idx) => { if (!seen.has(r.group)) { groupStartRow[r.group] = idx; seen.add(r.group); } });
    // 行数据
    for (const row of table.rows) {
      const isGroupFirst = groupStartRow[row.group] === table.rows.indexOf(row);
      const groupScore = table.group_scores ? (table.group_scores[String(row.group)] || 0) : 0;
      const line = [
        isGroupFirst ? `第${row.group}组` : '',
        isGroupFirst ? (table.group_ranks[String(row.group)] || '') : '',
        isGroupFirst ? groupScore : '',
        row.name || '',
        row.personal_rank || '',
        row.total_score !== undefined ? row.total_score : 0,
        ...(row.cells || [])
      ];
      data.push(line);
    }
    const ws = XLSX.utils.aoa_to_sheet(data);
    // 合并单元格：小组排名、小组总分列，按组分合并
    const merges = [];
    const groupStartIdx = {};
    table.rows.forEach((r, idx) => {
      if (!(r.group in groupStartIdx)) groupStartIdx[r.group] = idx + 1; // +1 因为有表头行
    });
    Object.keys(groupSizes).forEach(g => {
      const start = groupStartIdx[g];
      const size = groupSizes[g];
      if (size > 1) {
        // 列 0=小组, 1=小组排名, 2=小组总分
        merges.push({ s: { r: start, c: 0 }, e: { r: start + size - 1, c: 0 } });
        merges.push({ s: { r: start, c: 1 }, e: { r: start + size - 1, c: 1 } });
        merges.push({ s: { r: start, c: 2 }, e: { r: start + size - 1, c: 2 } });
      }
    });
    ws['!merges'] = merges;
    // 列宽
    ws['!cols'] = headers.map((h, i) => {
      if (i === 3) return { wch: 12 }; // 姓名
      if (i < 6) return { wch: 10 };
      return { wch: 8 };
    });
    XLSX.utils.book_append_sheet(wb, ws, '排名表');
    XLSX.writeFile(wb, result.filePath);
    return { success: true, path: result.filePath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ===== Excel 导入 =====
// 从 .xlsx/.xls/.csv 导入名单，创建新表格
ipcMain.handle('import-excel', async (event, params) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '导入 Excel',
    filters: [
      { name: 'Excel', extensions: ['xlsx', 'xls'] },
      { name: 'CSV', extensions: ['csv'] }
    ],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return { success: false, error: '已取消' };
  try {
    const wb = XLSX.readFile(result.filePaths[0]);
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
    if (rows.length === 0) return { success: false, error: 'Excel 文件为空' };
    // 自动识别表头：第一行包含"姓名"或"组"等关键字
    // 第 1 列默认为小组号，第 2 列为姓名
    // 支持两种格式：
    //   A. 第1列=组号, 第2列=姓名
    //   B. 仅第1列=姓名（整表同组）
    let dataRows = rows;
    const firstRow = rows[0];
    const isHeader = firstRow.some(c => typeof c === 'string' && /姓名|组|名/.test(c));
    if (isHeader) dataRows = rows.slice(1);
    if (dataRows.length === 0) return { success: false, error: '没有数据行' };

    // 仅提取姓名列：扫描所有列，取第一个非空且看起来像姓名的列
    // 策略：优先选择包含"姓名"表头的列；否则选择数据最多且非纯数字的列
    let nameColIdx = -1;
    // 找表头行中的"姓名"列
    if (isHeader) {
      for (let c = 0; c < firstRow.length; c++) {
        const h = String(firstRow[c] || '').trim();
        if (/姓名|名字|名/.test(h) && !/组|号/.test(h)) {
          nameColIdx = c;
          break;
        }
      }
    }
    // 如果没找到姓名列，找数据最多且非纯数字的列
    if (nameColIdx === -1) {
      const colStats = [];
      for (let c = 0; c < 20; c++) {
        let count = 0;
        let allNum = true;
        for (const r of dataRows) {
          const v = String(r[c] || '').trim();
          if (v) {
            count++;
            if (!/^\d+$/.test(v)) allNum = false;
          }
        }
        colStats.push({ col: c, count, allNum });
      }
      colStats.sort((a, b) => b.count - a.count);
      // 优先非纯数字列
      const candidate = colStats.find(s => !s.allNum && s.count > 0) || colStats.find(s => s.count > 0);
      if (candidate) nameColIdx = candidate.col;
    }
    if (nameColIdx === -1) return { success: false, error: '未识别到姓名列' };

    // 提取所有姓名
    const names = [];
    for (const r of dataRows) {
      const v = String(r[nameColIdx] || '').trim();
      if (v) names.push(v);
    }
    if (names.length === 0) return { success: false, error: '未识别到有效姓名' };

    // 按每组成员数量分组（默认 6 人）
    const mpg = parseInt(params.membersPerGroup, 10) || 6;
    const numGroups = Math.ceil(names.length / mpg);

    // 创建表格
    const table = createTable(params.name || '导入表格', names.length, mpg);
    table.rows = [];
    names.forEach((nm, i) => {
      const g = Math.floor(i / mpg) + 1;
      table.rows.push({
        group: g,
        name: nm,
        personal_rank: '',
        total_score: 0,
        cells: Array(WEEK_LABELS.length).fill('')
      });
    });
    table.num_groups = numGroups;
    table.members_per_group = mpg;
    table.group_ranks = {};
    for (let g = 1; g <= numGroups; g++) table.group_ranks[String(g)] = '';

    const tables = loadTables();
    tables.push(table);
    saveTables(tables);
    return { success: true, table };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// 仅导入姓名（用于量化表编辑时批量填入姓名）
ipcMain.handle('import-names', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '导入姓名',
    filters: [
      { name: 'Excel', extensions: ['xlsx', 'xls'] },
      { name: 'CSV', extensions: ['csv'] }
    ],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return { success: false, error: '已取消' };
  try {
    const wb = XLSX.readFile(result.filePaths[0]);
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
    if (rows.length === 0) return { success: false, error: 'Excel 文件为空' };
    const cellText = (r, c) => String((r && r[c] !== undefined && r[c] !== null) ? r[c] : '').trim();
    const RE_NAME_HEADER = /姓名|名字/;
    const RE_HEADER_HINT = /姓名|名字|序号|学号|编号|班级|小组|组别|排名|名次|总分|成绩|备注|名单/;

    // 在前 3 行内查找表头行（必须真的包含「姓名 / 名字」）
    let headerRowIdx = -1;
    const scanRows = Math.min(3, rows.length);
    for (let i = 0; i < scanRows; i++) {
      const r = rows[i] || [];
      if (r.some(c => typeof c === 'string' && RE_NAME_HEADER.test(c))) { headerRowIdx = i; break; }
    }

    let dataRows;
    if (headerRowIdx >= 0 && headerRowIdx < rows.length - 1) {
      dataRows = rows.slice(headerRowIdx + 1);
    } else {
      headerRowIdx = -1;
      dataRows = rows.slice();
      // 首行只有一个单元格、第二行更宽时，视为合并标题行
      if (rows.length > 1) {
        const r0n = (rows[0] || []).filter(v => String(v || '').trim() !== '').length;
        const r1n = (rows[1] || []).filter(v => String(v || '').trim() !== '').length;
        if (r0n <= 1 && r1n > r0n) dataRows = rows.slice(1);
      }
    }
    dataRows = dataRows.filter(r => r && r.some(v => String(v || '').trim() !== ''));
    if (dataRows.length === 0) return { success: false, error: '没有数据行' };

    const maxCol = Math.max.apply(null, rows.map(r => r.length));
    const RE_CN = /[一-龥]/;
    function looksLikeName(s) { return /^[一-龥·]{2,6}$/.test(s); }

    let nameColIdx = -1;
    if (headerRowIdx >= 0) {
      const headerRow = rows[headerRowIdx];
      for (let c = 0; c < maxCol; c++) {
        const h = cellText(headerRow, c);
        if (RE_NAME_HEADER.test(h) && !/学号|序号|编号|排名|名次|班级|小组/.test(h)) { nameColIdx = c; break; }
      }
    }
    if (nameColIdx === -1) {
      let bestRatio = 0;
      for (let c = 0; c < maxCol; c++) {
        if (headerRowIdx >= 0 && /学号|序号|编号|排名|名次|班级|小组|备注/.test(cellText(rows[headerRowIdx], c))) continue;
        let total = 0, nameHits = 0, cnHits = 0;
        for (const r of dataRows) {
          const v = cellText(r, c);
          if (!v) continue;
          total++;
          if (looksLikeName(v)) nameHits++;
          if (RE_CN.test(v)) cnHits++;
        }
        if (total > 0) {
          const ratio = (nameHits * 2 + cnHits) / total;
          if (cnHits / total >= 0.5 && ratio > bestRatio) { bestRatio = ratio; nameColIdx = c; }
        }
      }
    }
    if (nameColIdx === -1) return { success: false, error: '未识别到姓名列' };

    const names = [];
    for (const r of dataRows) {
      const v = cellText(r, nameColIdx);
      if (!v) continue;
      // 过滤表头文字与纯数字，避免把「姓名」等表头当成学生
      if (RE_HEADER_HINT.test(v) && v.length <= 6) continue;
      if (/^\d+(\.\d+)?$/.test(v)) continue;
      names.push(v);
    }
    if (names.length === 0) return { success: false, error: '未识别到有效姓名' };
    return { success: true, names };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// 将导入的姓名应用到量化表（替换或追加）
ipcMain.handle('apply-names-to-table', (event, { tableId, names, mode }) => {
  try {
    const tables = loadTables();
    const idx = tables.findIndex(t => t.id === tableId);
    if (idx === -1) return { success: false, error: '表格不存在' };
    const table = tables[idx];
    const mpg = table.members_per_group || 6;
    const weekCount = (table.rows[0] && table.rows[0].cells) ? table.rows[0].cells.length : WEEK_LABELS.length;

    if (mode === 'append') {
      // 追加：在现有行末尾添加
      for (const nm of names) {
        const lastGroup = table.rows.length > 0 ? Math.max(...table.rows.map(r => r.group)) : 0;
        const lastGroupSize = table.rows.filter(r => r.group === lastGroup).length;
        let newGroup;
        if (lastGroup === 0 || lastGroupSize >= mpg) newGroup = lastGroup + 1;
        else newGroup = lastGroup;
        table.rows.push({
          group: newGroup,
          name: nm,
          personal_rank: '',
          total_score: 0,
          cells: Array(weekCount).fill('')
        });
      }
    } else {
      // 替换：清空所有姓名，确保行数足够，再填入
      table.rows.forEach(r => { r.name = ''; });
      while (table.rows.length < names.length) {
        const lastGroup = table.rows.length > 0 ? Math.max(...table.rows.map(r => r.group)) : 0;
        const lastGroupSize = table.rows.filter(r => r.group === lastGroup).length;
        let newGroup;
        if (lastGroup === 0 || lastGroupSize >= mpg) newGroup = lastGroup + 1;
        else newGroup = lastGroup;
        table.rows.push({
          group: newGroup,
          name: '',
          personal_rank: '',
          total_score: 0,
          cells: Array(weekCount).fill('')
        });
      }
      for (let k = 0; k < names.length; k++) {
        table.rows[k].name = names[k];
      }
    }
    table.total_people = table.rows.length;
    table.num_groups = Math.max(...table.rows.map(r => r.group));
    if (!table.group_ranks) table.group_ranks = {};
    for (let g = 1; g <= table.num_groups; g++) {
      table.group_ranks[String(g)] = table.group_ranks[String(g)] || '';
    }
    tables[idx] = table;
    saveTables(tables);
    return { success: true, table };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// 导入成绩表用于排座位：读取姓名列 + 成绩列
ipcMain.handle('import-scores', async (event, params) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '导入成绩表',
    filters: [
      { name: 'Excel', extensions: ['xlsx', 'xls'] },
      { name: 'CSV', extensions: ['csv'] }
    ],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return { success: false, error: '已取消' };
  try {
    const wb = XLSX.readFile(result.filePaths[0]);
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
    if (rows.length === 0) return { success: false, error: '文件为空' };
    let dataRows = rows;
    // 跳过可能的标题行（只有1个非空单元格，或合并单元格的标题）
    let headerRowIdx = 0;
    const row0NonEmpty = rows[0].filter(v => String(v || '').trim() !== '').length;
    if (row0NonEmpty <= 2 && rows.length > 1) {
      headerRowIdx = 1;
    }
    const firstRow = rows[headerRowIdx];
    // 只有包含"姓名/名字"列才认定为表头行（避免标题行含"成绩"被误判）
    const isHeader = firstRow.some(c => typeof c === 'string' && /姓名|名字/.test(c));
    if (isHeader) {
      dataRows = rows.slice(headerRowIdx + 1).filter(r => r && r.some(v => String(v || '').trim() !== ''));
    }
    if (dataRows.length === 0) return { success: false, error: '没有数据行' };

    const maxCol = Math.max.apply(null, rows.map(r => r.length));
    const RE_NUM = /^-?\d+(\.\d+)?$/;
    const RE_CN = /[一-龥]/;
    function cellText(r, c) { return String(r[c] === undefined || r[c] === null ? '' : r[c]).trim(); }
    // 纯中文姓名：2-6个汉字（允许中间有·）
    function looksLikeName(s) { return /^[一-龥·]{2,6}$/.test(s); }

    // ===== 1. 找姓名列 =====
    let nameColIdx = -1;
    if (isHeader) {
      // 严格匹配"姓名/名字"，避免误匹配"班级排名"中的"名"
      for (let c = 0; c < maxCol; c++) {
        const h = cellText(firstRow, c);
        if (/姓名|名字/.test(h) && !/学号|序号|编号|排名|名次|班级|小组/.test(h)) {
          nameColIdx = c; break;
        }
      }
    }
    if (nameColIdx === -1) {
      // 启发式：含中文姓名样的单元格占比最高的列
      let bestRatio = 0;
      for (let c = 0; c < maxCol; c++) {
        if (isHeader && /学号|序号|编号|排名|名次|班级|小组|备注/.test(cellText(firstRow, c))) continue;
        let total = 0, nameHits = 0, cnHits = 0;
        for (const r of dataRows) {
          const v = cellText(r, c);
          if (!v) continue;
          total++;
          if (looksLikeName(v)) nameHits++;
          if (RE_CN.test(v)) cnHits++;
        }
        if (total > 0) {
          // 优先"像姓名"的比例，其次任意中文比例
          const ratio = (nameHits * 2 + cnHits) / total;
          if (cnHits / total >= 0.5 && ratio > bestRatio) { bestRatio = ratio; nameColIdx = c; }
        }
      }
    }
    if (nameColIdx === -1) return { success: false, error: '未识别到姓名列，请确认表中包含"姓名"列' };

    // ===== 2. 找排序列：总分 > 成绩/分数 > 班级排名 > 其他排名 =====
    let sortColIdx = -1, sortMode = 'score', sortColName = '总分';
    function findHeaderCol(re) {
      if (!isHeader) return -1;
      for (let c = 0; c < maxCol; c++) {
        if (re.test(cellText(firstRow, c))) return c;
      }
      return -1;
    }
    let c1 = findHeaderCol(/总分|总成绩|合计|总评/);
    let c2 = findHeaderCol(/班级排名|班排名|班名次|班级名次/);
    let c3 = findHeaderCol(/年级排名|校排名|排名|名次/);
    let c4 = findHeaderCol(/成绩|分数|得分|score/i);
    if (c1 !== -1) { sortColIdx = c1; sortMode = 'score'; sortColName = cellText(firstRow, c1) || '总分'; }
    else if (c2 !== -1) { sortColIdx = c2; sortMode = 'rank'; sortColName = cellText(firstRow, c2) || '班级排名'; }
    else if (c3 !== -1) { sortColIdx = c3; sortMode = 'rank'; sortColName = cellText(firstRow, c3) || '排名'; }
    else if (c4 !== -1) { sortColIdx = c4; sortMode = 'score'; sortColName = cellText(firstRow, c4) || '成绩'; }

    if (sortColIdx === -1) {
      // 无表头：数字列中排除"学号/序号"特征列（近似1..M连续整数），取数字覆盖率最高的列
      const M = dataRows.length;
      let bestCount = 0;
      for (let c = 0; c < maxCol; c++) {
        if (c === nameColIdx) continue;
        const vals = [];
        for (const r of dataRows) {
          const v = cellText(r, c);
          if (v && RE_NUM.test(v)) vals.push(parseFloat(v));
        }
        if (vals.length === 0) continue;
        // 学号/排名特征：全为整数，最大值接近人数，值基本唯一
        const allInt = vals.every(v => Math.abs(v - Math.round(v)) < 1e-9);
        const uniq = new Set(vals).size;
        const looksLikeId = allInt && Math.max.apply(null, vals) <= M + 2 && uniq >= vals.length * 0.85;
        if (looksLikeId) continue;
        if (vals.length > bestCount) { bestCount = vals.length; sortColIdx = c; sortMode = 'score'; }
      }
      if (sortColIdx !== -1) sortColName = '成绩';
    }

    // ===== 3. 提取数据（过滤统计行：平均/合计/总计/小计/汇总等） =====
    const STATS_KEYWORDS = ['平均', '合计', '总计', '小计', '汇总', '平均分', '最高分', '最低分', '总分', '名次', '姓名', '名字'];
    const list = [];
    for (const r of dataRows) {
      const name = cellText(r, nameColIdx);
      if (!name) continue;
      // 过滤统计行：姓名中包含统计关键词，或姓名不是2-6个汉字
      if (STATS_KEYWORDS.some(k => name.indexOf(k) !== -1)) continue;
      if (!looksLikeName(name)) continue;
      let value = null;
      if (sortColIdx !== -1) {
        const sv = cellText(r, sortColIdx);
        if (sv && RE_NUM.test(sv)) value = parseFloat(sv);
      }
      // 未识别到成绩/排名列时 value 保持 null，避免把 0 分误当真实成绩
      list.push({ name, value });
    }
    if (list.length === 0) return { success: false, error: '未识别到有效数据' };
    return { success: true, list, mode: sortMode, sortColumn: sortColName, hasScoreColumn: sortColIdx !== -1 };
  } catch (e) {
    return { success: false, error: e.message };
  }
});


// ===== 班级段位系统 =====
// 段位规则：每进步5分=1星（或排名进步5名=1星），5星=1小段位，5小段位=1大段位
// 大段位：无段位 -> 学习新锐 -> 推断专家 -> 理解大师 -> 三班王牌 -> 一中传说(无上限)
// 小段位：Ⅴ Ⅳ Ⅲ Ⅱ Ⅰ
const RANK_MAJOR = ['无段位', '学习新锐', '推断专家', '理解大师', '三班王牌', '一中传说'];
const RANK_MINOR = ['Ⅴ', 'Ⅳ', 'Ⅲ', 'Ⅱ', 'Ⅰ'];
const RANK_STARS_PER_MINOR = 5;
const RANK_STARS_PER_MAJOR = 25; // 5小段位 * 5星
const RANK_LEGEND_THRESHOLD = 125; // 5个大段位 * 25星 = 125，超过即为一中传说

function loadRank() {
  ensureDataDir();
  if (!fs.existsSync(RANK_FILE)) {
    return { students: [], exams: [] };
  }
  try {
    const data = fs.readFileSync(RANK_FILE, 'utf-8').replace(/^\uFEFF/, '');
    const rank = JSON.parse(data);
    if (!Array.isArray(rank.students)) rank.students = [];
    if (!Array.isArray(rank.exams)) rank.exams = [];
    return rank;
  } catch (e) {
    return { students: [], exams: [] };
  }
}

function saveRank(rank) {
  ensureDataDir();
  fs.writeFileSync(RANK_FILE, JSON.stringify(rank, null, 2), 'utf-8');
}

// 根据累计星数计算段位信息
function calcRankInfo(totalStars) {
  if (totalStars <= 0) {
    return { major: 0, majorName: RANK_MAJOR[0], minor: 0, minorName: '', stars: 0, display: '无段位' };
  }
  if (totalStars <= RANK_LEGEND_THRESHOLD) {
    const majorIndex = Math.ceil(totalStars / RANK_STARS_PER_MAJOR);
    const starsInMajor = totalStars - (majorIndex - 1) * RANK_STARS_PER_MAJOR;
    const minorIndex = Math.ceil(starsInMajor / RANK_STARS_PER_MINOR) - 1;
    const stars = starsInMajor - minorIndex * RANK_STARS_PER_MINOR;
    return {
      major: majorIndex,
      majorName: RANK_MAJOR[majorIndex],
      minor: minorIndex,
      minorName: RANK_MINOR[minorIndex],
      stars: stars,
      display: RANK_MAJOR[majorIndex] + RANK_MINOR[minorIndex] + ' ' + stars + '星'
    };
  } else {
    // 一中传说：无星数上限，仍显示小段位和星数循环
    const starsInLegend = totalStars - RANK_LEGEND_THRESHOLD;
    const minorIndex = Math.floor((starsInLegend - 1) / RANK_STARS_PER_MINOR) % 5;
    const stars = ((starsInLegend - 1) % RANK_STARS_PER_MINOR) + 1;
    return {
      major: 5,
      majorName: RANK_MAJOR[5],
      minor: minorIndex,
      minorName: RANK_MINOR[minorIndex],
      stars: stars,
      display: '一中传说' + RANK_MINOR[minorIndex] + ' ' + stars + '星'
    };
  }
}

// 根据考试历史重新计算所有学生的累计星数
function recalcAllStars(rank) {
  // 按日期排序考试（同一天按录入顺序）
  const exams = rank.exams.map((e, i) => ({ e, i })).sort((a, b) => {
    const da = new Date(a.e.date).getTime();
    const db = new Date(b.e.date).getTime();
    if (da !== db) return da - db;
    return a.i - b.i;
  }).map(x => x.e);
  rank.students.forEach(stu => {
    let total = 0;
    let prevScore = null;
    let prevMode = null;
    for (const exam of exams) {
      const score = exam.scores[stu.id];
      if (score === undefined || score === null || score === '') continue;
      const s = parseFloat(score);
      if (isNaN(s)) continue;
      const mode = exam.mode === 'rank' ? 'rank' : 'score';
      // 只与上一次【同类型】成绩比较；分数卷与排名卷混用时本场作为新基准，不升段
      if (prevScore !== null && prevMode === mode) {
        if (mode === 'rank') {
          total += Math.round((prevScore - s) / 5); // 排名数字变小=进步，进步5名=1星
        } else {
          total += Math.round((s - prevScore) / 5);   // 每进步5分=1星，退步则掉星
        }
      }
      prevScore = s;
      prevMode = mode;
    }
    stu.totalStars = total;
    const info = calcRankInfo(total);
    stu.rankMajor = info.major;
    stu.rankMajorName = info.majorName;
    stu.rankMinor = info.minor;
    stu.rankMinorName = info.minorName;
    stu.rankStars = info.stars;
    stu.rankDisplay = info.display;
  });
  return rank;
}

ipcMain.handle('rank-get', () => {
  const rank = loadRank();
  recalcAllStars(rank);
  return rank;
});

ipcMain.handle('rank-save', (event, rank) => {
  recalcAllStars(rank);
  saveRank(rank);
  return rank;
});

ipcMain.handle('rank-reset', () => {
  const rank = { students: [], exams: [] };
  saveRank(rank);
  return rank;
});

// ===== 学生名单 / 值日表 / 作业登记 IPC（仅新增） =====
ipcMain.handle('roster-get', () => loadRoster());

ipcMain.handle('roster-save', (event, roster) => {
  try {
    return { success: true, roster: saveRoster(roster) };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('duty-get', () => loadDuty());

ipcMain.handle('duty-save', (event, duty) => {
  try {
    return { success: true, duty: saveDuty(duty) };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('homework-get', () => loadHomework());

ipcMain.handle('homework-save', (event, record) => {
  try {
    const data = loadHomework();
    const rec = {
      id: (record && record.id) || crypto.randomUUID(),
      date: String((record && record.date) || ''),
      subject: String((record && record.subject) || '').trim(),
      content: String((record && record.content) || '').trim(),
      missing: Array.isArray(record && record.missing) ? record.missing.map(n => String(n).trim()).filter(Boolean) : [],
      total: Number(record && record.total) || 0,
      created_at: (record && record.created_at) || new Date().toLocaleString('zh-CN', { hour12: false })
    };
    const idx = data.records.findIndex(r => r.id === rec.id);
    if (idx >= 0) data.records[idx] = rec; else data.records.unshift(rec);
    const saved = saveHomework(data);
    return { success: true, record: rec, records: saved.records };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('homework-delete', (event, id) => {
  try {
    const data = loadHomework();
    const before = data.records.length;
    data.records = data.records.filter(r => r.id !== id);
    if (data.records.length === before) return { success: false, error: '记录不存在' };
    const saved = saveHomework(data);
    return { success: true, records: saved.records };
  } catch (e) {
    return { success: false, error: e.message };
  }
});


let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    show: false,
    icon: path.join(__dirname, 'app_icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

    mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    // 启动后自动最大化（全屏显示）
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Windows 上关闭主窗口时强制退出应用，避免后台进程残留
  mainWindow.on('close', () => {
    if (process.platform !== 'darwin') {
      BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) win.destroy();
      });
      app.quit();
    }
  });
}


// ===== 卸载模式：需输入管理员密码 =====
const isUninstallMode = process.argv.includes('--uninstall');
if (isUninstallMode) {
  app.whenReady().then(() => {
    const { dialog } = require('electron');
    const fs = require('fs');
    const path = require('path');

    // 创建密码输入窗口
    const pwWin = new BrowserWindow({
      width: 380, height: 220,
      resizable: false, minimizable: false, maximizable: false,
      icon: path.join(__dirname, 'app_icon.ico'),
      webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    pwWin.setMenu(null);
    pwWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
      <html><head><meta charset="utf-8"><title>卸载验证</title>
      <style>body{font-family:"Microsoft YaHei",sans-serif;background:#f5f7fa;margin:0;padding:24px;}
      h2{color:#2c5f8d;margin:0 0 8px;text-align:center;font-size:18px;}
      p{color:#666;text-align:center;font-size:13px;margin:0 0 16px;}
      input{width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:15px;box-sizing:border-box;margin-bottom:12px;}
      button{width:100%;padding:10px;background:linear-gradient(135deg,#2c5f8d,#3498db);color:#fff;border:none;border-radius:6px;font-size:15px;cursor:pointer;}
      button:hover{opacity:0.9;}
      #err{color:#e74c3c;font-size:13px;text-align:center;margin-bottom:8px;min-height:18px;}
      </style></head><body>
      <h2>🔐 卸载验证</h2>
      <p>请输入管理员密码以卸载程序</p>
      <div id="err"></div>
      <input type="password" id="pwd" placeholder="输入管理员密码" maxlength="8" autofocus>
      <button onclick="check()">确认卸载</button>
      <script>
      const { ipcRenderer } = require('electron');
      document.getElementById('pwd').addEventListener('keydown', e => { if(e.key==='Enter') check(); });
      async function check(){
        const pwd = document.getElementById('pwd').value;
        if(!pwd){ document.getElementById('err').textContent='请输入密码'; return; }
        const ok = await ipcRenderer.invoke('verify-super-password', pwd);
        if(ok){ ipcRenderer.send('uninstall-confirm'); }
        else { document.getElementById('err').textContent='密码错误，请重试'; document.getElementById('pwd').value=''; document.getElementById('pwd').focus(); }
      }
      </script>
      </body></html>
    `));

    const { ipcMain } = require('electron');
    ipcMain.once('uninstall-confirm', () => {
      try {
        const appPath = path.dirname(process.execPath);
        // 删除桌面快捷方式
        const desktop = require('os').homedir() + '\\Desktop';
        ['班级服务管理系统.lnk', '卸载班级服务管理系统.lnk'].forEach(f => {
          const p = path.join(desktop, f);
          if (fs.existsSync(p)) fs.unlinkSync(p);
        });
        // 提示并退出（退出后由安装脚本清理文件）
        dialog.showMessageBox(pwWin, {
          type: 'info', title: '卸载成功',
          message: '验证通过！\n程序将开始卸载，请稍候...',
          buttons: ['确定']
        }).then(() => {
          pwWin.close();
          // 启动实际卸载（调用同目录 Uninstall.exe 或自删）
          const uninstExe = path.join(appPath, 'Uninstall.exe');
          if (fs.existsSync(uninstExe)) {
            require('child_process').exec('"' + uninstExe + '"', () => app.quit());
          } else {
            app.quit();
          }
        });
      } catch(e) {
        dialog.showErrorBox('卸载失败', e.message);
      }
    });
  });
} else {
  app.whenReady().then(() => {
    migrateOldData();
    createWindow();
    // 启动3秒后自动检查更新
    setTimeout(async () => {
      try {
        const result = await checkForUpdate();
        if (result.hasUpdate && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('update-available', result);
        }
      } catch (e) {
        // 静默失败，不打扰用户
      }
    }, 3000);
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    // 强制退出，确保进程不残留
    setTimeout(() => app.exit(0), 500);
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});










