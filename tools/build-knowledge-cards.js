"use strict";

const fs = require("fs/promises");
const path = require("path");
const {
  CARDS,
  renderCardFile,
} = require("../knowledge-card-server");
const { applyKnowledgeCardCopyFix } = require("../knowledge-card-copy-fix");

const OUTPUT_DIR = path.join(__dirname, "..", "public", "social-assets", "knowledge");

async function exists(file) {
  try {
    const stat = await fs.stat(file);
    return stat.isFile() && stat.size > 1000;
  } catch {
    return false;
  }
}

async function main() {
  applyKnowledgeCardCopyFix();
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const slugs = Object.keys(CARDS);
  const result = { total: slugs.length, built: 0, reused: 0, failed: [] };

  for (const slug of slugs) {
    const destination = path.join(OUTPUT_DIR, `${slug}.png`);
    if (await exists(destination)) {
      result.reused += 1;
      continue;
    }

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
      console.warn(`knowledge card build skipped: ${slug}`, error.message);
    }
  }

  console.log("Knowledge card static build", result);
  // Keep install/deploy resilient. Runtime has a serialized low-memory fallback.
  process.exitCode = 0;
}

main().catch((error) => {
  console.error("Knowledge card static build failed", error);
  process.exitCode = 0;
});
