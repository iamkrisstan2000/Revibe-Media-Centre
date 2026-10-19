const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const javascriptFiles = [
  'electron/main.cjs',
  'electron/preload.cjs',
  'src/app.js',
  'scripts/copy-hls.cjs'
];

for (const relativePath of javascriptFiles) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) throw new Error(`Missing source file: ${relativePath}`);
  const result = spawnSync(process.execPath, ['--check', absolutePath], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const packageLock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const tvFallback = JSON.parse(fs.readFileSync(path.join(root, 'assets/tv-fallback.json'), 'utf8'));
if (packageJson.license !== 'GPL-3.0-only' || packageLock.packages?.['']?.license !== packageJson.license) {
  throw new Error('package.json and package-lock.json must declare GPL-3.0-only.');
}
if (!Array.isArray(tvFallback.channels)) throw new Error('TV fallback data must contain a channels array.');
if (!fs.existsSync(path.join(root, 'assets/hls.min.js'))) {
  throw new Error('Missing generated HLS.js asset; run npm install or npm run copy:hls.');
}

console.log('Source syntax and metadata checks passed.');
