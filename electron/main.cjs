const { app, BrowserWindow, dialog, ipcMain, nativeTheme, net, protocol, shell, session, systemPreferences } = require('electron');
const fs = require('node:fs/promises');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');

protocol.registerSchemesAsPrivileged([{
  scheme: 'revibe',
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true,
    stream: true
  }
}]);

const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg', '.oga', '.opus', '.wma', '.aiff', '.aif', '.ape', '.alac']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.m4v', '.mkv', '.webm', '.mov', '.avi', '.wmv', '.mpeg', '.mpg', '.3gp', '.ts', '.m2ts']);
const CHANNELS_API = 'https://iptv-org.github.io/api/channels.json';
const STREAMS_API = 'https://iptv-org.github.io/api/streams.json';
let mainWindow = null;
let tvCacheMemory = null;
let tvCacheAt = 0;
let musicMetadataModule = null;
let mediaDiscoveryEnabled = false;
let storageWatchTimer = null;
let storageRefreshPromise = null;
let currentExternalStorages = [];
let externalStorageFingerprint = '';
let discoveryRendererReady = false;
let pendingDiscoveredMedia = [];
let openMediaRendererReady = false;
let pendingAssociatedMediaFiles = collectAssociatedMediaFiles(process.argv.slice(1));
const scannedExternalStorageIds = new Set();

function collectAssociatedMediaFiles(args) {
  const files = [];
  const seen = new Set();
  for (const rawArgument of Array.isArray(args) ? args : []) {
    if (typeof rawArgument !== 'string') continue;
    const candidate = rawArgument.trim().replace(/^"(.*)"$/, '$1');
    if (!path.isAbsolute(candidate) && !path.win32.isAbsolute(candidate)) continue;
    const extension = path.extname(candidate).toLowerCase();
    const type = AUDIO_EXTENSIONS.has(extension) ? 'music' : VIDEO_EXTENSIONS.has(extension) ? 'video' : '';
    if (!type) continue;
    const filePath = path.isAbsolute(candidate) ? path.normalize(candidate) : path.win32.normalize(candidate);
    const key = filePath.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    files.push({ path: filePath, type });
  }
  return files;
}

function flushPendingAssociatedMediaFiles() {
  const contents = mainWindow?.webContents;
  if (!openMediaRendererReady || !contents || contents.isDestroyed() || contents.isLoading() || !pendingAssociatedMediaFiles.length) return;
  const files = pendingAssociatedMediaFiles.splice(0);
  contents.send('media:open-request', files);
}

function queueAssociatedMediaFiles(args) {
  const seen = new Set(pendingAssociatedMediaFiles.map(({ path: filePath }) => filePath.toLowerCase()));
  for (const file of collectAssociatedMediaFiles(args)) {
    const key = file.path.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      pendingAssociatedMediaFiles.push(file);
    }
  }
  flushPendingAssociatedMediaFiles();
}
const sidecarDirectoryCache = new Map();
const embeddedArtworkCache = new Map();

function userDataPath(name) {
  return path.join(app.getPath('userData'), name);
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function readSettings() {
  const value = await readJson(userDataPath('preferences.json'), {});
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

async function saveSettings(patch) {
  const current = await readSettings();
  const safePatch = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {};
  const allowed = ['theme', 'accent', 'visualizerIntensity', 'defaultMusicFolder', 'defaultVideoFolder', 'volume', 'lastPage', 'mediaDiscoveryEnabled', 'visualizerStyle', 'lowGraphicsMode', 'equalizerEnabled', 'equalizerPreset', 'crossfadeEnabled', 'crossfadeSeconds', 'reverbEnabled', 'reverbAmount'];
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(safePatch, key)) current[key] = safePatch[key];
  }
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(userDataPath('preferences.json'), JSON.stringify(current, null, 2), 'utf8');
  if (Object.prototype.hasOwnProperty.call(safePatch, 'mediaDiscoveryEnabled')) configureMediaDiscovery(current.mediaDiscoveryEnabled === true);
  return current;
}

function normalizeAccentHex(value) {
  const clean = String(value ?? '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(clean)) return `#${clean.slice(0, 6)}`;
  const rgb = clean.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) return `#${rgb.slice(1, 4).map((part) => Math.max(0, Math.min(255, Number(part))).toString(16).padStart(2, '0')).join('')}`;
  return null;
}

function windowsAccentDwordToHex(rawValue, byteOrder = 'aabbggrr') {
  const value = Number.parseInt(String(rawValue).replace(/^0x/i, ''), 16);
  if (!Number.isFinite(value)) return null;
  const word = value >>> 0;
  const red = byteOrder === 'aarrggbb' ? (word >>> 16) & 0xff : word & 0xff;
  const green = (word >>> 8) & 0xff;
  const blue = byteOrder === 'aarrggbb' ? word & 0xff : (word >>> 16) & 0xff;
  return `#${[red, green, blue].map((part) => part.toString(16).padStart(2, '0')).join('')}`;
}

