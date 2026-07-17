"use strict";

const fs = require("fs/promises");
const path = require("path");
const {
  VERSION: CARD_VERSION,
  CARDS,
  renderCardFile,
} = require("../knowledge-card-server");
const {
  IMAGE_PATH_VERSION,
  STATIC_ROOT,
  STATIC_DIR,
} = require("../knowledge-card-static-server");

async function main() {
  await fs.rm(STATIC_ROOT, { recursive: true, force: true });
  await fs.mkdir(STATIC_DIR, { recursive: true });

  const slugs = Object.keys(CARDS);
  const result = {
    cardVersion: CARD_VERSION,
    layout: "approved-integrated-square",
    pathVersion: IMAGE_PATH_VERSION,
    total: slugs.length,
    removedOldTree: true,
    built: 0,
    failed: [],
  };

  for (const slug of slugs) {
    const destination = path.join(STATIC_DIR, `${slug}.png`);
    try {
      const source = await renderCardFile(slug);
      if (!source) throw new Error("render returned no file");
      const temp = `${destination}.${process.pid}.tmp`;
      await fs.copyFile(source, temp);
      await fs.rename(temp, destination);
      result.built += 1;
      console.log(`official mascot card built: ${IMAGE_PATH_VERSION}/${slug}`);
    } catch (error) {
      result.failed.push({ slug, error: error.message });
      console.error(`official mascot card build failed: ${slug}`, error.message);
    }
  }

  console.log("Official mascot card replacement build", result);
  if (slugs.length !== 30 || result.built !== 30 || result.failed.length) {
    throw new Error(`official mascot card build incomplete: ${result.built}/${slugs.length}`);
  }
}

main().catch((error) => {
  console.error("Official mascot card static build failed", error);
  process.exit(1);
});
