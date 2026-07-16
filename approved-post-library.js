"use strict";

const VERSION = "1.0.0";
const SERIES_ID = "xjw-approved-knowledge-202607-v1";
const CAMPAIGN_ID = "xjw-knowledge-202607-v1";
const APP = "https://ts-line.onrender.com";
const IMAGE_BASE = `${APP}/social-assets/approved/v1`;
const TAGS = "#仙加味 #仙加味小老闆 #龜鹿 #漢方生活 #日常補養 #補養是一種節奏";
const CTA = "想了解產品規格、保存或使用方式，可私訊或加入仙加味 LINE 官方帳號：@762jybnm。";

function captions(headline, instagramBody, facebookBody) {
  return {
    instagramCaption: [headline, "", instagramBody, "", "仙加味小老闆幫你整理", "補養，是一種節奏。", "", TAGS].join("\n"),
    facebookCaption: [headline, "", facebookBody, "", "仙加味小老闆幫你整理", "補養，是一種節奏。", "", CTA, "", TAGS].join("\n"),
  };
}

const APPROVED_POSTS = [
  {
    key: "approved-01-units",
    title: "小老闆知識 01｜g 與 cc，不能只看數字比較",
    knowledgeTopic: "重量與容量單位要分開理解",
    image: "01-units.jpg",
    ...captions(
      "g 與 cc，不能只看數字比較。",
      "g 是重量，cc 是容量。100g 與 300cc 顯示的是不同資訊，選擇產品時要先看產品型態、使用方式與實際標示。",
      "產品標示中的 g 代表重量，cc 代表容量。即使數字接近，也不能直接換算成相同份量。選擇前先確認產品型態、規格與使用方式，會比較清楚。"
    ),
  },
  {
    key: "approved-02-pieces-weight",
    title: "小老闆知識 02｜片數多，不代表總重量比較多",
    knowledgeTopic: "片數與總重量是不同資訊",
    image: "02-pieces-weight.jpg",
    ...captions(
      "片數多，不代表總重量比較多。",
      "片數只是切分方式；比較塊狀產品時，應同時確認總重量、每片約重與實際規格。",
      "同樣是塊狀產品，切得較小可能片數較多，切得較大則片數較少。片數本身不能代表總重量，仍要一起確認總重量與每片約重。"
    ),
  },
  {
    key: "approved-03-taiwan-catty",
    title: "小老闆知識 03｜一台斤是多少公克",
    knowledgeTopic: "台灣台斤與公克換算",
    image: "03-taiwan-catty.jpg",
    ...captions(
      "一台斤，是多少公克？",
      "在台灣，一台斤通常以 600 公克計算；16 兩也是一台斤。看到斤兩規格時，記得確認使用的單位。",
      "在台灣常用的台斤制度中，一台斤通常等於 600 公克，也等於 16 兩。不同地區可能有不同換算方式，購買前以產品實際標示為準。"
    ),
  },
  {
    key: "approved-04-dissolve-speed",
    title: "小老闆知識 04｜化開快慢不能單獨判斷品質",
    knowledgeTopic: "化開速度受到多項條件影響",
    image: "04-dissolve-speed.jpg",
    ...captions(
      "化開快慢，不能單獨判斷品質。",
      "水溫、份量、塊狀大小與攪拌方式，都會影響化開速度。先統一沖泡條件，再觀察實際內容。",
      "產品化開速度會受到水溫、使用份量、塊狀大小及攪拌方式影響。快或慢都不能單獨用來判斷內容或品質，應回到成分、規格與使用方式。"
    ),
  },
  {
    key: "approved-05-receive-check",
    title: "小老闆知識 05｜收到產品後先確認什麼",
    knowledgeTopic: "收到產品後的基本確認",
    image: "05-receive-check.jpg",
    ...captions(
      "收到產品後，先確認什麼？",
      "先確認品名、規格與數量，再查看包裝是否完整、保存方式及食用說明；有疑問先拍照，再聯絡客服。",
      "收到產品後，可先核對品名、規格與數量，接著查看外盒與內包裝是否完整，以及保存方式和食用說明。若發現異常，先保留包裝並拍照聯絡客服。"
    ),
  },
  {
    key: "approved-06-storage-space",
    title: "小老闆知識 06｜購買前先確認保存空間",
    knowledgeTopic: "依產品型態安排保存空間",
    image: "06-storage-space.jpg",
    ...captions(
      "購買前，先確認保存空間。",
      "膏、粉、湯塊與飲品的保存需求可能不同。先看標示，再依家中空間與日常使用量安排。",
      "購買前先確認產品標示的保存方式，並評估家中陰涼處、櫥櫃或冷藏空間是否足夠。依實際用量選擇規格，比買回家後才找位置更安心。"
    ),
  },
  {
    key: "approved-07-taste-strength",
    title: "小老闆知識 07｜口感濃淡可以依習慣調整",
    knowledgeTopic: "依個人口感調整沖泡濃淡",
    image: "07-taste-strength.jpg",
    ...captions(
      "口感濃淡，可以依習慣調整。",
      "先從少量與適量熱水開始，再依自己的口感增加水量。固定自己的使用方式，會比較容易掌握。",
      "沖泡後覺得濃，可以逐步增加熱水；覺得淡，則下次調整水量或取用份量。口感是個人感受，找到自己容易持續的方式更重要。"
    ),
  },
  {
    key: "approved-08-thermos",
    title: "小老闆知識 08｜保溫壺也能沖泡湯塊",
    knowledgeTopic: "保溫壺沖泡湯塊方式",
    image: "08-thermos.jpg",
    ...captions(
      "保溫壺，也能沖泡湯塊。",
      "將湯塊放入保溫壺，加入熱水並等待化開；外出、上班或日常忙碌時，也能依自己的習慣安排。",
      "使用乾淨保溫壺放入適量湯塊，再加入熱水等待化開。實際水量可依產品說明與個人口感調整，飲用後記得把保溫壺清洗乾淨。"
    ),
  },
  {
    key: "approved-09-appearance",
    title: "小老闆知識 09｜外型不能代表內容比例",
    knowledgeTopic: "不能只靠產品外型判斷內容",
    image: "09-appearance.jpg",
    ...captions(
      "外型，不能代表內容比例。",
      "膏、飲、湯塊只是不同呈現方式。了解產品時，仍要看成分、規格與使用方式，不只看外觀。",
      "產品做成膏狀、飲品或塊狀，是不同的使用與包裝方式。外觀不能直接代表原料比例；比較產品時，應查看完整成分、規格及使用說明。"
    ),
  },
  {
    key: "approved-10-daily-rhythm",
    title: "小老闆知識 10｜日常安排重點是節奏",
    knowledgeTopic: "把補養安排融入日常節奏",
    image: "10-daily-rhythm.jpg",
    ...captions(
      "日常安排，重點是節奏。",
      "補養不是一次很多，而是找到適合自己的頻率。早上、下午或日常餐桌，都可以依生活方式安排。",
      "每個人的作息與飲食習慣不同。選擇容易準備、能融入日常的方式，並依產品說明安排，比一次做得複雜更容易持續。"
    ),
  },
].map((item) => ({
  ...item,
  imageUrl: `${IMAGE_BASE}/${item.image}`,
}));

