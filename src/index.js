const fs = require('fs');
const path = require('path');
const parts = [];
for (let i = 0; i < 15; i++) {
  parts.push(fs.readFileSync(path.join(__dirname, `p${i}.js`), 'utf8'));
}
const code = parts.join('');
fs.writeFileSync(path.join(__dirname, '_runtime.js'), code);
require('./_runtime.js');
