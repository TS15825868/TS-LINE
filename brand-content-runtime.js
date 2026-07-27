"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");

const target = path.join(__dirname, "server.js");
const brandFile = path.join(__dirname, "brand-content.json");
const originalLoader = Module._extensions[".js"];

function loadBrandContent() {
  try {
    const parsed = JSON.parse(fs.readFileSync(brandFile, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.error("品牌內容載入失敗：" + error.message);
    return {};
  }
}

function topicText(content, key, fallbackTitle, fallbackBody) {
  const item = content[key] || {};
  return {
    title: item.title || fallbackTitle,
    body: item.lineReply || item.summary || item.body || fallbackBody,
  };
}

Module._extensions[".js"] = function brandAwareLoader(module, filename) {
  if (path.resolve(filename) !== path.resolve(target)) {
    return originalLoader(module, filename);
  }

  const content = loadBrandContent();
  const story = topicText(content, "brandStory", "仙加味｜四代傳承", "仙加味的故事從台北萬華開始，四代延續對原料、工序、時間與品質的重視。");
  const origin = topicText(content, "brandOrigin", "仙加味｜品牌由來", "仙加味於2008年完成品牌註冊，把家族熟悉的傳統整理成今天能理解的日常選擇。");
  const ingredients = topicText(content, "ingredientPhilosophy", "仙加味｜選料理念", "選料重視看得懂、分得清、處理得當，依產品型態決定適合的原料組合。");
  const quality = topicText(content, "qualityControl", "仙加味｜品質把關", "品質從原料、製程、規格、標示、保存到出貨逐步確認，三套系統使用同一份正式資料。");
  const craft = topicText(content, "traditionalCraft", "仙加味｜傳統工法", "從挑選、前處理、切料、慢火熬製到濃縮成形，每一步都有目的與判斷基準。");

  let source = fs.readFileSync(filename, "utf8");
  const start = source.indexOf("function brandStoryReply() {");
  const end = source.indexOf("\nfunction faqReply()", start);
  if (start < 0 || end < 0) throw new Error("找不到 brandStoryReply 區段，停止啟動以避免品牌內容失效");

  const replacement = `function brandTopicReply(topic = "story") {
  const topics = ${JSON.stringify({ story, origin, ingredients, quality, craft })};
  const pages = {
    story: "brand.html",
    origin: "brand-origin.html",
    ingredients: "ingredients.html",
    quality: "quality.html",
    craft: "craft.html",
  };
  const selected = topics[topic] || topics.story;
  return mascotBubble(
    selected.title,
    selected.body,
    [
      { label: "完整內容", uri: absoluteUrl(pages[topic] || pages.story) },
      { label: "品牌導覽", text: "品牌導覽" },
      { label: "人工客服", text: "我要人工客服" },
    ],
    "brand"
  );
}

function brandStoryReply() {
  return brandTopicReply("story");
}

function brandGuideReply() {
  return {
    type: "flex",
    altText: "仙加味品牌導覽",
    contents: {
      type: "carousel",
      contents: [
        mascotBubble("仙加味｜品牌導覽", "從四代傳承、品牌由來，到選料、品質與傳統工法，選擇想了解的主題。", [
          { label: "品牌故事", text: "品牌故事" },
          { label: "品牌由來", text: "品牌由來" },
          { label: "人工客服", text: "我要人工客服" },
        ], "brand"),
        flexCard("選料與品質", "了解仙加味如何整理原料名稱、規格、製程與平台資料。", [
          { label: "選料理念", text: "選料理念" },
          { label: "品質把關", text: "品質把關" },
          { label: "傳統工法", text: "傳統工法" },
        ]).contents,
      ],
    },
  };
}
`;

  source = source.slice(0, start) + replacement + source.slice(end);
  const intentNeedle = `  if (/品牌故事|四代|鹿角伯|家族傳承|曾祖父|祖父|第三代|第四代/.test(text)) {\n    return reply(event.replyToken, brandStoryReply());\n  }`;
  const intentReplacement = `  if (/^(品牌導覽|認識仙加味|品牌介紹)$/.test(text)) return reply(event.replyToken, brandGuideReply());
  if (/品牌由來|名稱由來|仙加味由來/.test(text)) return reply(event.replyToken, brandTopicReply("origin"));
  if (/選料理念|選料|原料怎麼選/.test(text)) return reply(event.replyToken, brandTopicReply("ingredients"));
  if (/品質把關|品質管理|品質/.test(text)) return reply(event.replyToken, brandTopicReply("quality"));
  if (/傳統工法|古法熬製|熬製工法|工法/.test(text)) return reply(event.replyToken, brandTopicReply("craft"));
  if (/品牌故事|四代|鹿角伯|家族傳承|曾祖父|祖父|第三代|第四代/.test(text)) {
    return reply(event.replyToken, brandStoryReply());
  }`;
  if (!source.includes(intentNeedle)) throw new Error("找不到品牌意圖區段，停止啟動以避免回覆失效");
  source = source.replace(intentNeedle, intentReplacement);
  module._compile(source, filename);
};