async function readRegistryDword(key, valueName) {
  try {
    const { stdout } = await execFileAsync('reg.exe', ['query', key, '/v', valueName], { windowsHide: true, timeout: 2500 });
    const escapedName = valueName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = stdout.match(new RegExp(`${escapedName}\\s+REG_DWORD\\s+0x([0-9a-f]+)`, 'i'));
    return match?.[1] || null;
  } catch { return null; }
}

async function getSystemAccentColor() {
  if (process.platform === 'win32') {
    const dwmKey = 'HKCU\\Software\\Microsoft\\Windows\\DWM';
    const accent = await readRegistryDword(dwmKey, 'AccentColor');
    if (accent) return windowsAccentDwordToHex(accent, 'aabbggrr');
    const explorerAccent = await readRegistryDword('HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Accent', 'AccentColorMenu');
    if (explorerAccent) return windowsAccentDwordToHex(explorerAccent, 'aabbggrr');
    const colorization = await readRegistryDword(dwmKey, 'ColorizationColor');
    if (colorization) return windowsAccentDwordToHex(colorization, 'aarrggbb');
  }
  try {
    if (typeof systemPreferences.getAccentColor === 'function') {
      const accent = normalizeAccentHex(systemPreferences.getAccentColor());
      if (accent) return accent;
    }
  } catch { /* this API is not implemented on every platform */ }
  if (process.platform !== 'win32') {
    try {
      if (typeof systemPreferences.getColor === 'function') {
        const highlight = normalizeAccentHex(systemPreferences.getColor('highlight'));
        if (highlight) return highlight;
      }
    } catch { /* use renderer fallback if no native accent is exposed */ }
  }
  return null;
}

let systemAccentRefreshTimer = null;
function watchSystemAccentChanges() {
  if (typeof systemPreferences.on !== 'function') return;
  systemPreferences.on('accent-color-changed', (_event, eventColor) => {
    clearTimeout(systemAccentRefreshTimer);
    systemAccentRefreshTimer = setTimeout(async () => {
      const color = await getSystemAccentColor().catch(() => null) || normalizeAccentHex(eventColor);
      if (color && mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('system:accent-color-changed', color);
    }, 100);
  });
}

function mediaItem(filePath, kind, stat) {
  const ext = path.extname(filePath).toLowerCase();
  const type = kind === 'music' ? 'music' : 'video';
  const base = path.basename(filePath, ext);
  return {
    id: crypto.createHash('sha1').update(filePath).digest('hex'),
    title: base.replace(/[._]+/g, ' ').trim() || base,
    artist: path.basename(path.dirname(filePath)),
    type,
    path: filePath,
    url: pathToFileURL(filePath).href,
    extension: ext.replace('.', '').toUpperCase(),
    size: stat.size,
    modified: stat.mtimeMs
  };
}

async function scanMediaFolder(folder, kind) {
  if (typeof folder !== 'string' || !path.isAbsolute(folder)) return [];
  const extensions = kind === 'music' ? AUDIO_EXTENSIONS : VIDEO_EXTENSIONS;
  const results = [];
  const MAX_FILES = 5000;
  const MAX_DEPTH = 7;

  async function walk(directory, depth) {
    if (depth > MAX_DEPTH || results.length >= MAX_FILES) return;
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    for (const entry of entries) {
      if (results.length >= MAX_FILES || entry.name.startsWith('.')) continue;
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath, depth + 1);
      } else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) {
        try {
          const stat = await fs.stat(fullPath);
          results.push(mediaItem(fullPath, kind, stat));
        } catch {
          // Ignore a file that disappeared while the library was being scanned.
        }
      }
    }
  }

  try {
    const root = await fs.stat(folder);
    if (!root.isDirectory()) return [];
    await walk(folder, 0);
  } catch {
    return [];
  }

  results.sort((a, b) => b.modified - a.modified);
  return results;
}

