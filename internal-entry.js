"use strict";

const bridge = require("./supabase-state-bridge");
const { installPersistenceAutoSave } = require("./persistence-auto-save");
const { mountClientFix } = require("./internal-app-client-fix");
const { mountUpload } = require("./internal-social-upload");
const { seedInventory } = require("./internal-inventory-seed");
const { rebuildReservations } = require("./internal-reservation-rebuild");
const { mountOperationsSuite } = require("./internal-operations-suite");
const { displayCart, expandCart } = require("./line-order-cart");
const { seedSocialDraftLibraryWeekly } = require("./social-draft-library-weekly");
const {
  VERSION: SOCIAL_PLATFORM_STATUS_VERSION,
  normalizeSocialPlatformStatus,
  wrapExecute: wrapSocialExecute,
} = require("./social-platform-status");
const {
  mountLineOrderSync,
  applyOrderTransition,
  notifyOrder,
} = require("./internal-line-order-sync");

async function main() {
  const restore = await bridge.restoreAll();
  if (restore.enabled) console.log("Supabase state restore", restore);
  else console.warn("Supabase state bridge disabled; using local JSON fallback");

  installPersistenceAutoSave();

  const {
    mountInternalApp,
    APP_VERSION,
    readStore,
    writeStore,
  } = require("./internal-app");

  const originalFetch = global.fetch;
  const crmUrl = String(
    process.env.CRM_URL ||
      "https://script.google.com/macros/s/AKfycbwAFBxeROd2ZYGJ_h0O7_H2MMxptOMoj3EXIErZpbKuTYFOzOVwQkrk8X1MoxapkHVGSA/exec"
  );

  if (typeof originalFetch === "function") {
    global.fetch = async function xianjiaweiFetch(input, init = {}) {
      const response = await originalFetch(input, init);
      try {
        const url = typeof input === "string" ? input : input?.url || "";
        const method = String(init.method || "GET").toUpperCase();
        if (url === crmUrl && method === "POST" && response.ok && init.body) {
          const payload = JSON.parse(String(init.body));
          const result = await response.clone().json().catch(() => ({}));
          const store = readStore();
          const externalId = String(result.orderId || result.order_id || "");
          const duplicate = store.orders.some(
            (item) =>
              (externalId && item.externalId === externalId) ||
              (payload.createdAt &&
                item.sourceCreatedAt === payload.createdAt &&
                item.lineUserId === payload.userId)
          );

          if (!duplicate) {
            const orderLines = expandCart(payload.cart || []);
            const items = displayCart(payload.cart || []);

            const order = {
              id: `ord-line-${Date.now().toString(36)}`,
              externalId,
              source: "LINE OA",
              sourceCreatedAt: payload.createdAt || new Date().toISOString(),
              lineUserId: payload.userId || "",
              customerName: payload.name || "LINE 客戶",
              phone: payload.phone || "",
              items,
              orderLines,
              total: Number(payload.total || 0),
              payment: payload.payment || "",
              shipping: payload.shipping || "",
              address: payload.address || "",
              status: "新訂單",
              note: [payload.payment, payload.shipping, payload.address]
                .filter(Boolean)
                .join("｜"),
              createdAt: payload.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            store.orders.push(order);

            if (
              payload.phone &&
              !store.customers.some((item) => item.phone === payload.phone)
            ) {
              store.customers.push({
                id: `cus-line-${Date.now().toString(36)}`,
                name: payload.name || "LINE 客戶",
                phone: payload.phone,
                lineId: payload.userId || "",
                interests: items,
                note: "由 LINE OA 訂單自動建立",
                createdAt: payload.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }

            applyOrderTransition(store, null, order, "LINE OA");
            store.activities.push({
              id: `act-line-${Date.now().toString(36)}`,
              actor: "LINE OA",
              action: "自動匯入訂單",
              detail: `${payload.name || "LINE 客戶"}｜${
                externalId || "未提供訂單編號"
              }`,
              createdAt: new Date().toISOString(),
            });
            writeStore(store);
            notifyOrder(store, null, order)
              .then(() => writeStore(store))
              .catch((error) => console.error("LINE order confirmation sync failed", error.message));
          }
        }
      } catch (error) {
        console.error("internal order mirror failed", error.message);
      }
      return response;
    };
  }

  const {
    app,
    execute: baseExecuteSocialPost,
    healthPayload,
    readStore: readSocialStore,
    writeStore: writeSocialStore,
  } = require("./social-server");
  const executeSocialPost = wrapSocialExecute(
    baseExecuteSocialPost,
    readSocialStore,
    writeSocialStore
  );

  mountClientFix(app);
  mountUpload(app);
  mountOperationsSuite(app, {
    readStore,
    writeStore,
    readSocialStore,
    writeSocialStore,
    bridge,
  });
  mountLineOrderSync(app, { readStore, writeStore });
  mountInternalApp(app, {
    social: {
      execute: executeSocialPost,
      healthPayload,
      readStore: readSocialStore,
      writeStore: writeSocialStore,
    },
  });

  const inventorySeed = seedInventory(readStore, writeStore);
  console.log("Internal inventory catalog synchronization", inventorySeed);
  const reservationRebuild = rebuildReservations(readStore, writeStore);
  console.log("Internal reserved inventory rebuild", reservationRebuild);
  const socialDraftSeed = seedSocialDraftLibraryWeekly(readSocialStore, writeSocialStore);
  console.log("Social weekly draft library synchronization", socialDraftSeed);
  const socialStatusNormalize = normalizeSocialPlatformStatus(readSocialStore, writeSocialStore);
  console.log("Social platform status reconciliation", socialStatusNormalize);

  app.get("/internal/db-healthz", (_req, res) => {
    const state = bridge.health();
    res.status(state.enabled && !state.connected ? 503 : 200).json({
      ok: !state.enabled || state.connected,
      service: "仙加味 Supabase persistence",
      ...state,
      checkedAt: new Date().toISOString(),
    });
  });

  writeStore(readStore());
  writeSocialStore(readSocialStore());
  bridge.startWatching();

  if (bridge.health().enabled) {
    const startupSync = await bridge.syncAll();
    console.log("Supabase startup synchronization", startupSync);
  }

  const socialStatusTimer = setInterval(() => {
    try {
      normalizeSocialPlatformStatus(readSocialStore, writeSocialStore);
    } catch (error) {
      console.error("social platform status reconciliation failed", error.message);
    }
  }, 15 * 1000);
  socialStatusTimer.unref?.();

  const maintenanceTimer = setInterval(async () => {
    const result = await bridge.syncAll();
    if (result.enabled) console.log("Supabase periodic synchronization", result);
  }, 10 * 60 * 1000);
  maintenanceTimer.unref?.();

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    const health = typeof healthPayload === "function" ? healthPayload() : {};
    console.log(
      `仙加味 LINE OA + internal app ${APP_VERSION} running on ${port}`,
      {
        lineVersion: health.lineVersion,
        socialVersion: health.socialVersion,
        storage: bridge.health().storage,
        operationsVersion: "1.0.0",
        orderSyncVersion: "1.0.2",
        socialPlatformStatusVersion: SOCIAL_PLATFORM_STATUS_VERSION,
        socialDraftCampaign: socialDraftSeed.campaignId,
        socialDraftCadence: socialDraftSeed.cadence,
        socialDraftTimezone: socialDraftSeed.timezone,
        socialDraftsAdded: socialDraftSeed.added,
        socialDraftsUpdated: socialDraftSeed.updated,
        socialDraftsPreserved: socialDraftSeed.preserved,
        socialDraftsTotal: socialDraftSeed.total,
      }
    );
  });
}

main().catch((error) => {
  console.error("Application startup failed", error);
  process.exit(1);
});