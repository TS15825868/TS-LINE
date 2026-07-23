"use strict";

const VERSION = "2.0.0";

function transform(source) {
  return String(source);
}

function install() {
  return true;
}

module.exports = { VERSION, transform, install };
