"use strict";

require("./no-collage-runtime");
const { app, VERSION } = require("./server");
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`仙加味 LINE OA ${VERSION} image-policy-v401.1 running on ${port}`));