async function refreshSelectedFolder(folder, kind) {
  if (typeof folder !== 'string' || !folder || !path.isAbsolute(folder)) {
    return { ok: false, error: `Choose a default ${kind === 'video' ? 'video' : 'music'} folder first.` };
  }
  try {
    const stat = await fs.stat(folder);
    if (!stat.isDirectory()) return { ok: false, error: 'The selected path is no longer a folder.' };
    await fs.readdir(folder);
  } catch (error) {
    return { ok: false, error: `The selected folder is unavailable: ${error?.message || error}` };
  }
  const safeKind = kind === 'video' ? 'video' : 'music';
  return { ok: true, files: await scanMediaFolder(folder, safeKind) };
}

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
const ARTWORK_TYPES = new Map([['image/jpeg','.jpg'],['image/png','.png'],['image/webp','.webp'],['image/gif','.gif'],['image/avif','.avif']]);
const EXTERNAL_STORAGE_QUERY = [
  "$ErrorActionPreference = 'SilentlyContinue'",
  "$found = @{}",
  "foreach ($d in @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=2')) { $root = ([string]$d.DeviceID + [char]92); $label = [string]$d.VolumeName; if (!$label) { $label = 'Removable storage' }; $found[$root] = [PSCustomObject]@{ id = ([string]$d.DeviceID + ':' + [string]$d.VolumeSerialNumber); root = $root; name = $label; kind = 'Removable drive'; size = [int64]$d.Size; free = [int64]$d.FreeSpace } }",
  "try { foreach ($disk in @(Get-Disk | Where-Object { $_.BusType.ToString() -eq 'USB' })) { foreach ($partition in @(Get-Partition -DiskNumber $disk.Number -ErrorAction SilentlyContinue)) { $volume = Get-Volume -Partition $partition -ErrorAction SilentlyContinue | Select-Object -First 1; if ($volume -and $volume.DriveLetter) { $letter = [string]$volume.DriveLetter + ':'; $root = $letter + [char]92; $label = [string]$volume.FileSystemLabel; if (!$label) { $label = 'USB storage' }; $found[$root] = [PSCustomObject]@{ id = ($root + '|' + [string]$volume.UniqueId); root = $root; name = $label; kind = 'USB drive'; size = [int64]$volume.Size; free = [int64]$volume.SizeRemaining } } } } } catch {}",
  "$found.Values | Sort-Object Root | ConvertTo-Json -Depth 3 -Compress"
].join('; ');

async function enumerateExternalStorages() {
  if (process.platform !== 'win32') return [];
  try {
    const { stdout } = await execFileAsync('powershell.exe', ['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',EXTERNAL_STORAGE_QUERY], { windowsHide: true, timeout: 12000, maxBuffer: 1024 * 1024 });
    const output = String(stdout || '').trim();
    if (!output || output === 'null') return [];
    const parsed = JSON.parse(output);
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows.filter((row) => row && /^[A-Z]:\\$/i.test(String(row.root || ''))).map((row) => ({
      id: String(row.id || row.root),
      root: String(row.root),
      name: String(row.name || 'External storage'),
      kind: String(row.kind || 'External drive'),
      size: Number(row.size) || 0,
      free: Number(row.free) || 0
    }));
  } catch { return []; }
}

async function refreshExternalStorages(forceSend = false) {
  if (storageRefreshPromise) return storageRefreshPromise;
  storageRefreshPromise = (async () => {
    const volumes = await enumerateExternalStorages();
    currentExternalStorages = volumes;
    const signature = JSON.stringify(volumes);
    if ((forceSend || signature !== externalStorageFingerprint) && mainWindow && !mainWindow.isDestroyed()) {
      externalStorageFingerprint = signature;
      try { mainWindow.webContents.send('storage:volumes', volumes); } catch { /* renderer may be closing */ }
    } else if (signature !== externalStorageFingerprint) {
      externalStorageFingerprint = signature;
    }
    const connectedIds = new Set(volumes.map((volume) => volume.id));
    for (const id of scannedExternalStorageIds) if (!connectedIds.has(id)) scannedExternalStorageIds.delete(id);
    if (mediaDiscoveryEnabled) {
      for (const volume of volumes) {
        if (scannedExternalStorageIds.has(volume.id)) continue;
        scannedExternalStorageIds.add(volume.id);
        void scanExternalVolume(volume);
      }
    }
    return volumes;
  })().finally(() => { storageRefreshPromise = null; });
  return storageRefreshPromise;
}

function flushPendingDiscoveredMedia() {
  if (!discoveryRendererReady || !mainWindow || mainWindow.isDestroyed()) return;
  if (!mediaDiscoveryEnabled) { pendingDiscoveredMedia = []; return; }
  for (const payload of pendingDiscoveredMedia) {
    try { mainWindow.webContents.send('storage:discovered-media', payload); } catch { /* renderer may be closing */ }
  }
  pendingDiscoveredMedia = [];
}

async function scanExternalVolume(volume) {
  try {
    const [music, videos] = await Promise.all([scanMediaFolder(volume.root, 'music'), scanMediaFolder(volume.root, 'video')]);
    if (!mediaDiscoveryEnabled || !currentExternalStorages.some((item) => item.id === volume.id)) return;
    const payload = { volume, music, videos };
    if (!discoveryRendererReady || !mainWindow || mainWindow.isDestroyed()) pendingDiscoveredMedia.push(payload);
    else mainWindow.webContents.send('storage:discovered-media', payload);
  } catch { /* A removed or locked external volume is simply skipped. */ }
}

function configureMediaDiscovery(enabled) {
  const next = Boolean(enabled);
  if (next === mediaDiscoveryEnabled) return;
  mediaDiscoveryEnabled = next;
  if (!next) pendingDiscoveredMedia = [];
  scannedExternalStorageIds.clear();
  if (next) void refreshExternalStorages(true);
}

