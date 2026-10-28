/**
 * Working entry: reconstructs full bot from base64 parts shipped in repo.
 */
const fs = require('fs');
const path = require('path');

const partsDir = __dirname;
const files = fs.readdirSync(partsDir)
  .filter((f) => /^p\d+\.b64$/.test(f))
  .sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10));

if (!files.length) {
  console.error('No p*.b64 parts found next to index.js');
  process.exit(1);
}

const b64 = files.map((f) => fs.readFileSync(path.join(partsDir, f), 'utf8').replace(/\s+/g, '')).join('');
const code = Buffer.from(b64, 'base64').toString('utf8');
if (!code.includes('client.login') || !code.includes('DISCORD_TOKEN')) {
  console.error('Reconstructed bot looks invalid');
  process.exit(1);
}
const runtime = path.join(partsDir, '_runtime.js');
fs.writeFileSync(runtime, code);
require(runtime);
