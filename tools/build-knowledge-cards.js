"use strict";

const fs = require("fs/promises");
const path = require("path");
const {
  CARDS,
  renderCardFile,
} = require("../knowledge-card-server");
const { applyKnowledgeCardCopyFix } = require("../knowledge-card-copy-fix");
const {
  IMAGE_PATH_VERSION,
  STATIC_ROOT,
  STATIC_DIR,
} = require("../knowledge-card-static-server");

async function main() {
  applyKnowledgeCardCopyFix();

  // Remove every previously generated knowledge-card path first. The rebuilt
  // cards live under a brand-new physical path so no browser/proxy can reuse an
  // old PNG that contained missing-glyph boxes.
  await fs.rm(STATIC_ROOT, { recursive: true, force: true });
  await fs.mkdir(STATIC_DIR, { recursive: true });

  const slugs = Object.keys(CARDS);
  const result = {
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
      console.log(`knowledge card rebuilt: ${IMAGE_PATH_VERSION}/${slug}`);
    } catch (error) {
      result.failed.push({ slug, error: error.message });
      console.error(`knowledge card build failed: ${slug}`, error.message);
    }
  }

  console.log("Knowledge card full replacement build", result);
  if (result.built !== slugs.length || result.failed.length) {
    throw new Error(`knowledge card build incomplete: ${result.built}/${slugs.length}`);
  }
}

main().catch((error) => {
  console.error("Knowledge card static build failed", error);
  process.exit(1);
});