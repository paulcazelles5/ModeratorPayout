const fs=require('fs');const path=require('path');
const code=fs.readFileSync(path.join(__dirname,'half0.js'),'utf8')+fs.readFileSync(path.join(__dirname,'half1.js'),'utf8');
fs.writeFileSync(path.join(__dirname,'_bundle.js'),code);
require('./_bundle.js');
