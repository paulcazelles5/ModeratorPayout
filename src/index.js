const fs=require('fs');const path=require('path');
const parts=['m0.txt','m1.txt','m2.txt','m3.txt','m4.txt','m5.txt','m6.txt','m7.txt','m8.txt','m9.txt'];
const b64=parts.map(f=>fs.readFileSync(path.join(__dirname,f),'utf8')).join('');
fs.writeFileSync(path.join(__dirname,'_bundle.js'),Buffer.from(b64,'base64').toString('utf8'));
require('./_bundle.js');
