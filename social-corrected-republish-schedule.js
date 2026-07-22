"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");

const VERSION = "1.0.0";
let installed = false;

function transform(source) {
  let output = String(source);
  output = output.replace('const VERSION = "2.0.0";', 'const VERSION = "2.1.0";');
  output = output.replace(
    'function isWeatherPost(post = {}) {',
    'function isCorrectedClearRepublish(post = {}) {\n  return post.correctedClearRepublish === true;\n}\n\nfunction isWeatherPost(post = {}) {'
  );
  output = output.replace(
    'function expectedTime(post = {}) {\n  if (isWeatherPost(post))',
    'function expectedTime(post = {}) {\n  if (isCorrectedClearRepublish(post)) return { weekday: "Thu", hour: REGULAR_CARE_HOUR, minute: REGULAR_CARE_MINUTE, policy: "corrected-clear-republish-thu-19:30" };\n  if (isWeatherPost(post))'
  );
  output = output.replace(
    'function scheduleError(post = {}) {\n  if (isWeatherPost(post))',
    'function scheduleError(post = {}) {\n  if (isCorrectedClearRepublish(post)) return "本次清晰修正版安排於台灣時間週四晚上 19:30，僅發布一次";\n  if (isWeatherPost(post))'
  );
  output = output.replace(
    '  isWeatherPost,\n  isCarePost,',
    '  isCorrectedClearRepublish,\n  isWeatherPost,\n  isCarePost,'
  );
  return output;
}

function install() {
  if (installed) return;
  installed = true;
  const previousLoader = Module._extensions[".js"];
  const wrapped = function loadCorrectedRepublishSchedule(module, filename) {
    if (path.basename(filename) !== "social-schedule-policy.js") return previousLoader(module, filename);
    return module._compile(transform(fs.readFileSync(filename, "utf8")), filename);
  };
  Object.defineProperty(wrapped, "__xjwCorrectedRepublishSchedule", { value: true });
  Module._extensions[".js"] = wrapped;
}

install();

module.exports = { VERSION, transform, install };
