const fs = require('fs');
const path = require('path');
const parts = ['np0.js', 'np1.js', 'np2.js', 'np3.js'];
const out = path.join(__dirname, '_bundle.js');
fs.writeFileSync(out, parts.map((f) => fs.readFileSync(path.join(__dirname, f), 'utf8')).join(''));
require('./_bundle.js');
