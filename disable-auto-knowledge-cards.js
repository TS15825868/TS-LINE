"use strict";

const generated = require("./knowledge-card-server");
const staticCards = require("./knowledge-card-static-server");

const VERSION = "1.0.0";

generated.mountKnowledgeCards = function disabledGeneratedKnowledgeCards() {};
staticCards.mountKnowledgeCardStatic = function disabledStaticKnowledgeCards() {};

module.exports = { VERSION };