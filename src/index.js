const fs=require("fs");const path=require("path");
const n=30;
const parts=Array.from({length:n},(_,i)=>fs.readFileSync(path.join(__dirname,"p"+i+".js"),"utf8"));
const code=parts.join("");
fs.writeFileSync(path.join(__dirname,"_runtime.js"),code);
require("./_runtime.js");
