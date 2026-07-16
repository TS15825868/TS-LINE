"use strict";

const fs = require("fs/promises");
const path = require("path");
const { APPROVED_POSTS } = require("../approved-post-library");
const { STATIC_DIR } = require("../approved-post-static");

const SOURCE_DIR = path.join(__dirname, "..", "assets", "approved-posts", "v1");

async function main() {
  await fs.rm(STATIC_DIR, { recursive: true, force: true });
  await fs.mkdir(STATIC_DIR, { recursive: true });

  const result = { total: APPROVED_POSTS.length, built: 0, failed: [] };
  for (const item of APPROVED_POSTS) {
    const source = path.join(SOURCE_DIR, `${item.image}.b64`);
    const destination = path.join(STATIC_DIR, item.image);
    try {
      const encoded = (await fs.readFile(source, "utf8")).replace(/\s+/g, "");
      const binary = Buffer.from(encoded, "base64");
      if (binary.length < 10000 || binary[0] !== 0xff || binary[1] !== 0xd8) {
        throw new Error("invalid JPEG payload");
      }
      await fs.writeFile(destination, binary);
      result.built += 1;
      console.log(`approved post built: ${item.image}`);
    } catch (error) {
      result.failed.push({ image: item.image, error: error.message });
      console.error(`approved post build failed: ${item.image}`, error.message);
    }
  }

  console.log("Approved post image build", result);
  if (result.built !== result.total || result.failed.length) {
    throw new Error(`approved post build incomplete: ${result.built}/${result.total}`);
  }
}

main().catch((error) => {
  console.error("Approved post image build failed", error);
  process.exit(1);
});
