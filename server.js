"use strict";

const core = require("./server-core");

if (require.main === module) {
  const port = process.env.PORT || 3000;
  core.app.listen(port, () => console.log(`仙加味 LINE OA v309.0 running on ${port}`));
}

module.exports = core;
