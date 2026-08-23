"use strict";

const welcomeHeroBase64 = require("./welcome-hero-data");
const VERSION = "20260823-approved-hd-welcome-v1";

function install(app) {
  if (!app || app.__xjwWelcomeHeroRouteInstalled) return;
  app.get("/mascot/welcome-hd.jpg", (_req, res) => {
    res.set("Content-Type", "image/jpeg");
    res.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    res.set("X-Xianjiawei-Welcome-Version", VERSION);
    res.send(Buffer.from(welcomeHeroBase64, "base64"));
  });
  Object.defineProperty(app, "__xjwWelcomeHeroRouteInstalled", { value: true });
}

module.exports = { VERSION, install };
