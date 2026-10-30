const fs = require("fs");
const path = require("path");
let code = "";
for (let i = 0; i < 8; i++) code += fs.readFileSync(path.join(__dirname, "p" + i + ".js"), "utf8");
fs.writeFileSync(path.join(__dirname, "_runtime.js"), code);
require("./_runtime.js");
