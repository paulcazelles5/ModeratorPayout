const fs = require('fs');
const path = require('path');
const parts = [0,1,2,3].map(i => fs.readFileSync(path.join(__dirname, `part${i}.js`), 'utf8'));
const code = parts.join('');
fs.writeFileSync(path.join(__dirname, '_runtime.js'), code);
require('./_runtime.js');
