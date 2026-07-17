"use strict";

const crypto = require("crypto");
const Module = require("module");
const sharp = require("sharp");
const {
  CAMPAIGN_ID,
  ASSET_STORE_KEY,
  TOPICS,
  rebuildOfficialSocialSchedule,
} = require("./social-official-rebuild");
const { detectImage, uploadToSupabase } = require("./internal-social-upload");

const VERSION = "1.0.1";
const SOURCE_NAME = "社群排程_正式20張_可直接匯入.zip";
const SOURCES = {
  "14A289E2-99BA-457F-9A21-464C3A2C83AD.PNG": { sha256: "bef36c8c97d644cbf5a63644e51bff70201a137d46c234b674cfb74e09823171", url: "https://oaisdmntprjapaneastdr.blob.core.windows.net/files/00000000-2fc8-71fe-929c-50e85f20043b/raw?se=2026-07-17T12%3A15%3A05Z&sp=r&sv=2026-02-06&sr=b&scid=019f6ff1-c7d3-74d3-b90d-99a4504b8d6e&skoid=6980ab1e-b994-4668-84de-ad0444c9d08b&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2026-07-17T09%3A55%3A12Z&ske=2026-07-19T09%3A55%3A12Z&sks=b&skv=2026-02-06&sig=DhHknKIOwn7a6kcBCgf7Bikw4pt2Ytc%2BScE6CpHANF8%3D" },
  "1653AFD1-28A0-43A6-9CD2-E37E196977A7.PNG": { sha256: "aa19249c39417f57395f9542918279bdb713a37e1e490430d80be6106385d8cd", url: "https://oaisdmntprjapaneastdr.blob.core.windows.net/files/00000000-dbe8-71fe-a1b1-ff9ea2a3c6b0/raw?se=2026-07-17T12%3A15%3A05Z&sp=r&sv=2026-02-06&sr=b&scid=019f6ff1-c7d3-74d3-b90d-99a4504b8d6e&skoid=6980ab1e-b994-4668-84de-ad0444c9d08b&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2026-07-17T01%3A08%3A03Z&ske=2026-07-19T01%3A08%3A03Z&sks=b&skv=2026-02-06&sig=d5lX8SOR5wtQLsyy3PCd4x9ciD5oaZOzEvu3TH5omfI%3D" },
  "3F187045-74E9-45AC-B3DD-1F42FA35438D.PNG": { sha256: "4ec6586e45147bdd15d76d19c82f347113f027ba86b60cbe37294df6452ecd79", url: "https://oaisdmntprjapaneastdr.blob.core.windows.net/files/00000000-4954-71fe-99f1-8a879601adbe/raw?se=2026-07-17T12%3A15%3A05Z&sp=r&sv=2026-02-06&sr=b&scid=019f6ff1-c7d3-74d3-b90d-99a4504b8d6e&skoid=6980ab1e-b994-4668-84de-ad0444c9d08b&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2026-07-17T08%3A29%3A44Z&ske=2026-07-19T08%3A29%3A44Z&sks=b&skv=2026-02-06&sig=do1EzTvRcelpFlgyD1uUUZ6PbPpMWHno3SeyIYzXybM%3D" },
  "52C83E67-1BAD-4A85-94B5-E016887607F6.PNG": { sha256: "438da7aba90ae5953f8991c85d3b700b808daa5da5169d0214c2332fb68aadda", url: "https://oaisdmntprjapaneastdr.blob.core.windows.net/files/00000000-a8f4-71fe-b948-db520a68ece9/raw?se=2026-07-17T12%3A15%3A05Z&sp=r&sv=2026-02-06&sr=b&scid=019f6ff1-c7d3-74d3-b90d-99a4504b8d6e&skoid=6980ab1e-b994-4668-84de-ad0444c9d08b&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2026-07-16T22%3A41%3A05Z&ske=2026-07-18T22%3A41%3A05Z&sks=b&skv=2026-02-06&sig=HMrnqtwjF/x2THfB1xKQj0py%2Bgw%2BIsPCwAWsiZsAtXQ%3D" },
  "581D7AAC-AB40-4BA4-81EF-07DA66AC3BC7.PNG": { sha256: "527834a84c87e5f257e7491aea8830c348fc475d24f011cee54bddf0aaa08e75", url: "https://oaisdmntprjapaneastdr.blob.core.windows.net/files/00000000-5320-71fe-a100-9651630af80b/raw?se=2026-07-17T12%3A15%3A05Z&sp=r&sv=2026-02-06&sr=b&scid=019f6ff1-c7d3-74d3-b90d-99a4504b8d6e&skoid=6980ab1e-b994-4668-84de-ad0444c9d08b&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2026-07-16T23%3A29%3A25Z&ske=2026-07-18T23%3A29%3A25Z&sks=b&skv=2026-02-06&sig=TIg%2BvQtv9Semuf0%2BBWtr9jBKhb5AZFYO2NrqtTqXSSs%3D" },
  "586D7D03-5224-48B1-B6C2-2F74B6D5EB53.PNG": { sha256: "77dab2a63cfacdb729d01eed242890fab6e52201d3df41e37942dc3add7534fc", url: "https://oaisdmntprjapaneastdr.blob.core.windows.net/files/00000000-ffd0-71fe-9ad8-05927bcf05d5/raw?se=2026-07-17T12%3A15%3A05Z&sp=r&sv=2026-02-06&sr=b&scid=019f6ff1-c7d3-74d3-b90d-99a4504b8d6e&skoid=6980ab1e-b994-4668-84de-ad0444c9d08b&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2026-07-17T01%3A08%3A13Z&ske=2026-07-19T01%3A08%3A13Z&sks=b&skv=2026-02-06&sig=ss2uvO9JcE2PxoG5/oeH/PSjadGvhcQczIkQjbFZX/w%3D" },
  "6A5717B1-D9BC-40A6-858C-5FDD8464AF53.PNG": { sha256: "26009d959bcfe10694f686557dbd6e5a87349f2dcb4fc199095e87d0e5b237b8", url: "https://oaisdmntprjapaneastdr.blob.core.windows.net/files/00000000-add0-71fe-a9bc-5ea607481072/raw?se=2026-07-17T12%3A15%3A05Z&sp=r&sv=2026-02-06&sr=b&scid=019f6ff1-c7d3-74d3-b90d-99a4504b8d6e&skoid=6980ab1e-b994-4668-84de-ad0444c9d08b&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2026-07-16T23%3A51%3A26Z&ske=2026-07-18T23%3A51%3A26Z&sks=b&skv=2026-02-06&sig=qlg1TsWFc%2BoFAb4aCvuGvqEYKt2jCMGytB8dWgtU/OQ%3D" },
  "790D6C1D-B3A2-4D65-8C3A-F60494D63437.PNG": { sha256: "37fc6257e0c95cce7539adfc4b4dba6ff7aaadb373b5201048e12b85046b278c", url: "https://oaisdmntprjapaneastdr.blob.core.windows.net/files/00000000-2928-71fe-920f-d69e2e8f23c9/raw?se=2026-07-17T12%3A15%3A05Z&sp=r&sv=2026-02-06&sr=b&scid=019f6ff1-c7d3-74d3-b90d-99a4504b8d6e&skoid=6980ab1e-b994-4668-84de-ad0444c9d08b&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2026-07-17T09%3A55%3A13Z&ske=2026-07-19T09%3A55%3A13Z&sks=b&skv=2026-02-06&sig=FWVVJo8xw9/pYSkXLjVv6V4decdykpoTJ7rsC9NedLY%3D" },
  "84E5C7EC-593B-4086-B1F6-1B4EE09A01AB.PNG": { sha256: "d3d1f9be87218b8b5c11c625e3b10e497a8e735e1e1d6baa379432f0047b0658", url: "https://oaisdmntprjapaneastdr.blob.core.windows.net/files/00000000-f204-71fe-b24d-0b7d7ed099bf/raw?se=2026-07-17T12%3A15%3A05Z&sp=r&sv=2026-02-06&sr=b&scid=019f6ff1-c7d3-74d3-b90d-99a4504b8d6e&skoid=6980ab1e-b994-4668-84de-ad0444c9d08b&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2026-07-16T23%3A17%3A43Z&ske=2026-07-18T23%3A17%3A43Z&sks=b&skv=2026-02-06&sig=Fdbf3Kvg%2BhdlmF/TRe/IIXzQN1p8H7Wee5Trdj%2BEvJw%3D" },
  "89C17637-77B2-4F14-8629-2136A9A0BA2E.PNG": { sha256: "1941841e8a8e408d8a70c69b2ce849764629ed6a562a1bfd685b66bb24b9c252", url: "https://oaisdmntprjapaneastdr.blob.core.windows.net/files/00000000-0be0-71fe-bbd0-c3cae5eb1e01/raw?se=2026-07-17T12%3A15%3A05Z&sp=r&sv=2026-02-06&sr=b&scid=019f6ff1-c7d3-74d3-b90d-99a4504b8d6e&skoid=6980ab1e-b994-4668-84de-ad0444c9d08b&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2026-07-16T23%3A17%3A44Z&ske=2026-07-18T23%3A17%3A44Z&sks=b&skv=2026-02-06&sig=hCTHBLJGT9Dc4ZZNRnHyeQ0MWHlZ8lZRbOJk/CO12ag%3D" },
  "8C1EAF67-9007-41A0-8729-D0B4631416BE.PNG": { sha256: "e97c8d0f34621ce29338d7582cf54d9dec6d6f25cad4bbcc9fe571f6c59c1b17", url: "https://oaisdmntprjapaneastdr.blob.core.windows.net/files/00000000-c54c-71fe-82f3-19ddd727f340/raw?se=2026-07-17T12%3A15%3A05Z&sp=r&sv=2026-02-06&sr=b&scid=019f6ff1-c7d3-74d3-b90d-99a4504b8d6e&skoid=6980ab1e-b994-4668-84de-ad0444c9d08b&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2026-07-16T22%3A41%3A01Z&ske=2026-07-18T22%3A41%3A01Z&sks=b&skv=2026-02-06&sig=O9pHmJ56JC6ppUWeX8usxJlyvsmFwORAdGTKCVWiKvE%3D" },
  "9679EC48-F3A3-43E5-8261-08CFEA97F9A1.PNG": { sha256: "17e6e77424a44614e8040e50a36ef6e3d32cd3de2901d5ef708d710fd32e43e5", url: "https://oaisdmntprjapaneastdr.blob.core.windows.net/files/00000000-0854-71fe-acc1-ea5a7707d6f5/raw?se=2026-07-17T12%3A15%3A05Z&sp=r&sv=2026-02-06&sr=b&scid=019f6ff1-c7d3-74d3-b90d-99a4504b8d6e&skoid=6980ab1e-b994-4668-84de-ad0444c9d08b&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2026-07-16T23%3A29%3A56Z&ske=2026-07-18T23%3A29%3A56Z&sks=b&skv=2026-02-06&sig=71JUvL%2BPR8e4EjYNv/Fn/OSPzoXk%2Bo8GAaQh%2BQDY%2B3w%3D" },
  "9DF04070-FD41-4B4E-81EE-1D277DFD202F.PNG": { sha256: "a977fae0a9be2032d54dafd167ba8e482eae96db9b9e40b40d75cb3e5f12fcff", url: "https://oaisdmntprjapaneastdr.blob.core.windows.net/files/00000000-2a08-71fe-94f5-da7019f02e87/raw?se=2026-07-17T12%3A15%3A05Z&sp=r&sv=2026-02-06&sr=b&scid=019f6ff1-c7d3-74d3-b90d-99a4504b8d6e&skoid=6980ab1e-b994-4668-84de-ad0444c9d08b&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2026-07-16T23%3A51%3A28Z&ske=2026-07-18T23%3A51%3A28Z&sks=b&skv=2026-02-06&sig=FR8kRIKD6CElAOINvgjN7cK9FxaRyBRWSVr/DJ7RqgY%3D" },
  "A307B1B9-2414-45B1-B839-4A1FC90B9B74.PNG": { sha256: "43a2b0c22820942c276045226d6a8bf9d893bb16a6a661a577ed5c599a8d211d", url: "https://oaisdmntprjapaneastdr.blob.core.windows.net/files/00000000-eba0-71fe-9898-39b9b856878e/raw?se=2026-07-17T12%3A15%3A05Z&sp=r&sv=2026-02-06&sr=b&scid=019f6ff1-c7d3-74d3-b90d-99a4504b8d6e&skoid=6980ab1e-b994-4668-84de-ad0444c9d08b&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2026-07-16T23%3A52%3A09Z&ske=2026-07-18T23%3A52%3A09Z&sks=b&skv=2026-02-06&sig=CnR5ICiyWMKeKjMpSBswh9HqlrmGwpnsfkZvbCA/M/o%3D" },
  "A92B951E-78B9-4153-882E-185EA91FE7ED.PNG": { sha256: "cd274b43bb9e905a8dbfde1e9afa05a18bae4acbaaba1f754cf3b4f1117bbcff", url: "https://oaisdmntprjapaneastdr.blob.core.windows.net/files/00000000-2f30-71fe-8c08-6dc753689afb/raw?se=2026-07-17T12%3A15%3A05Z&sp=r&sv=2026-02-06&sr=b&scid=019f6ff1-c7d3-74d3-b90d-99a4504b8d6e&skoid=6980ab1e-b994-4668-84de-ad0444c9d08b&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2026-07-17T09%3A51%3A52Z&ske=2026-07-19T09%3A51%3A52Z&sks=b&skv=2026-02-06&sig=e%2BnZ93kyD04YvY4UiZGKFm9YJrl9TqU0G1IrNUcBOT4%3D" },
  "CA5CF41E-414B-4840-A259-7A3C06C082A1.PNG": { sha256: "25c7302685f603c3f8cfcc71e1253ad10d682f664a2d9088df053241ab0e6c71", url: "https://oaisdmntprjapaneastdr.blob.core.windows.net/files/00000000-8234-71fe-b998-d02f8ca9d0a6/raw?se=2026-07-17T12%3A15%3A05Z&sp=r&sv=2026-02-06&sr=b&scid=019f6ff1-c7d3-74d3-b90d-99a4504b8d6e&skoid=6980ab1e-b994-4668-84de-ad0444c9d08b&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2026-07-17T09%3A56%3A22Z&ske=2026-07-19T09%3A56%3A22Z&sks=b&skv=2026-02-06&sig=WeSh0/o170KxCdZbmeAzvT/1oLR1PgUL8NozgJAWHLM%3D" },
  "CBDD60D2-C5BE-449B-95DF-469122F3DB08.PNG": { sha256: "7646af58125a6296faef8034d68434364e6251a6993e7372492078bf3d676f44", url: "https://oaisdmntprjapaneastdr.blob.core.windows.net/files/00000000-13d4-71fe-a2d9-3ad617dec3c8/raw?se=2026-07-17T12%3A15%3A05Z&sp=r&sv=2026-02-06&sr=b&scid=019f6ff1-c7d3-74d3-b90d-99a4504b8d6e&skoid=6980ab1e-b994-4668-84de-ad0444c9d08b&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2026-07-16T23%3A52%3A00Z&ske=2026-07-18T23%3A52%3A00Z&sks=b&skv=2026-02-06&sig=q6vpLJie/kl02WebkDSUt3JFWNWcBPnf0tYb8j9%2BjTo%3D" },
  "E3DF57ED-1A6E-4A93-A187-BFCACFCE0B74.PNG": { sha256: "0814287650fe49ea7cdb7b30115cc964870b231637f9febcc3ba921efe30fd6a", url: "https://oaisdmntprjapaneastdr.blob.core.windows.net/files/00000000-b624-71fe-b75b-c34eba158add/raw?se=2026-07-17T12%3A15%3A05Z&sp=r&sv=2026-02-06&sr=b&scid=019f6ff1-c7d3-74d3-b90d-99a4504b8d6e&skoid=6980ab1e-b994-4668-84de-ad0444c9d08b&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2026-07-17T09%3A46%3A00Z&ske=2026-07-19T09%3A46%3A00Z&sks=b&skv=2026-02-06&sig=PN7C6XRYrTb5LUH4Z8hDSNtMa1vjMsmqE/vZqmB2XTU%3D" },
  "F6985971-E131-42EF-BCA8-4E434F8CC345.PNG": { sha256: "666fb95142b871d7cb370297f0e54d69bf720ad9b5cfb5fe2b1bf954a93b2d3d", url: "https://oaisdmntprjapaneastdr.blob.core.windows.net/files/00000000-46a0-71fe-a41a-5e7983771a6a/raw?se=2026-07-17T12%3A15%3A05Z&sp=r&sv=2026-02-06&sr=b&scid=019f6ff1-c7d3-74d3-b90d-99a4504b8d6e&skoid=6980ab1e-b994-4668-84de-ad0444c9d08b&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2026-07-17T01%3A08%3A00Z&ske=2026-07-19T01%3A08%3A00Z&sks=b&skv=2026-02-06&sig=WO6L8VDCIOz9IA8Ew0utCe8h2sSPFfafEonFZTZ99kg%3D" },
  "FAB540D0-8BB7-4272-97A7-2BB7C82C964D.PNG": { sha256: "d229e94361603dc8c43dab6a9ea56e4565c8dfee5d89a47ecac90dedd4de3ebd", url: "https://oaisdmntprjapaneastdr.blob.core.windows.net/files/00000000-bfc0-71fe-9831-c6227a3c01ca/raw?se=2026-07-17T12%3A15%3A05Z&sp=r&sv=2026-02-06&sr=b&scid=019f6ff1-c7d3-74d3-b90d-99a4504b8d6e&skoid=6980ab1e-b994-4668-84de-ad0444c9d08b&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2026-07-16T22%3A41%3A20Z&ske=2026-07-18T22%3A41%3A20Z&sks=b&skv=2026-02-06&sig=iHgwvNK79xkXbPfisjl7KlQ1a3A8Yoypm8cxcNBcNNs%3D" },
};