function startExternalStorageWatcher() {
  if (storageWatchTimer || process.platform !== 'win32') return;
  void refreshExternalStorages(true);
  storageWatchTimer = setInterval(() => { void refreshExternalStorages(false); }, 5000);
  storageWatchTimer.unref?.();
}

async function imageDirectoryMap(directory) {
  if (sidecarDirectoryCache.has(directory)) return sidecarDirectoryCache.get(directory);
  const pending = fs.readdir(directory, { withFileTypes: true }).then((entries) => {
    const images = new Map();
    for (const entry of entries) {
      if (!entry.isFile() || !IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      images.set(entry.name.toLowerCase(), path.join(directory, entry.name));
    }
    return images;
  }).catch(() => new Map());
  sidecarDirectoryCache.set(directory, pending);
  if (sidecarDirectoryCache.size > 256) sidecarDirectoryCache.delete(sidecarDirectoryCache.keys().next().value);
  return pending;
}

async function findSidecarArtwork(filePath) {
  const directory = path.dirname(filePath);
  const mediaBase = path.basename(filePath, path.extname(filePath)).toLowerCase();
  const images = await imageDirectoryMap(directory);
  const names = [mediaBase, 'cover', 'folder', 'front', 'albumart', 'album', 'artwork', 'poster', 'thumbnail', 'thumb'];
  for (const base of names) {
    for (const extension of IMAGE_EXTENSIONS) {
      const found = images.get(`${base}${extension}`);
      if (found) return pathToFileURL(found).href;
    }
  }
  return '';
}

async function getEmbeddedArtwork(filePath) {
  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat?.isFile() || stat.size > 1024 * 1024 * 1024) return '';
  const cacheKey = `${filePath}:${stat.size}:${stat.mtimeMs}`;
  if (embeddedArtworkCache.has(cacheKey)) return embeddedArtworkCache.get(cacheKey) || '';
  try {
    musicMetadataModule ||= import('music-metadata');
    const { parseFile } = await musicMetadataModule;
    const metadata = await parseFile(filePath, { skipCovers: false });
    const picture = metadata.common?.picture?.[0];
    const bytes = picture?.data ? Buffer.from(picture.data) : null;
    const extension = ARTWORK_TYPES.get(String(picture?.format || '').toLowerCase());
    if (!bytes?.length || bytes.length > 5 * 1024 * 1024 || !extension) {
      embeddedArtworkCache.set(cacheKey, '');
      return '';
    }
    const filename = `${crypto.createHash('sha1').update(filePath).update(bytes).digest('hex')}${extension}`;
    const cacheDirectory = userDataPath('artwork-cache');
    await fs.mkdir(cacheDirectory, { recursive: true });
    const cachePath = path.join(cacheDirectory, filename);
    await fs.writeFile(cachePath, bytes).catch(async (error) => {
      if (error?.code !== 'EEXIST') throw error;
    });
    const url = `revibe://artwork/${filename}`;
    embeddedArtworkCache.set(cacheKey, url);
    return url;
  } catch {
    embeddedArtworkCache.set(cacheKey, '');
    return '';
  }
}

async function getMediaArtwork(filePath, kind) {
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) return '';
  const local = await findSidecarArtwork(filePath);
  if (local) return local;
  if (kind !== 'music' || !AUDIO_EXTENSIONS.has(path.extname(filePath).toLowerCase())) return '';
  return getEmbeddedArtwork(filePath);
}

