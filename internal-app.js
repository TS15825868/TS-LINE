"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const Module = require("module");

const encoded = [1, 2, 3, 4, 5]
  .map((part) => fs.readFileSync(path.join(__dirname, `internal-app-v2.part${part}.b64`), "utf8").replace(/\s+/g, ""))
  .join("");
const source = zlib.gunzipSync(Buffer.from(encoded, "base64")).toString("utf8");
const filename = path.join(__dirname, "internal-app-v2.compiled.js");
const compiled = new Module(filename, module);
compiled.filename = filename;
compiled.paths = module.paths;
compiled._compile(source, filename);
module.exports = compiled.exports;