const status = {
  ok: false,
  state: "waiting",
  version: VERSION,
  downloaded: 0,
  uploaded: 0,
  pendingReview: 0,
  preservedPublished: 0,
  removedUnpublished: 0,
  error: "",
  updatedAt: new Date().toISOString(),
};

function setStatus(change) {
  Object.assign(status, change, { updatedAt: new Date().toISOString() });
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function downloadAndValidate(topic) {
  const source = SOURCES[topic.file];
  if (!source?.url || !source?.sha256) throw new Error(`缺少正式圖片來源：${topic.file}`);
  const response = await fetch(source.url, { redirect: "follow" });
  if (!response.ok) throw new Error(`下載失敗 ${response.status}：${topic.file}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (sha256(buffer) !== source.sha256) throw new Error(`原圖雜湊不符：${topic.file}`);
  const detected = detectImage(buffer);
  if (!detected || detected.mime !== "image/png") throw new Error(`不是原始 PNG：${topic.file}`);
  const metadata = await sharp(buffer, { limitInputPixels: 30 * 1024 * 1024 }).metadata();
  if (metadata.width !== 1254 || metadata.height !== 1254) {
    throw new Error(`尺寸不是 1254×1254：${topic.file}`);
  }
  return { topic, buffer, detected };
}

async function importOnce(readSocialStore, writeSocialStore) {
  const existing = readSocialStore();
  const current = existing?.[ASSET_STORE_KEY];
  if (current?.campaignId === CAMPAIGN_ID && Number(current.originalCount) === TOPICS.length) {
    const schedule = rebuildOfficialSocialSchedule(readSocialStore, writeSocialStore, { nowMs: Date.now() });
    setStatus({ ok: true, state: "already-imported", downloaded: TOPICS.length, uploaded: TOPICS.length, pendingReview: schedule.pendingReview, preservedPublished: schedule.preservedPublished, removedUnpublished: schedule.removedUnpublished, error: "" });
    return;
  }
  if (Object.keys(SOURCES).length !== TOPICS.length) {
    setStatus({ state: "not-configured", error: "one-time sources are not installed" });
    return;
  }

  setStatus({ state: "downloading", error: "" });
  const downloaded = await Promise.all(TOPICS.map(downloadAndValidate));
  setStatus({ state: "uploading", downloaded: downloaded.length });

  const files = {};
  let uploadedCount = 0;
  for (const item of downloaded) {
    const uploaded = await uploadToSupabase(item.buffer, item.detected);
    files[item.topic.file] = uploaded.url;
    files[item.topic.slug] = uploaded.url;
    uploadedCount += 1;
    setStatus({ uploaded: uploadedCount });
  }

  const store = readSocialStore();
  store[ASSET_STORE_KEY] = { campaignId: CAMPAIGN_ID, version: VERSION, importedAt: new Date().toISOString(), sourceName: SOURCE_NAME, originalCount: TOPICS.length, files };
  writeSocialStore(store);

  const schedule = rebuildOfficialSocialSchedule(readSocialStore, writeSocialStore, { nowMs: Date.now() });
  setStatus({ ok: true, state: "complete", downloaded: downloaded.length, uploaded: uploadedCount, pendingReview: schedule.pendingReview, preservedPublished: schedule.preservedPublished, removedUnpublished: schedule.removedUnpublished, error: "" });
  console.log("Approved social one-time import complete", status);
}

let installed = false;
function install() {
  if (installed) return;
  installed = true;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);
    if (request === "./social-server" && parent?.filename?.endsWith("internal-entry.js") && loaded?.app) {
      loaded.app.get("/internal/approved-social-one-time-healthz", (_req, res) => {
        res.status(status.state === "failed" ? 503 : 200).json(status);
      });
      setImmediate(() => {
        importOnce(loaded.readStore, loaded.writeStore).catch((error) => {
          setStatus({ ok: false, state: "failed", error: error.message || "one-time import failed" });
          console.error("Approved social one-time import failed", error);
        });
      });
    }
    return loaded;
  };
}

install();
module.exports = { VERSION, status, importOnce, install };
