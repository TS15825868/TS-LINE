"use strict";

// Compatibility entrypoint: current sync owns public IDs, facts and media roles.
// Never run the retired photo/quantity rules against newer public authority.
if (require.main === module) require("./sync_sales_master_current.js");
