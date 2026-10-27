const fs = require("fs");
const path = require("path");
const a = fs.readFileSync(path.join(__dirname, "h0.js"), "utf8");
const b = fs.readFileSync(path.join(__dirname, "h1.js"), "utf8");
fs.writeFileSync(path.join(__dirname, "_runtime.js"), a + b);
require("./_runtime.js");