function normalizeLookupText(value) {
  return String(value || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
}

async function searchArtwork(item) {
  if (!item || typeof item !== 'object') return '';
  const title = String(item.title || item.name || '').trim();
  if (!title) return '';
  if (item.type === 'tv') {
    try {
      const request = new URL('https://en.wikipedia.org/w/api.php');
      request.searchParams.set('action','query');
      request.searchParams.set('generator','search');
      request.searchParams.set('gsrsearch', `${title} television channel`);
      request.searchParams.set('gsrnamespace','0');
      request.searchParams.set('gsrlimit','5');
      request.searchParams.set('prop','pageimages');
      request.searchParams.set('piprop','thumbnail');
      request.searchParams.set('pithumbsize','320');
      request.searchParams.set('format','json');
      const result = await fetchJson(request.href, 9000);
      const pages = Object.values(result?.query?.pages || {});
      const target = normalizeLookupText(title);
      const matched = pages.filter((page) => {
        const candidate = normalizeLookupText(page.title);
        return page.thumbnail?.source && candidate && (candidate.includes(target) || target.includes(candidate));
      });
      matched.sort((a, b) => Number(normalizeLookupText(b.title) === target) - Number(normalizeLookupText(a.title) === target));
      return matched[0]?.thumbnail?.source || '';
    } catch { return ''; }
  }

  const entity = item.type === 'video' ? 'movie' : 'song';
  const term = [title, item.artist].filter((part) => part && !['Local library','Unknown Artist'].includes(part)).join(' ');
  if (!term) return '';
  try {
    const request = new URL('https://itunes.apple.com/search');
    request.searchParams.set('term', term);
    request.searchParams.set('entity', entity);
    request.searchParams.set('limit', '8');
    const result = await fetchJson(request.href, 9000);
    const targetTitle = normalizeLookupText(title);
    const targetArtist = normalizeLookupText(item.artist || '');
    const matches = (result.results || []).filter((entry) => entry.artworkUrl100 || entry.artworkUrl60).map((entry) => {
      const candidateTitle = normalizeLookupText(entry.trackName || entry.collectionName || entry.trackCensoredName);
      const candidateArtist = normalizeLookupText(entry.artistName || '');
      let score = candidateTitle === targetTitle ? 10 : candidateTitle.includes(targetTitle) || targetTitle.includes(candidateTitle) ? 5 : 0;
      if (targetArtist && candidateArtist && (candidateArtist.includes(targetArtist) || targetArtist.includes(candidateArtist))) score += 3;
      return { entry, score };
    }).sort((a, b) => b.score - a.score);
    const best = matches[0];
    if (!best || best.score < 5) return '';
    const chosen = best.entry;
    return String(chosen.artworkUrl600 || chosen.artworkUrl100 || chosen.artworkUrl60 || '').replace(/\d+x\d+bb/i, '600x600bb');
  } catch { return ''; }
}

async function chooseFolder(kind, defaultPath) {
  const title = kind === 'music' ? 'Choose your music folder' : 'Choose your videos folder';
  const options = { title, properties: ['openDirectory', 'dontAddToRecent'] };
  if (typeof defaultPath === 'string' && defaultPath && path.isAbsolute(defaultPath)) options.defaultPath = defaultPath;
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled || !result.filePaths.length) return null;
  const folder = result.filePaths[0];
  const files = await scanMediaFolder(folder, kind);
  return { folder, files };
}

async function chooseFiles(kind) {
  const filters = kind === 'music'
    ? [{ name: 'Audio', extensions: ['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'opus', 'wma', 'aiff', 'ape'] }]
    : [{ name: 'Video', extensions: ['mp4', 'm4v', 'mkv', 'webm', 'mov', 'avi', 'wmv', 'mpeg', 'mpg', '3gp', 'ts', 'm2ts'] }];
  const options = { title: kind === 'music' ? 'Add music files' : 'Add video files', properties: ['openFile', 'multiSelections', 'dontAddToRecent'], filters };
  const result = mainWindow ? await dialog.showOpenDialog(mainWindow, options) : await dialog.showOpenDialog(options);
  if (result.canceled) return [];
  const extensions = kind === 'music' ? AUDIO_EXTENSIONS : VIDEO_EXTENSIONS;
  const items = [];
  for (const filePath of result.filePaths) {
    if (!extensions.has(path.extname(filePath).toLowerCase())) continue;
    try { items.push(mediaItem(filePath, kind, await fs.stat(filePath))); } catch { /* ignore inaccessible files */ }
  }
  return items;
}

function proxyUrlFor(target, referrer, userAgent) {
  const query = new URLSearchParams({ url: target });
  if (referrer) query.set('ref', referrer);
  if (userAgent) query.set('ua', userAgent);
  return `revibe://proxy/?${query.toString()}`;
}

function corsHeaders(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, Origin, Accept, Content-Type, User-Agent, Referer',
    'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Length, Content-Range, Content-Type',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    ...extra
  };
}

function isPlaylist(contentType, url, text) {
  return /mpegurl|vnd\.apple\.mpegurl/i.test(contentType || '') || /\.m3u8?(?:$|[?#])/i.test(url) || /^\s*#EXTM3U/m.test(text || '');
}

function rewritePlaylist(text, baseUrl, referrer, userAgent) {
  return text.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (trimmed.startsWith('#')) {
      return line.replace(/URI="([^"]+)"/gi, (_match, rawUri) => {
        try {
          const absolute = new URL(rawUri, baseUrl).href;
          return `URI="${proxyUrlFor(absolute, referrer, userAgent)}"`;
        } catch {
          return _match;
        }
      });
    }
    try {
      return proxyUrlFor(new URL(trimmed, baseUrl).href, referrer, userAgent);
    } catch {
      return line;
    }
  }).join('\n');
}

