"use strict";

const { app, VERSION } = require("./server");
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`仙加味 LINE OA ${VERSION} running on ${port}`));
