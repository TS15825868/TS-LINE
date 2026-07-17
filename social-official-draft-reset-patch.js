"use strict";

const library = require("./social-content-library");
const { resetOfficialSocialDrafts } = require("./social-official-draft-reset");

if (!library.__xjwOfficialDraftResetWrapped) {
  const previousSeed = library.seedSocialContentLibrary;
  library.seedSocialContentLibrary = function seedThenResetOfficialDrafts(readStore, writeStore) {
    const legacy = previousSeed(readStore, writeStore);
    const official = resetOfficialSocialDrafts(readStore, writeStore);
    return {
      ...legacy,
      officialResetVersion: official.version,
      officialCampaignId: official.campaignId,
      officialRemovedUnpublished: official.removedUnpublished,
      officialDraftsCreated: official.draftsCreated,
      officialPreservedHistory: official.preservedPublishedHistory,
      total: official.draftsCreated,
      knowledgeTotal: official.draftsCreated,
      firstAt: official.firstAt,
      lastAt: official.lastAt,
      cadence: official.cadence,
      timezone: official.timezone,
    };
  };
  Object.defineProperty(library, "__xjwOfficialDraftResetWrapped", {
    value: true,
    enumerable: false,
  });
}

module.exports = {
  VERSION: "1.0.0",
};
