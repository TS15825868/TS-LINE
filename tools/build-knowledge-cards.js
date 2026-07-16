"use strict";

const fs = require("fs/promises");
const path = require("path");
const {
  CARDS,
  renderCardFile,
} = require("../knowledge-card-server");
const { applyKnowledgeCardCopyFix } = require("../knowledge-card-copy-fix");

const OUTPUT_DIR = path.join(__dirname, "..", "public", "social-assets", "knowledge");

async function main() {
  applyKnowledgeCardCopyFix();
  await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const slugs = Object.keys(CARDS);
  const result = { total: slugs.length, built: 0, failed: [] };

  for (const slug of slugs) {
    const destination = path.join(OUTPUT_DIR, `${slug}.png`);
    try {
      const source = await renderCardFile(slug);
      if (!source) throw new Error("render returned no file");
      const temp = `${destination}.${process.pid}.tmp`;
      await fs.copyFile(source, temp);
      await fs.rename(temp, destination);
      result.built += 1;
      console.log(`knowledge card built: ${slug}`);
    } catch (error) {
      result.failed.push({ slug, error: error.message });
      console.error(`knowledge card build failed: ${slug}`, error.message);
    }
  }

  console.log("Knowledge card static build", result);
  if (result.built !== slugs.length || result.failed.length) {
    throw new Error(`knowledge card build incomplete: ${result.built}/${slugs.length}`);
  }
}

main().catch((error) => {
  console.error("Knowledge card static build failed", error);
  process.exit(1);
});
