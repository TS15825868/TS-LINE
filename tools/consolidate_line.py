from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
VERSION = "299.1"


def replace_once(text, pattern, replacement, label):
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.M)
    if count != 1:
        raise SystemExit(f"replacement failed: {label}")
    return updated


def main():
    data_path = ROOT / "data.json"
    data = json.loads(data_path.read_text(encoding="utf-8"))
    data["version"] = VERSION
    data["siteUrl"] = data.get("siteUrl") or "https://ts15825868.github.io/xianjiawei/"
    data["orderNotice"] = "全系列已開放詢問與下單；實際庫存與出貨時間由客服確認。"
    data["medicalReferral"] = {
        "doctor": "章無忌中醫師",
        "lineId": "@changwuchi",
        "url": "https://lin.ee/1MK4NR9",
    }
    data.setdefault("classics", {})["huangdiNeijing"] = {
        "title": "《黃帝內經》｜日常生活觀點",
        "usage": "仙加味引用《黃帝內經》時，著重古代對飲食有節、起居有常與順應四時的生活觀點。",
        "sourceUrl": "https://ts15825868.github.io/xianjiawei/sources.html",
    }
    data_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    server_path = ROOT / "server.js"
    source = server_path.read_text(encoding="utf-8")
    source = source.replace("仙加味 LINE OA Bot v299.0", "仙加味 LINE OA Bot v299.1")
    source = source.replace('const VERSION = "v299.0";', 'const VERSION = "v299.1";')

    old_save = '''async function saveCRM(payload) {
  if (!CRM_URL) return {};
  try {
    const response = await fetch(CRM_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return await response.json().catch(() => ({}));
  } catch (error) {
    console.error("CRM 寫入失敗：", error.message);
    return {};
  }
}'''
    new_save = '''async function saveCRM(payload) {
  if (!CRM_URL) return { ok: false, error: "CRM_URL is not configured" };
  try {
    const response = await fetch(CRM_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: `CRM HTTP ${response.status}`, ...result };
    return typeof result.ok === "boolean" ? result : { ok: true, ...result };
  } catch (error) {
    console.error("CRM 寫入失敗：", error.message);
    return { ok: false, error: error.message || "CRM request failed" };
  }
}'''
    if old_save not in source:
        raise SystemExit("saveCRM block not found")
    source = source.replace(old_save, new_save)

    old_phone = '''  if (checkout.step === "phone") {
    checkout.phone = text;
    checkout.step = "payment";'''
    new_phone = '''  if (checkout.step === "phone") {
    const phone = text.replace(/[^0-9]/g, "");
    if (!/^(09\\d{8}|0\\d{8,10})$/.test(phone)) {
      return reply(event.replyToken, textMsg("電話格式不完整，請輸入台灣手機或市內電話，例如 0912345678。", [{ label: "取消", text: "取消" }]));
    }
    checkout.phone = phone;
    checkout.step = "payment";'''
    if old_phone not in source:
        raise SystemExit("phone checkout block not found")
    source = source.replace(old_phone, new_phone)

    old_result = '''    const result = await saveCRM(payload);
    const orderId = result.orderId || result.order_id || "";
    state.cart = [];
    state.checkout = null;

    return reply('''
    new_result = '''    const result = await saveCRM(payload);
    if (!result.ok) {
      return reply(
        event.replyToken,
        flexCard(
          "訂單暫未送出",
          "訂單資料已保留，但系統目前無法寫入訂單。請稍後再按確認送出，或選擇人工客服協助。",
          [
            { label: "再次送出", text: "確認送出" },
            { label: "人工客服", text: "我要人工客服" },
            { label: "取消", text: "取消" },
          ]
        )
      );
    }
    const orderId = result.orderId || result.order_id || "";
    state.cart = [];
    state.checkout = null;

    return reply('''
    if old_result not in source:
        raise SystemExit("CRM result block not found")
    source = source.replace(old_result, new_result)

    doctor_pattern = re.compile(r"function doctorReferralReply\(\) \{[\s\S]*?\n\}\n\nfunction huangdiNeijingReply", re.M)
    doctor_replacement = '''function doctorReferralReply() {
  const referral = DATA.medicalReferral || {};
  const doctor = referral.doctor || "章無忌中醫師";
  const lineId = referral.lineId || "@changwuchi";
  const url = referral.url || "https://lin.ee/1MK4NR9";
  return flexCard(
    "個人狀況｜轉介中醫師諮詢",
    `這部分會因每個人的身體狀況不同，為了讓您得到更準確的說明與建議，建議先由合作的中醫師了解您的情況🙂\n\n✔ 專人一對一說明\n✔ 可詢問適不適合食用\n✔ 可詢問個人狀況與疑問\n\nLINE ID：${lineId}\n${doctor}`,
    [
      { label: "前往中醫師諮詢", uri: url },
      { label: "查看產品資訊", text: "看產品" },
      { label: "人工客服", text: "我要人工客服" },
    ]
  );
}

function huangdiNeijingReply'''
    source, count = doctor_pattern.subn(doctor_replacement, source, count=1)
    if count != 1:
        raise SystemExit("doctor referral consolidation failed")

    neijing_pattern = re.compile(r"function huangdiNeijingReply\(\) \{[\s\S]*?\n\}\n\nfunction brandStoryReply", re.M)
    neijing_replacement = '''function huangdiNeijingReply() {
  const classic = DATA.classics?.huangdiNeijing || {};
  return flexCard(
    classic.title || "《黃帝內經》｜日常生活觀點",
    `${classic.usage || "仙加味以生活文化方式整理《黃帝內經》的飲食、作息與四時觀點。"}\n\n這一層用來理解日常補養的節奏；《本草綱目》用於理解成分名稱與本草文化，現代藥典則用於理解正式品名與品質規格。產品資訊仍以實際成分、規格、保存與使用方式為準。`,
    [
      { label: "查看資料來源", uri: classic.sourceUrl || absoluteUrl("sources.html") },
      { label: "查看漢方百科", uri: absoluteUrl("hanfang-baike.html") },
      { label: "詢問日常安排", text: "幫我推薦" },
    ]
  );
}

function brandStoryReply'''
    source, count = neijing_pattern.subn(neijing_replacement, source, count=1)
    if count != 1:
        raise SystemExit("neijing consolidation failed")

    listen_pattern = re.compile(r"const port = process\.env\.PORT \|\| 3000;\napp\.listen\(port, \(\) => console\.log\(`仙加味 LINE OA \$\{VERSION\} running on \$\{port\}`\)\);\s*$")
    listen_replacement = '''const port = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(port, () => console.log(`仙加味 LINE OA ${VERSION} running on ${port}`));
}

module.exports = {
  app,
  DATA,
  VERSION,
  getProduct,
  detectProduct,
  calcItem,
  addCart,
  cartTotal,
  productCarousel,
  priceCarousel,
  recommendReply,
  comboReply,
  usageChooserReply,
  usageReply,
  doctorReferralReply,
  huangdiNeijingReply,
  brandStoryReply,
  isSensitiveHealthQuestion,
};
'''
    source, count = listen_pattern.subn(listen_replacement, source, count=1)
    if count != 1:
        raise SystemExit("listen/export block replacement failed")

    server_path.write_text(source, encoding="utf-8")

    package_path = ROOT / "package.json"
    package = json.loads(package_path.read_text(encoding="utf-8"))
    package["name"] = "xianjiawei-lineoa"
    package["version"] = "2.11.1"
    package["main"] = "server.js"
    package.setdefault("scripts", {})["start"] = "node server.js"
    package["scripts"]["test"] = "node test.js"
    package["description"] = "仙加味 LINE OA｜產品、購物車、結帳、品牌故事、使用方式與敏感問題轉介"
    package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    for name in ("start.js", "start-v298-5.js", "google_apps_script_v110.js"):
        path = ROOT / name
        if path.exists():
            path.unlink()
    for pattern in (".server-*-runtime.js", "TRIGGER_*.txt", "CLEANUP_*.txt", "CONSOLIDATE_*.txt"):
        for path in ROOT.glob(pattern):
            path.unlink()


if __name__ == "__main__":
    main()
