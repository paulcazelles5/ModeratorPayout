/**
 * Full AI ticket bot entry.
 * 1) Prefer local src/bot.full.js if present (no network).
 * 2) Else download known-good full source, patch, run.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const LOCAL_FULL = path.join(__dirname, 'bot.full.js');
const CACHE = path.join(__dirname, '_full_bot_cached.js');
const RUNTIME = path.join(__dirname, '_runtime.js');
const RAW_URL =
  'https://raw.githubusercontent.com/paulcazelles5/ModeratorPayout/7af4fd7b/src/index.js';

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return get(res.headers.location).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          reject(new Error('HTTP ' + res.statusCode + ' for ' + url));
          res.resume();
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      })
      .on('error', reject);
  });
}

function patch(src) {
  src = src.replace(
    /const TOKEN = process\.env\.DISCORD_TOKEN;/,
    'const TOKEN = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN || process.env.TOKEN;'
  );
  src = src.replace(
    /const DATA_PATH = path\.join\(__dirname, '\.\.', 'data\.json'\);/,
    [
      "const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR || path.join(__dirname, '..');",
      "const DATA_PATH = path.join(DATA_DIR, 'data.json');",
      "try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}",
    ].join('\n')
  );
  src = src.replace(
    /client\.once\('ready', \(\) => console\.log\(`Online as \$\{client\.user\.tag\} \| Form → AI once → Staff`\)\);/,
    [
      'function onReady() {',
      '  console.log(`Online as ${client.user.tag} | Form → AI once → Staff`);',
      '}',
      "client.once('clientReady', onReady);",
      "client.once('ready', onReady);",
    ].join('\n')
  );
  if (src.includes('client.login(TOKEN);') && !src.includes('Gateway login OK')) {
    src = src.replace(
      'client.login(TOKEN);',
      [
        "client.login(TOKEN).then(() => console.log('Gateway login OK')).catch((err) => {",
        "  console.error('Login failed:', err && err.message ? err.message : err);",
        '  process.exit(1);',
        '});',
        "client.on('error', (err) => console.error('Client error:', err && err.message ? err.message : err));",
        "process.on('unhandledRejection', (err) => console.error('Unhandled:', err && err.message ? err.message : err));",
      ].join('\n')
    );
  }
  return src;
}

async function main() {
  let src;
  if (fs.existsSync(LOCAL_FULL)) {
    src = fs.readFileSync(LOCAL_FULL, 'utf8');
    console.log('Using local bot.full.js');
  } else if (fs.existsSync(CACHE)) {
    const cached = fs.readFileSync(CACHE, 'utf8');
    if (cached.includes('client.login') && cached.length > 10000) {
      src = cached;
      console.log('Using cached full bot source');
    }
  }
  if (!src) {
    console.log('Downloading full bot source from commit 7af4fd7b…');
    src = await get(RAW_URL);
    if (!src.includes('client.login') || src.length < 10000) {
      throw new Error('Downloaded source looks incomplete (' + src.length + ' bytes)');
    }
    fs.writeFileSync(CACHE, src);
  }
  const patched = patch(src);
  if (!patched.includes('client.login')) throw new Error('Patch failed');
  fs.writeFileSync(RUNTIME, patched);
  console.log('Starting full ticket bot (' + patched.length + ' bytes)…');
  require(RUNTIME);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
