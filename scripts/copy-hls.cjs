const fs = require('node:fs');
const path = require('node:path');
const source = path.resolve(__dirname, '..', 'node_modules', 'hls.js', 'dist', 'hls.min.js');
const destination = path.resolve(__dirname, '..', 'assets', 'hls.min.js');
if (!fs.existsSync(source)) {
  console.error('hls.js is not installed yet. Run npm install first.');
  process.exit(1);
}
const hls = fs.readFileSync(source, 'utf8').replace(/\n?\/\/# sourceMappingURL=.*$/m, '');
fs.writeFileSync(destination, hls);
console.log(`Copied hls.js to ${path.relative(process.cwd(), destination)}`);