function applyApprovedPosts(readStore, writeStore) {
  const store = readStore();
  store.posts = Array.isArray(store.posts) ? store.posts : [];
  const candidates = store.posts
    .filter((post) => post.campaignId === CAMPAIGN_ID && !["published", "cancelled"].includes(post.status))
    .sort((a, b) => new Date(a.scheduledAt || 0) - new Date(b.scheduledAt || 0));

  let updated = 0;
  APPROVED_POSTS.forEach((approved, index) => {
    const post = candidates[index];
    if (!post) return;
    const next = {
      approvedSeriesId: SERIES_ID,
      approvedImageKey: approved.key,
      title: approved.title,
      knowledgeTopic: approved.knowledgeTopic,
      imageUrl: approved.imageUrl,
      instagramCaption: approved.instagramCaption,
      facebookCaption: approved.facebookCaption,
    };
    let changed = false;
    Object.entries(next).forEach(([key, value]) => {
      if (post[key] !== value) {
        post[key] = value;
        changed = true;
      }
    });
    if (changed) {
      post.updatedAt = new Date().toISOString();
      updated += 1;
    }
  });

  if (updated) writeStore(store);
  return {
    version: VERSION,
    seriesId: SERIES_ID,
    available: APPROVED_POSTS.length,
    candidates: candidates.length,
    updated,
  };
}

module.exports = {
  VERSION,
  SERIES_ID,
  APPROVED_POSTS,
  applyApprovedPosts,
};
