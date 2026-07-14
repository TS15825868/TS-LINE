"use strict";

const { app } = require("./social-server");
const { mountInternalApp, APP_VERSION } = require("./internal-app");

mountInternalApp(app);

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`仙加味 LINE OA + 社群發布 + 內部管理 App ${APP_VERSION} running on ${port}`);
});
