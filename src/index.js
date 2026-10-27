const fs = require('fs');
const path = require('path');
const parts = ['b64_0.txt', 'b64_1.txt', 'b64_2.txt', 'b64_3.txt', 'b64_4.txt', 'b64_5.txt'];
const b64 = parts.map((f) => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('');
const code = Buffer.from(b64, 'base64').toString('utf8');
fs.writeFileSync(path.join(__dirname, '_bundle.js'), code);
require('./_bundle.js');
