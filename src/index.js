const fs = require('fs');
const path = require('path');
const parts = ['bot.part0.js', 'bot.part1.js', 'bot.part2.js', 'bot.part3.js', 'bot.part4.js'];
const out = path.join(__dirname, '_bundle.js');
const code = parts.map((f) => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('');
fs.writeFileSync(out, code);
require('./_bundle.js');
