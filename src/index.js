const fs=require('fs');const p=require('path');
const c=fs.readFileSync(p.join(__dirname,'h0.js'),'utf8')+fs.readFileSync(p.join(__dirname,'h1.js'),'utf8');
fs.writeFileSync(p.join(__dirname,'_b.js'),c);
require('./_b.js');
