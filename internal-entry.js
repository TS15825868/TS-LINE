"use strict";

const { app, healthPayload } = require("./social-server");
const { mountInternalApp, APP_VERSION } = require("./internal-app");

mountInternalApp(app);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  const health = typeof healthPayload === "function" ? healthPayload() : {};
  console.log(`仙加味 LINE OA + internal app ${APP_VERSION} running on ${port}`, {
    lineVersion: health.lineVersion,
    socialVersion: health.socialVersion,
  });
});