async function handleRevibeProtocol(request) {
  const url = new URL(request.url);
  if (url.hostname === 'artwork') {
    const filename = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
    if (!/^[a-f0-9]{40}[.](jpg|png|webp|gif|avif)$/i.test(filename)) return new Response('Not found', { status: 404, headers: corsHeaders() });
    try {
      const image = await fs.readFile(path.join(userDataPath('artwork-cache'), filename));
      const extension = path.extname(filename).toLowerCase();
      const mime = extension === '.jpg' ? 'image/jpeg' : `image/${extension.slice(1)}`;
      return new Response(request.method === 'HEAD' ? null : image, { status: 200, headers: corsHeaders({ 'Content-Type': mime, 'Cache-Control': 'public, max-age=31536000, immutable' }) });
    } catch { return new Response('Not found', { status: 404, headers: corsHeaders() }); }
  }
  if (url.hostname !== 'proxy') return new Response('Not found', { status: 404, headers: corsHeaders() });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });
  const remoteUrl = url.searchParams.get('url');
  if (!remoteUrl) return new Response('Missing stream URL', { status: 400, headers: corsHeaders() });

  let target;
  try { target = new URL(remoteUrl); } catch { return new Response('Invalid stream URL', { status: 400, headers: corsHeaders() }); }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    return new Response('Only HTTP and HTTPS streams are supported', { status: 400, headers: corsHeaders() });
  }

  const requestHeaders = new Headers();
  const referrer = url.searchParams.get('ref');
  const userAgent = url.searchParams.get('ua');
  if (referrer) requestHeaders.set('Referer', referrer);
  if (userAgent) requestHeaders.set('User-Agent', userAgent);
  const range = request.headers.get('range');
  if (range) requestHeaders.set('Range', range);
  const accept = request.headers.get('accept');
  if (accept) requestHeaders.set('Accept', accept);

  try {
    const upstream = await net.fetch(target.href, { method: request.method === 'HEAD' ? 'HEAD' : 'GET', headers: requestHeaders });
    const upstreamType = upstream.headers.get('content-type') || '';
    const finalUrl = upstream.url || target.href;
    const common = corsHeaders({
      'Cache-Control': 'no-store',
      'Content-Type': upstreamType || 'application/octet-stream'
    });
    for (const name of ['accept-ranges', 'content-length', 'content-range', 'last-modified', 'etag']) {
      const value = upstream.headers.get(name);
      if (value) common[name] = value;
    }

    if (!upstream.ok && upstream.status !== 206) {
      const body = await upstream.text().catch(() => 'The channel is offline or rejected the request.');
      return new Response(body.slice(0, 2000), { status: upstream.status || 502, headers: common });
    }

    if (request.method !== 'HEAD' && (isPlaylist(upstreamType, finalUrl, '') || /\.m3u8?(?:$|[?#])/i.test(target.href))) {
      const playlistText = await upstream.text();
      if (isPlaylist(upstreamType, finalUrl, playlistText)) {
        const rewritten = rewritePlaylist(playlistText, finalUrl, referrer, userAgent);
        common['Content-Type'] = 'application/vnd.apple.mpegurl; charset=utf-8';
        delete common['content-length'];
        delete common['content-range'];
        return new Response(rewritten, { status: upstream.status, headers: common });
      }
      return new Response(playlistText, { status: upstream.status, headers: common });
    }
    return new Response(upstream.body, { status: upstream.status, headers: common });
  } catch (error) {
    return new Response(`Stream proxy error: ${String(error?.message || error)}`, { status: 502, headers: corsHeaders({ 'Content-Type': 'text/plain; charset=utf-8' }) });
  }
}

async function fetchJson(url, timeoutMs = 25000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json', 'User-Agent': `RevibeMediaCentre/${app.getVersion()}` },
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`Catalog returned HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeCatalog(channelsData, streamsData) {
  const channels = Array.isArray(channelsData) ? channelsData : [];
  const streams = Array.isArray(streamsData) ? streamsData : [];
  const channelsById = new Map(channels.filter((channel) => channel && channel.id).map((channel) => [channel.id, channel]));
  const grouped = new Map();

  for (const stream of streams) {
    if (!stream || typeof stream.url !== 'string' || !stream.channel) continue;
    let streamUrl;
    try { streamUrl = new URL(stream.url); } catch { continue; }
    if (streamUrl.protocol !== 'https:' && streamUrl.protocol !== 'http:') continue;
    const channel = channelsById.get(stream.channel);
    if (!channel || channel.is_nsfw || !channel.name) continue;
    const bucket = grouped.get(channel.id) || [];
    if (bucket.length < 3 && !bucket.some((entry) => entry.url === streamUrl.href)) {
      bucket.push({ url: streamUrl.href, referrer: stream.http_referrer || '', userAgent: stream.user_agent || '' });
      grouped.set(channel.id, bucket);
    }
  }

  const result = [];
  for (const [id, sources] of grouped) {
    const channel = channelsById.get(id);
    if (!sources.length) continue;
    const logo = typeof channel.logo === 'string' && /^https?:\/\//i.test(channel.logo) ? channel.logo : '';
    const category = Array.isArray(channel.categories) && channel.categories.length ? channel.categories[0] : 'general';
    result.push({
      id,
      name: String(channel.name).slice(0, 110),
      country: channel.country || '',
      logo,
      category: String(category).replace(/_/g, ' '),
      languages: Array.isArray(channel.languages) ? channel.languages.slice(0, 2) : [],
      streams: sources
    });
  }

  const categoryRank = (category) => ({ news: 0, sports: 1, entertainment: 2, general: 3, music: 4, education: 5, culture: 6 }[category] ?? 8);
  result.sort((a, b) => {
    const local = Number(b.country === 'PH') - Number(a.country === 'PH');
    if (local) return local;
    const rank = categoryRank(a.category) - categoryRank(b.category);
    return rank || a.name.localeCompare(b.name);
  });
  return result.slice(0, 240);
}

async function getCatalog(force = false) {
  const now = Date.now();
  if (!force && tvCacheMemory && now - tvCacheAt < 8 * 60 * 1000) {
    return { ...tvCacheMemory, cached: true, stale: false };
  }

  try {
    const [channels, streams] = await Promise.all([fetchJson(CHANNELS_API), fetchJson(STREAMS_API)]);
    const normalized = normalizeCatalog(channels, streams);
    const catalog = { channels: normalized, fetchedAt: Date.now(), source: 'IPTV-Org', stale: false };
    tvCacheMemory = catalog;
    tvCacheAt = Date.now();
    await fs.mkdir(app.getPath('userData'), { recursive: true });
    await fs.writeFile(userDataPath('open-tv-cache.json'), JSON.stringify(catalog), 'utf8').catch(() => {});
    return { ...catalog, cached: false };
  } catch (error) {
    const disk = await readJson(userDataPath('open-tv-cache.json'), null);
    if (disk && Array.isArray(disk.channels) && disk.channels.length) {
      tvCacheMemory = disk;
      tvCacheAt = Number(disk.fetchedAt) || 0;
      return { ...disk, cached: true, stale: true, error: String(error?.message || error) };
    }
    const fallback = await readJson(path.join(app.getAppPath(), 'assets', 'tv-fallback.json'), { channels: [] });
    const channels = Array.isArray(fallback) ? fallback : (Array.isArray(fallback.channels) ? fallback.channels : []);
    return { channels, fetchedAt: 0, source: 'IPTV-Org cached starter guide', cached: true, stale: true, error: String(error?.message || error) };
  }
}

async function clearApplicationCaches() {
  try { await session.defaultSession.clearCache(); } catch { /* cache may not be initialized yet */ }
  let foldersReset = false;
  try {
    await saveSettings({ defaultMusicFolder: '', defaultVideoFolder: '' });
    foldersReset = true;
  } catch { /* report a failed settings reset without risking any media files */ }
  const root = path.resolve(app.getPath('userData'));
  const cacheNames = ['Cache', 'Code Cache', 'GPUCache', 'DawnCache', 'GrShaderCache', 'DawnWebGPUCache', 'tmp'];
  let removed = 0;
  for (const name of cacheNames) {
    const target = path.resolve(root, name);
    if (path.dirname(target) !== root) continue;
    try {
      await fs.rm(target, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 });
      removed += 1;
    } catch { /* some cache files may be locked; Chromium recreates these */ }
  }
  return { ok: true, removed, foldersReset, note: 'Application cache cleared. Media files were not touched.' };
}

function getDwmCapabilities() {
  const build = process.platform === 'win32' ? Number(os.release().split('.')[2] || 0) : 0;
  let dwmEnabled = false;
  if (process.platform === 'win32') {
    try {
      const aeroGlassProbe = typeof systemPreferences.isAeroGlassEnabled === 'function'
        ? Boolean(systemPreferences.isAeroGlassEnabled())
        : false;
      // DWM composition is always on for supported Windows 10/11 builds, even
      // when the older Aero-glass compatibility probe reports otherwise.
      dwmEnabled = build >= 10240 || aeroGlassProbe;
    } catch { dwmEnabled = build >= 10240; }
  }
  // Windows 11 has DWM corner support on build 22000+, regardless of the
  // legacy Aero-glass probe (which can report false on newer Windows builds).
  const supportsRoundedCorners = process.platform === 'win32' && build >= 22000;
  // Use a tiny CSS radius for a nearly square silhouette. Opt out of the
  // larger Windows 11 native curve so it cannot mismatch the renderer edge.
  const windowCornerStyle = process.platform === 'win32' ? 'rounded' : 'square';
  return {
    platform: process.platform,
    windowsBuild: build,
    dwmEnabled,
    supportsRoundedCorners,
    supportsBackdropMaterial: process.platform === 'win32' && dwmEnabled && build >= 22621,
    windowCornerStyle
  };
}

function materialForMode(mode, capabilities = getDwmCapabilities()) {
  if (!capabilities.supportsBackdropMaterial) return 'auto';
  return mode === 'dark' ? 'acrylic' : 'mica';
}

function setWindowMaterial(win, mode) {
  if (!win) return false;
  const capabilities = getDwmCapabilities();
  const safeMode = mode === 'dark' ? 'dark' : 'light';
  const isTransparent = process.platform !== 'win32' || capabilities.dwmEnabled;
  try {
    win.setBackgroundColor(isTransparent ? '#00000000' : (safeMode === 'dark' ? '#161719' : '#f7fbf9'));
    if (typeof win.setBackgroundMaterial === 'function') win.setBackgroundMaterial(materialForMode(safeMode, capabilities));
    return capabilities.supportsBackdropMaterial;
  } catch { return false; }
}

async function createWindow() {
  const savedSettings = await readSettings();
  discoveryRendererReady = false;
  mediaDiscoveryEnabled = savedSettings.mediaDiscoveryEnabled === true;
  const dwm = getDwmCapabilities();
  const startMode = ['dark', 'light'].includes(savedSettings.theme) ? savedSettings.theme : (nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
  const transparent = process.platform !== 'win32' || dwm.dwmEnabled;
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 920,
    minHeight: 620,
    show: false,
    frame: false,
    transparent,
    backgroundColor: transparent ? '#00000000' : (startMode === 'dark' ? '#161719' : '#f7fbf9'),
    backgroundMaterial: materialForMode(startMode, dwm),
    roundedCorners: false,
    autoHideMenuBar: true,
    title: 'Revibe Media Centre',
    icon: path.join(__dirname, '..', 'assets', 'app-icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    }
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.webContents.on('did-start-loading', () => { openMediaRendererReady = false; });
  mainWindow.webContents.on('did-finish-load', flushPendingAssociatedMediaFiles);
  mainWindow.on('maximize', () => mainWindow?.webContents.send('window:state', true));
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window:state', false));
  mainWindow.on('closed', () => { mainWindow = null; discoveryRendererReady = false; openMediaRendererReady = false; });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) event.preventDefault();
  });
  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  startExternalStorageWatcher();
}

ipcMain.on('media:open-ready', (event) => {
  if (event.sender !== mainWindow?.webContents) return;
  openMediaRendererReady = true;
  flushPendingAssociatedMediaFiles();
});

ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:platform', () => process.platform);
ipcMain.handle('app:theme', () => ({ shouldUseDarkColors: nativeTheme.shouldUseDarkColors }));
ipcMain.handle('system:accent-color', getSystemAccentColor);
ipcMain.handle('window:appearance', () => getDwmCapabilities());
ipcMain.handle('window:set-material', (event, mode) => setWindowMaterial(BrowserWindow.fromWebContents(event.sender), mode));
ipcMain.handle('settings:read', readSettings);
ipcMain.handle('settings:save', (_event, patch) => saveSettings(patch));
ipcMain.handle('storage:list', async () => {
  const volumes = await refreshExternalStorages(true);
  discoveryRendererReady = true;
  flushPendingDiscoveredMedia();
  return volumes;
});
ipcMain.handle('storage:rescan', async () => {
  scannedExternalStorageIds.clear();
  return refreshExternalStorages(true);
});
ipcMain.handle('media:get-artwork', (_event, filePath, kind) => getMediaArtwork(filePath, kind));
ipcMain.handle('artwork:search', (_event, item) => searchArtwork(item));
ipcMain.handle('folder:choose', (_event, kind, defaultPath) => chooseFolder(kind === 'video' ? 'video' : 'music', defaultPath));
ipcMain.handle('folder:scan', (_event, folder, kind) => scanMediaFolder(folder, kind === 'video' ? 'video' : 'music'));
ipcMain.handle('folder:refresh', (_event, folder, kind) => refreshSelectedFolder(folder, kind));
ipcMain.handle('files:choose', (_event, kind) => chooseFiles(kind === 'video' ? 'video' : 'music'));
ipcMain.handle('tv:catalog', (_event, force) => getCatalog(Boolean(force)));
ipcMain.handle('app:clear-cache', clearApplicationCaches);
ipcMain.handle('media:file-url', (_event, filePath) => {
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) return '';
  return pathToFileURL(filePath).href;
});
ipcMain.handle('devices:open-sound-settings', () => {
  if (process.platform === 'win32') return shell.openExternal('ms-settings:sound');
  return shell.openExternal('https://support.microsoft.com/windows');
});
ipcMain.handle('window:action', (event, action) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return false;
  if (action === 'minimize') win.minimize();
  if (action === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize();
  if (action === 'close') win.close();
  return { maximized: win.isMaximized() };
});
ipcMain.handle('window:is-maximized', (event) => BrowserWindow.fromWebContents(event.sender)?.isMaximized() || false);

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    queueAssociatedMediaFiles(commandLine.slice(1));
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    queueAssociatedMediaFiles([filePath]);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    app.setAppUserModelId('com.revibemediacentre.app');
    watchSystemAccentChanges();
    protocol.handle('revibe', handleRevibeProtocol);
    await createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow(); });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
