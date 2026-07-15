"use strict";

const mountedApps = new WeakSet();
const VERSION = "1.0.0";

function browserScript() {
  return `(()=>{"use strict";const file=document.getElementById("socialImageFile"),button=document.getElementById("socialImageUploadBtn"),status=document.getElementById("socialImageStatus"),url=document.getElementById("socialImageUrl"),form=document.getElementById("socialForm"),preview=document.getElementById("socialImagePreview");if(!file||!button||!status||!url||!form)return;const submitButtons=[...form.querySelectorAll('button[type="submit"],input[type="submit"]')];let pending=null;let resubmitting=false;function hasUrl(){return /^https:\/\//i.test(String(url.value||"").trim())}function setBusy(busy){submitButtons.forEach(node=>{node.disabled=busy;node.style.opacity=busy?".6":""});if(busy){status.textContent="正在自動處理並上傳照片，完成後才能建立草稿";status.style.color="#6b655d"}}function waitForResult(){if(hasUrl())return Promise.resolve(url.value);if(pending)return pending;pending=new Promise((resolve,reject)=>{let ticks=0;const timer=setInterval(()=>{ticks+=1;if(hasUrl()){clearInterval(timer);pending=null;setBusy(false);status.textContent="✓ 照片已上傳，可以建立待審草稿";status.style.color="#315c45";resolve(url.value);return}const message=String(status.textContent||"");if(/失敗|錯誤|不支援|無法/.test(message)){clearInterval(timer);pending=null;setBusy(false);reject(new Error(message));return}if(ticks>=150){clearInterval(timer);pending=null;setBusy(false);reject(new Error("照片上傳逾時，請按『重新上傳照片』再試一次"))}},200)});return pending}function startUpload(){const selected=file.files&&file.files[0];if(!selected)return Promise.reject(new Error("請先選擇照片"));if(hasUrl())return Promise.resolve(url.value);setBusy(true);button.textContent="上傳中…";button.click();return waitForResult().finally(()=>{button.textContent="重新上傳照片"})}file.addEventListener("change",()=>{url.value="";const selected=file.files&&file.files[0];if(!selected)return;status.textContent="已選擇照片，正在自動上傳…";status.style.color="#6b655d";setTimeout(()=>{startUpload().catch(error=>{setBusy(false);status.textContent=error.message||"照片上傳失敗";status.style.color="#8d2024"})},80)},true);button.textContent="重新上傳照片";status.textContent="選擇照片後會自動壓縮並上傳";document.addEventListener("submit",async event=>{if(event.target!==form||resubmitting)return;const instagram=form.querySelector('[name="publishInstagram"]');if(!instagram||!instagram.checked||hasUrl())return;event.preventDefault();event.stopImmediatePropagation();const selected=file.files&&file.files[0];if(!selected){alert("Instagram 需要照片，請先從相簿或檔案選擇一張圖片");return}try{await startUpload();resubmitting=true;form.requestSubmit();setTimeout(()=>{resubmitting=false},0)}catch(error){alert(error.message||"照片上傳失敗")}},true);url.addEventListener("input",()=>{if(hasUrl()){setBusy(false);status.textContent="✓ 已取得公開 HTTPS 圖片網址";status.style.color="#315c45";if(preview){preview.src=url.value;preview.hidden=false}}});})();`;
}

function inject(html) {
  if (typeof html !== "string" || !html.includes("仙加味內部管理 App")) return html;
  if (html.includes("/internal/social-auto-upload.js")) return html;
  return html.replace("</body>", `<script src="/internal/social-auto-upload.js?v=${VERSION}"></script></body>`);
}

function mountSocialAutoUpload(app) {
  if (!app || mountedApps.has(app)) return;
  mountedApps.add(app);

  app.get("/internal/social-auto-upload.js", (_req, res) => {
    res.set({
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/javascript; charset=utf-8",
    }).send(browserScript());
  });

  app.use("/internal/app", (_req, res, next) => {
    const originalSend = res.send.bind(res);
    res.send = (body) => originalSend(inject(body));
    next();
  });
}

module.exports = { VERSION, browserScript, inject, mountSocialAutoUpload };