"use strict";

// Install the unified social time policy before any social module is loaded.
require("./social-schedule-policy");

const generated = require("./knowledge-card-server");
const staticCards = require("./knowledge-card-static-server");

const VERSION = "1.0.1";

generated.mountKnowledgeCards = function disabledGeneratedKnowledgeCards() {};
staticCards.mountKnowledgeCardStatic = function disabledStaticKnowledgeCards() {};

module.exports = { VERSION };
