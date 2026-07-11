"use strict";
const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "..", "server.js");
let text = fs.readFileSync(file, "utf8");
text = text.replace(/aspectMode: "contain"/g, 'aspectMode: "fit"');
text = text.replace(
  'Promise.all(req.body.events.map(handleEvent))\n      .then(() => res.json({ ok: true }))\n      .catch((error) => {\n        console.error(error);\n        res.status(500).json({ ok: false });\n      });',
  'Promise.all(req.body.events.map((event) => handleEvent(event).catch((error) => {\n      console.error("LINE event handling failed:", error?.message || error);\n      return null;\n    })))\n      .then(() => res.json({ ok: true }))\n      .catch((error) => {\n        console.error("Webhook processing failed:", error?.message || error);\n        res.json({ ok: true });\n      });'
);
fs.writeFileSync(file, text, "utf8");
console.log("Replaced invalid Flex aspectMode contain with fit and prevented webhook retries");
