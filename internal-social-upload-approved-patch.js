"use strict";

const upload = require("./internal-social-upload");
const { mountApprovedSocialZipImport } = require("./social-approved-zip-import");

const VERSION = "1.0.0";
const originalMountUpload = upload.mountUpload;

upload.mountUpload = function mountUploadWithApprovedZip(app) {
  originalMountUpload(app);
  const {
    readStore: readSocialStore,
    writeStore: writeSocialStore,
  } = require("./social-server");
  mountApprovedSocialZipImport(app, { readSocialStore, writeSocialStore });
};

module.exports = { VERSION };