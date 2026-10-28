const fs=require('fs');const p=require('path');
const a=fs.readFileSync(p.join(__dirname,'h0.js'),'utf8');
const b=fs.readFileSync(p.join(__dirname,'h1.js'),'utf8');
fs.writeFileSync(p.join(__dirname,'_runtime.js'),a+b);
require('./_runtime.js');
