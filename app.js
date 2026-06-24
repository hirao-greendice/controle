import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  runTransaction,
  serverTimestamp as firestoreServerTimestamp,
  setDoc,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import {
  getDatabase,
  onDisconnect,
  onValue,
  ref as databaseRef,
  remove,
  serverTimestamp as databaseServerTimestamp,
  set,
  update,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBndRAFwPD0p8unwEpCCnFC8FRX8VzjvdI",
  authDomain: "control-c7b48.firebaseapp.com",
  databaseURL: "https://control-c7b48-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "control-c7b48",
  storageBucket: "control-c7b48.firebasestorage.app",
  messagingSenderId: "385752167772",
  appId: "1:385752167772:web:a021c7e6eb3de695063d99",
  measurementId: "G-HS4NZ6T91H",
};

const TEAM_COUNT = 10;
const STAFF_TEAM_GROUPS = Object.freeze({
  first: Object.freeze([1, 2, 3, 4, 5]),
  second: Object.freeze([6, 7, 8, 9, 10]),
});
const STEP_LABELS = Object.freeze([
  "1-1",
  "2-1",
  "2-2",
  "3-1",
  "3-2",
  "4-1",
  "4-2",
  "5-1",
  "6-1",
]);
const STEP_COUNT = STEP_LABELS.length;
const STEP_31_INDEX = STEP_LABELS.indexOf("3-1") + 1;
const STEP_32_INDEX = STEP_LABELS.indexOf("3-2") + 1;
const STEP_41_INDEX = STEP_LABELS.indexOf("4-1") + 1;
const STEP_NOTES = Object.freeze({
  "1-1": "懐中時計",
  "2-1": "フラミンゴ",
  "2-2": "白鳥",
  "3-1": "マンガorマンタ",
  "3-2": "ボタン開＆マンタ",
  "4-1": "マイナスドライバー",
  "4-2": "マドラー",
  "5-1": "鉛筆＆ラッパ",
  "6-1": "ゲームクリア",
});
// そのSTEPから先へ進める時、巨人スタッフへ依頼する作業内容を設定します。
// 例: "2-1": "机の上にフラミンゴを置く",
const DESK_TASKS = Object.freeze({
  "1-1": "消しゴム増やせ",
  "2-1": "チーム番号札切れ",
  "2-2": "チーム番号札取り除け",
  "4-2": "イス倒せ",
});
const DESK_TASK_STEPS = Object.freeze(
  Object.keys(DESK_TASKS).map((stepLabel) => STEP_LABELS.indexOf(stepLabel) + 1),
);
const DESK_TASK_NAMES = Object.freeze({
  "1-1": "消しゴム",
  "2-1": "番号札を切る",
  "2-2": "番号札を外す",
  "4-2": "イス",
});
const CAMERA_COUNT = 9;
const CAMERA_FRAME_STEPS = Object.freeze({
  1: STEP_LABELS,
  2: ["1-1", "3-1", "5-1", "6-1"],
  3: ["1-1", "5-1", "6-1"],
  4: ["2-1", "3-1", "5-1", "6-1"],
  5: ["3-1", "5-1", "6-1"],
  6: ["3-1", "5-1", "6-1"],
  7: ["4-1", "5-1", "6-1"],
  8: ["5-1", "6-1"],
  9: ["5-1", "6-1"],
});
const CAMERA_UNLOCK_STEP_LABELS = Object.freeze({
  1: "1-1",
  2: "1-1",
  3: "1-1",
  4: "2-1",
  5: "3-1",
  6: "3-1",
  7: "4-1",
  8: "5-1",
  9: "5-1",
});
const MAP_CAMERA_LAYERS = Object.freeze({
  A: [
    { step: "1-1", asset: "Map_Camera_A_1-1.png" },
    { step: "5-1", asset: "Map_Camera_A_5-1.png" },
  ],
  B: [
    { step: "1-1", asset: "Map_Camera_B_1-1.png" },
    { step: "2-1", asset: "Map_Camera_B_2-1.png" },
    { step: "3-1", asset: "Map_Camera_B_3-1.png" },
    { step: "4-1", asset: "Map_Camera_B_4-1.png" },
  ],
});
const STEP_POPUPS = Object.freeze({
  "2-1": "Pop_2-1.png",
  "3-1": "Pop_3-1.png",
  "4-1": "Pop_4-1.png",
  "5-1": "Pop_5-1.png",
  "6-1": "Pop_6-1.png",
});
const STEP_LOGS = Object.freeze({
  "2-1": ["Log_01.png", "Log_02.png"],
  "2-2": ["Log_03.png", "Log_04.png"],
  "3-1": ["Log_05.png", "Log_06.png", "Log_07.png", "Log_08.png"],
  "3-2": ["Log_09.png", "Log_10.png"],
  "5-1": [
    "Log_11.png",
    "Log_12.png",
    "Log_13.png",
    "Log_14.png",
    "Log_15.png",
    "Log_16.png",
    "Log_17.png",
    "Log_18.png",
    "Log_19.png",
    "Log_20.png",
    "Log_21.png",
    "Log_22.png",
    "Log_23.png",
    "Log_24.png",
  ],
  "6-1": ["Log_25.png", "Log_26.png", "Log_27.png", "Log_28.png"],
});
const PRESENCE_ROOT = "control/presence";
const GAME_STATE_PATH = "control/game";
const PRESENCE_HEARTBEAT_INTERVAL_MS = 5000;
const PRESENCE_RETRY_DELAY_MS = 3000;
const PRESENCE_STALE_AFTER_MS = 20000;
const STAFF_PRESENCE_CHECK_INTERVAL_MS = 5000;
const PLAYER_CLICK_VOLUME = 0.5;
const STAFF_CLEAR_VOLUME = 1.0;
const STAFF_SUZU_VOLUME = 1.0;
const ASSET_CACHE_CONFIG = globalThis.CONTROL_ASSET_CACHE;
const ASSET_CACHE_NAME = ASSET_CACHE_CONFIG
  ? `${ASSET_CACHE_CONFIG.cachePrefix}${ASSET_CACHE_CONFIG.version}`
  : null;
const ASSET_CACHE_VERSION_KEY = "control-asset-cache-version";
const ASSET_CACHE_URL_PARAM = "v";
const ASSET_PRELOAD_CONCURRENCY = 6;
const APPLICATION_VERSION_CHECK_INTERVAL_MS = 15000;

const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);
const realtimeDatabase = getDatabase(app);

const stage = document.querySelector("#stage");
const clientId = getClientId();

let route = readRoute();
let rtdbConnected = null;
let activePresence = null;
let presenceHeartbeatTimer = null;
let presenceRetryTimer = null;
let presenceSequence = 0;
let renderSequence = 0;
let viewCleanups = [];
let toastTimer = null;
let assetsReady = false;
let assetPreloadProgress = {
  completed: 0,
  total:
    (ASSET_CACHE_CONFIG?.coreAssets?.length ?? 0) +
    (ASSET_CACHE_CONFIG?.mediaAssets?.length ?? 0),
  label: "準備中",
};

resizeStage();
window.addEventListener("resize", resizeStage);
document.addEventListener("fullscreenchange", resizeStage);
document.addEventListener("webkitfullscreenchange", resizeStage);
window.addEventListener("popstate", () => {
  route = readRoute();
  if (route.mode === "home") exitFullscreen();
  renderRoute();
});
window.addEventListener("focus", refreshPresenceNow);
window.addEventListener("online", refreshPresenceNow);
window.addEventListener("pageshow", refreshPresenceNow);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshPresenceNow();
});
document.addEventListener("gesturestart", preventPageZoom, { passive: false });
document.addEventListener("gesturechange", preventPageZoom, { passive: false });
document.addEventListener("gestureend", preventPageZoom, { passive: false });
document.addEventListener(
  "touchmove",
  (event) => {
    if (event.touches.length > 1) preventPageZoom(event);
  },
  { passive: false },
);
window.addEventListener("keydown", (event) => {
  const step32SkipConfirmation = stage.querySelector("#step-32-skip-confirm");
  if (event.key === "Escape" && step32SkipConfirmation) {
    step32SkipConfirmation.querySelector('[data-step-skip-confirm="no"]')?.click();
    return;
  }

  const confirmation = stage.querySelector("#game-confirm:not([hidden])");
  if (event.key === "Escape" && confirmation) {
    confirmation.querySelector('[data-game-confirm="no"]')?.click();
    return;
  }

  if (event.key === "Escape" && route.mode !== "home") {
    navigate({ mode: "home" });
  }
});
onValue(
  databaseRef(realtimeDatabase, ".info/connected"),
  (snapshot) => {
    rtdbConnected = snapshot.val() === true;
    updateConnectionBadges();

    if (rtdbConnected) {
      registerPresence();
    }
  },
  (error) => {
    rtdbConnected = false;
    updateConnectionBadges();
    showToast(`RTDBの接続確認に失敗しました: ${error.message}`);
  },
);

bootstrapApplication();
startApplicationVersionWatcher();

function preventPageZoom(event) {
  event.preventDefault();
}

async function bootstrapApplication() {
  if (route.mode === "home") {
    await renderRoute();
  } else {
    renderAssetLoadingScreen();
  }

  let preloadError = null;
  try {
    await prepareApplicationAssets();
  } catch (error) {
    preloadError = error;
    console.error("Asset preload failed:", error);
  }

  assetsReady = true;

  if (route.mode === "home") {
    finishHomeAssetLoading(preloadError);
  } else {
    await renderRoute();
    if (preloadError) {
      showToast(`一部素材の事前読込に失敗しました: ${preloadError.message}`);
    }
  }
}

function renderAssetLoadingScreen() {
  stage.innerHTML = `
    <section class="screen asset-loading-screen">
      ${assetLoadingPanelMarkup()}
    </section>
  `;
  updateAssetLoadingProgress(assetPreloadProgress);
}

function assetLoadingPanelMarkup() {
  const version = ASSET_CACHE_CONFIG?.version ?? "unknown";
  return `
    <div class="asset-loading-panel" data-asset-loading-panel>
      <p class="eyebrow">SYSTEM PREPARATION</p>
      <h2>素材を読み込んでいます</h2>
      <p class="asset-loading-label" data-asset-loading-label>準備中</p>
      <div class="asset-loading-track">
        <div class="asset-loading-bar" data-asset-loading-bar></div>
      </div>
      <div class="asset-loading-count">
        <span data-asset-loading-count>0 / ${assetPreloadProgress.total}</span>
        <span>VERSION ${version}</span>
      </div>
    </div>
  `;
}

function updateAssetLoadingProgress(progress) {
  assetPreloadProgress = progress;
  const percent =
    progress.total > 0
      ? Math.min(100, Math.round((progress.completed / progress.total) * 100))
      : 100;

  document.querySelectorAll("[data-asset-loading-bar]").forEach((bar) => {
    bar.style.width = `${percent}%`;
  });
  document.querySelectorAll("[data-asset-loading-label]").forEach((label) => {
    label.textContent = progress.label;
  });
  document.querySelectorAll("[data-asset-loading-count]").forEach((count) => {
    count.textContent = `${progress.completed} / ${progress.total}`;
  });
}

function finishHomeAssetLoading(error) {
  stage.querySelectorAll(
    ".home-team-button, #open-staff-first, #open-staff-second, #open-master, #open-giant",
  ).forEach((button) => {
    button.disabled = false;
  });

  const panel = stage.querySelector("[data-asset-loading-panel]");
  if (panel) panel.remove();

  if (error) {
    showToast(`一部素材の事前読込に失敗しました: ${error.message}`);
  }
}

async function prepareApplicationAssets() {
  if (
    !ASSET_CACHE_CONFIG ||
    !Array.isArray(ASSET_CACHE_CONFIG.coreAssets) ||
    !Array.isArray(ASSET_CACHE_CONFIG.mediaAssets)
  ) {
    throw new Error("素材キャッシュ設定を読み込めません");
  }

  await registerAssetServiceWorker();

  const allAssets = [
    ...ASSET_CACHE_CONFIG.coreAssets,
    ...ASSET_CACHE_CONFIG.mediaAssets,
  ];
  const previousVersion = localStorage.getItem(ASSET_CACHE_VERSION_KEY);
  const versionChanged = previousVersion !== ASSET_CACHE_CONFIG.version;
  const cache =
    "caches" in window && ASSET_CACHE_NAME
      ? await caches.open(ASSET_CACHE_NAME)
      : null;
  let completed = 0;
  let nextAssetIndex = 0;

  updateAssetLoadingProgress({
    completed,
    total: allAssets.length,
    label: versionChanged ? "新しい素材を取得中" : "キャッシュを確認中",
  });

  const workers = Array.from(
    { length: Math.min(ASSET_PRELOAD_CONCURRENCY, allAssets.length) },
    async () => {
      while (nextAssetIndex < allAssets.length) {
        const asset = allAssets[nextAssetIndex];
        nextAssetIndex += 1;

        await cacheAndWarmAsset(asset, cache, versionChanged);
        completed += 1;
        updateAssetLoadingProgress({
          completed,
          total: allAssets.length,
          label: assetFileName(asset),
        });
      }
    },
  );

  await Promise.all(workers);

  if ("caches" in window && ASSET_CACHE_NAME) {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter(
          (name) =>
            name.startsWith(ASSET_CACHE_CONFIG.cachePrefix) &&
            name !== ASSET_CACHE_NAME,
        )
        .map((name) => caches.delete(name)),
    );
  }

  localStorage.setItem(ASSET_CACHE_VERSION_KEY, ASSET_CACHE_CONFIG.version);
  updateAssetLoadingProgress({
    completed: allAssets.length,
    total: allAssets.length,
    label: "読込完了",
  });
}

async function registerAssetServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (
    window.location.protocol !== "https:" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
  ) {
    return;
  }

  try {
    await navigator.serviceWorker.register("./service-worker.js", {
      scope: "./",
      updateViaCache: "none",
    });
    await navigator.serviceWorker.ready;
  } catch (error) {
    console.warn("Service Worker registration failed:", error);
  }
}

function startApplicationVersionWatcher() {
  if (!ASSET_CACHE_CONFIG?.version) return;

  let updateInProgress = false;
  const checkForUpdate = async () => {
    if (updateInProgress || document.visibilityState === "hidden") return;

    try {
      const configUrl = new URL("./asset-cache-config.js", window.location.href);
      configUrl.searchParams.set("update-check", String(Date.now()));
      const response = await fetch(configUrl, {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) return;

      const source = await response.text();
      const latestVersion = source.match(/\bversion:\s*"([^"]+)"/)?.[1];
      if (
        latestVersion &&
        latestVersion !== ASSET_CACHE_CONFIG.version
      ) {
        updateInProgress = true;
        window.location.reload();
      }
    } catch {
      // The regular connection indicators handle offline state.
    }
  };

  window.setInterval(checkForUpdate, APPLICATION_VERSION_CHECK_INTERVAL_MS);
  window.addEventListener("focus", checkForUpdate);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkForUpdate();
  });
}

async function cacheAndWarmAsset(asset, cache, forceReload) {
  const url = versionedAssetUrl(asset);
  const request = new Request(url, {
    cache: forceReload ? "reload" : "default",
    credentials: "same-origin",
  });
  let response = cache && !forceReload ? await cache.match(request) : null;

  if (!response) {
    response = await fetch(request);
    if (!response.ok) {
      throw new Error(`${assetFileName(asset)} (${response.status})`);
    }
    if (cache) await cache.put(request, response.clone());
  }

  if (isImageAsset(asset)) {
    await decodeImageAsset(url);
  } else if (isAudioAsset(asset)) {
    await preloadAudioAsset(url);
  }
}

function versionedAssetUrl(asset) {
  const url = new URL(asset, window.location.href);
  if (ASSET_CACHE_CONFIG?.version) {
    url.searchParams.set(ASSET_CACHE_URL_PARAM, ASSET_CACHE_CONFIG.version);
  }
  return url.href;
}

function isImageAsset(asset) {
  return /\.(?:png|jpe?g|webp|gif|svg)$/i.test(asset);
}

function isAudioAsset(asset) {
  return /\.(?:mp3|wav|ogg)$/i.test(asset);
}

function decodeImageAsset(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`${assetFileName(url)}の画像展開に失敗しました`));
    image.src = url;

    image.decode?.().then(resolve).catch(() => {
      // Safariではdecode()が失敗してもonloadで正常に利用できる場合があります。
    });
  });
}

function preloadAudioAsset(url) {
  return new Promise((resolve) => {
    const audio = new Audio();
    let settled = false;
    const timeout = window.setTimeout(finish, 5000);

    function finish() {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      audio.removeEventListener("loadedmetadata", finish);
      audio.removeEventListener("canplay", finish);
      audio.removeEventListener("canplaythrough", finish);
      audio.removeEventListener("error", finish);
      resolve();
    }

    audio.preload = "auto";
    audio.addEventListener("loadedmetadata", finish, { once: true });
    audio.addEventListener("canplay", finish, { once: true });
    audio.addEventListener("canplaythrough", finish, { once: true });
    // iOS/Safari may reject media decoding before a user gesture even when the
    // complete audio file has already been fetched and cached successfully.
    // Playback is retried from the persistent cache when the user presses a
    // sound button, so this device-dependent warm-up failure is non-fatal.
    audio.addEventListener("error", finish, { once: true });
    audio.src = url;
    audio.load();
  });
}

function assetFileName(asset) {
  try {
    return (
      decodeURIComponent(
        new URL(asset, window.location.href).pathname.split("/").at(-1),
      ) || "ホーム画面"
    );
  } catch {
    return asset;
  }
}

function getClientId() {
  const saved = sessionStorage.getItem("control-client-id");
  if (saved) return saved;

  const generated =
    globalThis.crypto?.randomUUID?.() ??
    `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  sessionStorage.setItem("control-client-id", generated);
  return generated;
}

function resizeStage() {
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1200);
  document.documentElement.style.setProperty("--stage-scale", String(scale));
}

function readRoute() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  const staffGroup = params.get("group");
  const team = Number(params.get("team"));

  if (mode === "staff") {
    return {
      mode: "staff",
      staffGroup: staffGroup === "second" ? "second" : "first",
    };
  }
  if (mode === "master") return { mode: "master" };
  if (mode === "giant") return { mode: "giant" };
  if (mode === "player" && Number.isInteger(team) && team >= 1 && team <= TEAM_COUNT) {
    return { mode: "player", team };
  }
  return { mode: "home" };
}

function getFullscreenElement() {
  return document.fullscreenElement ?? document.webkitFullscreenElement ?? null;
}

function enterFullscreen() {
  if (getFullscreenElement()) return;

  const root = document.documentElement;
  const requestFullscreen = root.requestFullscreen ?? root.webkitRequestFullscreen;
  if (!requestFullscreen) return;

  try {
    const result = requestFullscreen.call(root);
    result?.catch?.(() => {
      // Fullscreen can be rejected when navigation was not triggered by a user action.
    });
  } catch {
    // Keep navigation working on browsers that do not permit fullscreen here.
  }
}

function exitFullscreen() {
  if (!getFullscreenElement()) return;

  const exit = document.exitFullscreen ?? document.webkitExitFullscreen;
  if (!exit) return;

  try {
    const result = exit.call(document);
    result?.catch?.(() => {});
  } catch {
    // Keep navigation working even if the browser refuses to exit fullscreen.
  }
}

function navigate(nextRoute) {
  if (nextRoute.mode === "home") {
    exitFullscreen();
  } else {
    enterFullscreen();
  }

  const url = new URL(window.location.href);
  url.search = "";

  if (nextRoute.mode === "staff") {
    url.searchParams.set("mode", "staff");
    url.searchParams.set(
      "group",
      nextRoute.staffGroup === "second" ? "second" : "first",
    );
  }

  if (nextRoute.mode === "master") {
    url.searchParams.set("mode", "master");
  }

  if (nextRoute.mode === "giant") {
    url.searchParams.set("mode", "giant");
  }

  if (nextRoute.mode === "player") {
    url.searchParams.set("mode", "player");
    url.searchParams.set("team", String(nextRoute.team));
  }

  history.pushState({}, "", url);
  route = nextRoute;
  renderRoute();
}

async function renderRoute() {
  const sequence = ++renderSequence;
  cleanupView();
  await clearPresence();
  if (sequence !== renderSequence) return;

  stage.replaceChildren();
  stage.classList.toggle("is-player", route.mode === "player");

  if (route.mode === "staff") {
    renderStaff(route.staffGroup);
  } else if (route.mode === "master") {
    renderMaster();
  } else if (route.mode === "giant") {
    renderGiantStaff();
  } else if (route.mode === "player") {
    renderPlayer(route.team);
  } else {
    renderHome();
  }

  updateConnectionBadges();
  if (rtdbConnected) registerPresence();
}

function cleanupView() {
  viewCleanups.forEach((cleanup) => cleanup());
  viewCleanups = [];
}

function renderHome() {
  const teamButtons = Array.from({ length: TEAM_COUNT }, (_, index) => {
    const team = index + 1;
    return `
      <button class="home-team-button" type="button" data-team="${team}"
        aria-label="チーム${team}のプレイヤー画面を開く"
        ${assetsReady ? "" : "disabled"}>${team}</button>
    `;
  }).join("");

  stage.innerHTML = `
    <section class="screen home-screen">
      <div class="home-corner-status">${connectionBadgeMarkup()}</div>
      <header class="home-header">
        <div class="home-title-wrap">
          <p class="eyebrow">TABLET CONTROL SYSTEM</p>
          <h1 class="home-title">CONTROL</h1>
          <p class="home-subtitle">SELECT TERMINAL</p>
        </div>
      </header>
      <div class="home-content">
        <div class="team-grid" aria-label="プレイヤーチーム選択">
          ${teamButtons}
        </div>
        <div class="mode-buttons">
          <button class="mode-button mode-button-staff" id="open-staff-first" type="button" ${assetsReady ? "" : "disabled"}>
            前半 STAFF
            <small>TEAM 01–05</small>
          </button>
          <button class="mode-button mode-button-staff" id="open-staff-second" type="button" ${assetsReady ? "" : "disabled"}>
            後半 STAFF
            <small>TEAM 06–10</small>
          </button>
          <button class="mode-button" id="open-master" type="button" ${assetsReady ? "" : "disabled"}>MASTER</button>
          <button class="mode-button mode-button-giant" id="open-giant" type="button" ${assetsReady ? "" : "disabled"}>
            巨人スタッフ
          </button>
        </div>
      </div>
      ${assetsReady ? "" : assetLoadingPanelMarkup()}
    </section>
  `;

  stage.querySelectorAll("[data-team]").forEach((button) => {
    button.addEventListener("click", () => {
      navigate({ mode: "player", team: Number(button.dataset.team) });
    });
  });
  stage.querySelector("#open-staff-first").addEventListener("click", () => {
    navigate({ mode: "staff", staffGroup: "first" });
  });
  stage.querySelector("#open-staff-second").addEventListener("click", () => {
    navigate({ mode: "staff", staffGroup: "second" });
  });
  stage.querySelector("#open-master").addEventListener("click", () => {
    navigate({ mode: "master" });
  });
  stage.querySelector("#open-giant").addEventListener("click", () => {
    navigate({ mode: "giant" });
  });
}

function renderStaff(staffGroup = "first") {
  const normalizedGroup = staffGroup === "second" ? "second" : "first";
  const teamNumbers = STAFF_TEAM_GROUPS[normalizedGroup];
  const groupLabel = normalizedGroup === "first" ? "前半" : "後半";
  const teamRangeLabel =
    normalizedGroup === "first" ? "TEAM 01–05" : "TEAM 06–10";

  stage.innerHTML = `
    <section class="screen staff-screen is-split-staff">
      <header class="staff-topbar">
        <div class="staff-brand">
          <button class="nav-button" id="staff-home" type="button">← HOME</button>
          <h1>${groupLabel} STAFF CONTROL</h1>
          <p class="eyebrow">${teamRangeLabel}</p>
        </div>
        <div class="staff-topbar-actions">${connectionBadgeMarkup()}</div>
      </header>

      <div class="staff-layout">
        <aside class="staff-sidebar">
          <div class="staff-sidebar-label">TEAM</div>
          <div class="active-team-list" id="active-team-list">
            <div class="empty-team-list">接続待機中</div>
          </div>
        </aside>

        <section class="staff-main">
          <div class="active-team-controls" id="active-team-controls"></div>
        </section>
      </div>

      <div class="staff-audio-panel" aria-label="スタッフ音声操作">
        <div class="staff-audio-label">
          <span>AUDIO CONTROL</span>
          <strong>この端末から再生</strong>
        </div>
        <button class="staff-audio-button is-clear" type="button" data-staff-audio="clear">
          正解音声
          <small>CLEAR</small>
        </button>
        <button class="staff-audio-button is-suzu" type="button" data-staff-audio="suzu">
          鈴音声
          <small>SUZU</small>
        </button>
        <audio data-staff-audio-source="clear" src="${versionedAssetUrl("./clear.mp3")}" preload="auto" playsinline></audio>
        <audio data-staff-audio-source="suzu" src="${versionedAssetUrl("./suzu.mp3")}" preload="auto" playsinline></audio>
      </div>
    </section>
  `;

  stage.querySelector("#staff-home").addEventListener("click", () => navigate({ mode: "home" }));
  setupStaffAudioControls();

  const state = {
    teamNumbers,
    activeTeams: [],
    presenceByTeam: {},
    serverTimeOffset: null,
    steps: new Map(),
    visitedStep32ByTeam: new Map(),
    deskTasks: new Map(),
    pendingTeams: new Set(),
  };

  const unsubscribePresence = onValue(
    databaseRef(realtimeDatabase, `${PRESENCE_ROOT}/players`),
    (snapshot) => {
      state.presenceByTeam = snapshot.val() ?? {};
      refreshStaffPresence(state);
    },
    (error) => showToast(`プレイヤー接続一覧を取得できません: ${error.message}`),
  );

  const unsubscribeServerTimeOffset = onValue(
    databaseRef(realtimeDatabase, ".info/serverTimeOffset"),
    (snapshot) => {
      const offset = snapshot.val();
      state.serverTimeOffset =
        typeof offset === "number" && Number.isFinite(offset) ? offset : null;
      refreshStaffPresence(state);
    },
    () => {
      state.serverTimeOffset = null;
    },
  );

  const presenceCheckTimer = window.setInterval(
    () => refreshStaffPresence(state),
    STAFF_PRESENCE_CHECK_INTERVAL_MS,
  );

  const unsubscribeTeams = onSnapshot(
    collection(firestore, "teams"),
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const team = Number(change.doc.id.replace("team-", ""));
        if (!Number.isInteger(team)) return;

        if (change.type === "removed") {
          state.steps.delete(team);
          state.visitedStep32ByTeam.delete(team);
          state.deskTasks.delete(team);
        } else {
          const teamData = change.doc.data();
          state.steps.set(team, normalizeStep(teamData.step));
          state.visitedStep32ByTeam.set(team, normalizeVisitedStep32(teamData));
          state.deskTasks.set(team, normalizeDeskTask(teamData));
        }
      });
      updateStaffView(state);
    },
    (error) => showToast(`FirestoreのSTEP監視に失敗しました: ${error.message}`),
  );

  viewCleanups.push(
    unsubscribePresence,
    unsubscribeServerTimeOffset,
    unsubscribeTeams,
    () => window.clearInterval(presenceCheckTimer),
  );
  updateStaffView(state);
}

function setupStaffAudioControls() {
  const audioSettings = {
    clear: {
      volume: STAFF_CLEAR_VOLUME,
      audio: stage.querySelector('[data-staff-audio-source="clear"]'),
    },
    suzu: {
      volume: STAFF_SUZU_VOLUME,
      audio: stage.querySelector('[data-staff-audio-source="suzu"]'),
    },
  };

  Object.values(audioSettings).forEach(({ audio, volume }) => {
    if (!audio) return;
    audio.volume = volume;
    audio.load();
  });

  const playStaffAudio = (event) => {
    const soundName = event.currentTarget.dataset.staffAudio;
    const setting = audioSettings[soundName];
    if (!setting?.audio) return;

    try {
      setting.audio.currentTime = 0;
    } catch {
      setting.audio.load();
    }

    const playResult = setting.audio.play();
    playResult?.catch?.((error) => {
      showToast(`音声を再生できません: ${error.message}`);
    });
  };

  const buttons = [...stage.querySelectorAll("[data-staff-audio]")];
  buttons.forEach((button) => {
    button.addEventListener("click", playStaffAudio);
  });

  viewCleanups.push(() => {
    buttons.forEach((button) => {
      button.removeEventListener("click", playStaffAudio);
    });
    Object.values(audioSettings).forEach(({ audio }) => {
      if (!audio) return;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    });
  });
}

function renderMaster() {
  stage.innerHTML = `
    <section class="screen master-screen">
      <header class="staff-topbar">
        <div class="staff-brand">
          <button class="nav-button" id="master-home" type="button">← HOME</button>
          <h1>MASTER</h1>
        </div>
        <div class="staff-topbar-actions">${connectionBadgeMarkup()}</div>
      </header>

      <div class="master-layout">
        <section class="master-team-panel" aria-labelledby="master-team-title">
          <div class="master-section-heading">
            <h2 id="master-team-title">チーム状況</h2>
            <div class="master-summary">
              <div class="master-online-count" id="master-online-count">接続 0 / ${TEAM_COUNT}</div>
              <div class="master-desk-count" id="master-desk-count">机依頼 0</div>
            </div>
          </div>
          <div class="master-team-grid" id="master-team-grid"></div>
        </section>

        <aside class="master-game-panel" aria-labelledby="master-game-title">
          <h2 id="master-game-title">公演状態</h2>
          <div class="master-game-status" id="master-game-status" data-status="idle">
            <strong>開始前</strong>
          </div>
          <div class="master-game-actions">
            <button class="master-game-button is-start" id="game-start" type="button">
              ゲーム開始
            </button>
            <button class="master-game-button is-end" id="game-end" type="button">
              ゲーム終了
            </button>
            <button class="master-game-button is-reset" id="progress-reset" type="button">
              RESET ALL
            </button>
          </div>
        </aside>
      </div>

      <div class="master-confirm-backdrop" id="game-confirm" hidden>
        <section
          class="master-confirm-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="game-confirm-title"
          aria-describedby="game-confirm-message"
        >
          <p class="eyebrow">CONFIRM OPERATION</p>
          <h2 id="game-confirm-title">確認</h2>
          <p id="game-confirm-message">この操作を実行しますか？</p>
          <div class="master-confirm-actions">
            <button class="master-confirm-button is-yes" type="button" data-game-confirm="yes">
              YES
            </button>
            <button class="master-confirm-button is-no" type="button" data-game-confirm="no">
              NO
            </button>
          </div>
        </section>
      </div>
    </section>
  `;

  stage.querySelector("#master-home").addEventListener("click", () => navigate({ mode: "home" }));

  const state = {
    activeTeams: [],
    presenceByTeam: {},
    serverTimeOffset: null,
    steps: new Map(),
    deskTasks: new Map(),
    gameStatus: "idle",
    pendingGameStatus: false,
    pendingProgressReset: false,
    confirmationAction: null,
    confirmationStatus: null,
  };

  const unsubscribePresence = onValue(
    databaseRef(realtimeDatabase, `${PRESENCE_ROOT}/players`),
    (snapshot) => {
      state.presenceByTeam = snapshot.val() ?? {};
      refreshMasterPresence(state);
    },
    (error) => showToast(`プレイヤー接続一覧を取得できません: ${error.message}`),
  );

  const unsubscribeServerTimeOffset = onValue(
    databaseRef(realtimeDatabase, ".info/serverTimeOffset"),
    (snapshot) => {
      const offset = snapshot.val();
      state.serverTimeOffset =
        typeof offset === "number" && Number.isFinite(offset) ? offset : null;
      refreshMasterPresence(state);
    },
    () => {
      state.serverTimeOffset = null;
    },
  );

  const presenceCheckTimer = window.setInterval(
    () => refreshMasterPresence(state),
    STAFF_PRESENCE_CHECK_INTERVAL_MS,
  );

  const unsubscribeTeams = onSnapshot(
    collection(firestore, "teams"),
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const team = Number(change.doc.id.replace("team-", ""));
        if (!Number.isInteger(team)) return;

        if (change.type === "removed") {
          state.steps.delete(team);
          state.deskTasks.delete(team);
        } else {
          const teamData = change.doc.data();
          state.steps.set(team, normalizeStep(teamData.step));
          state.deskTasks.set(team, normalizeDeskTask(teamData));
        }
      });
      updateMasterView(state);
    },
    (error) => showToast(`FirestoreのSTEP監視に失敗しました: ${error.message}`),
  );

  const unsubscribeGame = onValue(
    databaseRef(realtimeDatabase, GAME_STATE_PATH),
    (snapshot) => {
      state.gameStatus = normalizeGameStatus(snapshot.val()?.status);
      updateMasterView(state);
    },
    (error) => showToast(`ゲーム状態を取得できません: ${error.message}`),
  );

  stage.querySelector("#game-start").addEventListener("click", () => {
    openGameStatusConfirmation(state, "running");
  });
  stage.querySelector("#game-end").addEventListener("click", () => {
    openGameStatusConfirmation(state, "ended");
  });
  stage.querySelector("#progress-reset").addEventListener("click", () => {
    openProgressResetConfirmation(state);
  });
  stage.querySelector('[data-game-confirm="yes"]').addEventListener("click", () => {
    const confirmedAction = state.confirmationAction;
    const confirmedStatus = state.confirmationStatus;
    closeGameStatusConfirmation(state);
    if (confirmedAction === "progress-reset") {
      resetAllTeamProgress(state);
    } else if (confirmedStatus) {
      changeGameStatus(state, confirmedStatus);
    }
  });
  stage.querySelector('[data-game-confirm="no"]').addEventListener("click", () => {
    closeGameStatusConfirmation(state);
  });
  stage.querySelector("#game-confirm").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeGameStatusConfirmation(state);
  });

  viewCleanups.push(
    unsubscribePresence,
    unsubscribeServerTimeOffset,
    unsubscribeTeams,
    unsubscribeGame,
    () => window.clearInterval(presenceCheckTimer),
  );
  updateMasterView(state);
}

function renderGiantStaff() {
  stage.innerHTML = `
    <section class="screen master-screen giant-screen">
      <header class="staff-topbar">
        <div class="staff-brand">
          <button class="nav-button" id="giant-home" type="button">← HOME</button>
          <h1>巨人スタッフ</h1>
        </div>
        <div class="staff-topbar-actions">${connectionBadgeMarkup()}</div>
      </header>

      <section class="master-team-panel giant-team-panel" aria-labelledby="giant-team-title">
        <div class="giant-section-heading">
          <h2 id="giant-team-title">チーム</h2>
          <div class="giant-pending-count" id="giant-pending-count">依頼 0</div>
        </div>
        <div class="master-team-grid giant-team-grid" id="giant-team-grid"></div>
      </section>
    </section>
  `;

  stage.querySelector("#giant-home").addEventListener("click", () => navigate({ mode: "home" }));

  const state = {
    activeTeams: [],
    presenceByTeam: {},
    serverTimeOffset: null,
    deskTasks: new Map(),
    steps: new Map(),
    pendingTeams: new Set(),
  };

  const unsubscribePresence = onValue(
    databaseRef(realtimeDatabase, `${PRESENCE_ROOT}/players`),
    (snapshot) => {
      state.presenceByTeam = snapshot.val() ?? {};
      refreshGiantPresence(state);
    },
    (error) => showToast(`プレイヤー接続一覧を取得できません: ${error.message}`),
  );

  const unsubscribeServerTimeOffset = onValue(
    databaseRef(realtimeDatabase, ".info/serverTimeOffset"),
    (snapshot) => {
      const offset = snapshot.val();
      state.serverTimeOffset =
        typeof offset === "number" && Number.isFinite(offset) ? offset : null;
      refreshGiantPresence(state);
    },
    () => {
      state.serverTimeOffset = null;
    },
  );

  const presenceCheckTimer = window.setInterval(
    () => refreshGiantPresence(state),
    STAFF_PRESENCE_CHECK_INTERVAL_MS,
  );

  const unsubscribeTeams = onSnapshot(
    collection(firestore, "teams"),
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const team = Number(change.doc.id.replace("team-", ""));
        if (!Number.isInteger(team)) return;

        if (change.type === "removed") {
          state.deskTasks.delete(team);
          state.steps.delete(team);
        } else {
          const teamData = change.doc.data();
          const previousStep = state.steps.get(team);
          const currentStep = normalizeStep(teamData.step);
          const task = normalizeDeskTask(teamData);

          state.steps.set(team, currentStep);
          state.deskTasks.set(team, task);

          if (
            previousStep !== undefined &&
            currentStep > previousStep
          ) {
            const instruction = getConfiguredDeskTaskInstruction(previousStep);
            if (
              instruction &&
              !(
                task.status === "pending" &&
                task.step === previousStep &&
                task.instruction === instruction
              ) &&
              !(
                task.step === previousStep &&
                task.completedSteps.includes(previousStep)
              )
            ) {
              ensureDeskTaskForStepTransition(
                team,
                previousStep,
                currentStep,
                instruction,
              );
            }
          }
        }
      });
      updateGiantStaffView(state);
    },
    (error) => showToast(`机上作業の監視に失敗しました: ${error.message}`),
  );

  viewCleanups.push(
    unsubscribePresence,
    unsubscribeServerTimeOffset,
    unsubscribeTeams,
    () => window.clearInterval(presenceCheckTimer),
  );
  updateGiantStaffView(state);
}

async function ensureDeskTaskForStepTransition(
  team,
  triggerStep,
  observedStep,
  instruction,
) {
  const teamDocument = doc(firestore, "teams", teamDocumentId(team));

  try {
    await runTransaction(firestore, async (transaction) => {
      const snapshot = await transaction.get(teamDocument);
      if (!snapshot.exists()) return;

      const teamData = snapshot.data();
      if (normalizeStep(teamData.step) !== observedStep) return;

      const currentTask = normalizeDeskTask(teamData);
      if (
        currentTask.status === "pending" &&
        currentTask.step === triggerStep &&
        currentTask.instruction === instruction
      ) {
        return;
      }
      if (
        currentTask.step === triggerStep &&
        currentTask.completedSteps.includes(triggerStep)
      ) {
        return;
      }

      transaction.set(
        teamDocument,
        {
          deskTaskStatus: "pending",
          deskTaskStep: triggerStep,
          deskTaskTargetStep: observedStep,
          deskTaskTargetVisitedStep32: normalizeVisitedStep32(teamData),
          deskTaskInstruction: instruction,
          deskTaskRevision: currentTask.revision + 1,
          deskTaskRequestedAt: firestoreServerTimestamp(),
          deskTaskRequestedBy: clientId,
        },
        { merge: true },
      );
    });
  } catch (error) {
    showToast(`チーム${team}の机上作業依頼を補完できません: ${error.message}`);
  }
}

function refreshStaffPresence(state) {
  state.activeTeams = getActiveTeams(state.presenceByTeam, state.serverTimeOffset);
  updateStaffView(state);
}

function refreshMasterPresence(state) {
  state.activeTeams = getActiveTeams(state.presenceByTeam, state.serverTimeOffset);
  updateMasterView(state);
}

function refreshGiantPresence(state) {
  state.activeTeams = getActiveTeams(state.presenceByTeam, state.serverTimeOffset);
  updateGiantStaffView(state);
}

function getActiveTeams(presenceByTeam, serverTimeOffset) {
  const serverNow =
    serverTimeOffset === null ? null : Date.now() + serverTimeOffset;

  return Object.entries(presenceByTeam)
    .filter(([, connections]) => hasLivePlayerConnection(connections, serverNow))
    .map(([teamKey]) => Number(teamKey.replace("team-", "")))
    .filter((team) => Number.isInteger(team) && team >= 1 && team <= TEAM_COUNT)
    .sort((a, b) => a - b);
}

function hasLivePlayerConnection(connections, serverNow) {
  if (!connections || typeof connections !== "object") return false;

  return Object.values(connections).some((connection) => {
    if (!connection || connection.online !== true) return false;

    const lastSeenAt = connection.lastSeenAt;
    if (
      serverNow === null ||
      typeof lastSeenAt !== "number" ||
      !Number.isFinite(lastSeenAt)
    ) {
      return true;
    }

    return serverNow - lastSeenAt <= PRESENCE_STALE_AFTER_MS;
  });
}

function updateMasterView(state) {
  const teamGrid = stage.querySelector("#master-team-grid");
  if (!teamGrid) return;

  teamGrid.innerHTML = Array.from({ length: TEAM_COUNT }, (_, index) => {
    const team = index + 1;
    const isOnline = state.activeTeams.includes(team);
    const step = state.steps.get(team) ?? 1;
    const task = state.deskTasks.get(team) ?? normalizeDeskTask();
    const isDeskPending = task.status === "pending";
    const latestCompletedStep = task.completedSteps.at(-1) ?? null;
    const displayedTaskStep = isDeskPending ? task.step : latestCompletedStep;
    const displayedTaskName = displayedTaskStep
      ? getDeskTaskName(displayedTaskStep)
      : "机作業";
    const deskStatus = isDeskPending
      ? "準備中"
      : latestCompletedStep
        ? "完了"
        : "未着手";
    const progressMarkup = DESK_TASK_STEPS.map((taskStep, taskIndex) => {
      const isComplete = task.completedSteps.includes(taskStep);
      const isCurrent = isDeskPending && task.step === taskStep;
      return `
        <span
          class="master-desk-progress-box ${isComplete ? "is-complete" : ""} ${isCurrent ? "is-current" : ""}"
          aria-label="${taskIndex + 1}つ目${isComplete ? " 完了" : isCurrent ? " 準備中" : " 未完了"}"
        >${isComplete ? "✓" : taskIndex + 1}</span>
      `;
    }).join("");

    return `
      <article class="master-team-card ${isOnline ? "is-online" : "is-offline"} ${isDeskPending ? "has-desk-task" : ""}">
        <div class="master-team-number">${formatNumber(team)}</div>
        <div class="master-team-progress">
          <strong>${getStepLabel(step)}</strong>
          <b>${getStepNote(step) || "—"}</b>
        </div>
        <div class="master-team-desk">
          <div class="master-desk-current ${isDeskPending ? "is-pending" : latestCompletedStep ? "is-done" : ""}">
            <b>${displayedTaskName}</b>
            <strong>${deskStatus}</strong>
          </div>
          <div class="master-desk-progress">${progressMarkup}</div>
        </div>
      </article>
    `;
  }).join("");

  const onlineCount = stage.querySelector("#master-online-count");
  if (onlineCount) {
    onlineCount.textContent = `接続 ${state.activeTeams.length} / ${TEAM_COUNT}`;
  }
  const deskCount = stage.querySelector("#master-desk-count");
  if (deskCount) {
    const pendingDeskCount = [...state.deskTasks.values()].filter(
      (task) => task.status === "pending",
    ).length;
    deskCount.textContent = `机依頼 ${pendingDeskCount}`;
  }

  const status = normalizeGameStatus(state.gameStatus);
  const statusElement = stage.querySelector("#master-game-status");
  const startButton = stage.querySelector("#game-start");
  const endButton = stage.querySelector("#game-end");
  const resetButton = stage.querySelector("#progress-reset");
  if (!statusElement || !startButton || !endButton || !resetButton) return;

  const statusContent = {
    idle: "開始前",
    running: "進行中",
    ended: "終了",
  }[status];

  statusElement.dataset.status = status;
  statusElement.querySelector("strong").textContent = statusContent;
  startButton.disabled =
    state.pendingGameStatus || state.pendingProgressReset || status === "running";
  endButton.disabled =
    state.pendingGameStatus || state.pendingProgressReset || status === "ended";
  resetButton.disabled = state.pendingGameStatus || state.pendingProgressReset;
}

function updateGiantStaffView(state) {
  const teamGrid = stage.querySelector("#giant-team-grid");
  if (!teamGrid) return;

  teamGrid.innerHTML = Array.from({ length: TEAM_COUNT }, (_, index) => {
    const team = index + 1;
    const task = state.deskTasks.get(team) ?? normalizeDeskTask();
    const isPending = task.status === "pending";
    const isOnline = state.activeTeams.includes(team);
    const isUpdating = state.pendingTeams.has(team);
    const progressMarkup = DESK_TASK_STEPS.map((taskStep, taskIndex) => {
      const isComplete = task.completedSteps.includes(taskStep);
      const isCurrent = isPending && task.step === taskStep;
      return `
        <div
          class="giant-progress-box ${isComplete ? "is-complete" : ""} ${isCurrent ? "is-current" : ""}"
          aria-label="${taskIndex + 1}つ目${isComplete ? " 完了" : " 未完了"}"
        >
          ${isComplete ? '<span aria-hidden="true">✓</span>' : `<small>${taskIndex + 1}</small>`}
        </div>
      `;
    }).join("");

    return `
      <article class="giant-team-card ${isPending ? "is-pending" : ""} ${isOnline ? "is-online" : "is-offline"}">
        <div class="giant-team-number" aria-label="チーム${team} ${isOnline ? "接続中" : "未接続"}">
          <strong>${formatNumber(team)}</strong>
        </div>
        <div class="giant-team-body">
          ${
            isPending
              ? `
                <div class="giant-team-task">
                  <small>${task.step ? getStepLabel(task.step) : ""}</small>
                  <b>${task.instruction}</b>
                </div>
                <button
                  class="giant-ok-button ${isUpdating ? "loading" : ""}"
                  type="button"
                  data-giant-ok-team="${team}"
                  data-giant-task-revision="${task.revision}"
                  ${isUpdating ? "disabled" : ""}
                >完了</button>
              `
              : ""
          }
        </div>
        <div class="giant-progress" aria-label="机上作業の進捗">
          ${progressMarkup}
        </div>
      </article>
    `;
  }).join("");

  teamGrid.querySelectorAll("[data-giant-ok-team]").forEach((button) => {
    button.addEventListener("click", () => {
      completeDeskTask(
        state,
        Number(button.dataset.giantOkTeam),
        Number(button.dataset.giantTaskRevision),
      );
    });
  });

  const pendingCount = [...state.deskTasks.values()].filter(
    (task) => task.status === "pending",
  ).length;
  const countElement = stage.querySelector("#giant-pending-count");
  if (countElement) {
    countElement.textContent = `依頼 ${pendingCount}`;
  }
}

async function completeDeskTask(state, team, revision) {
  if (state.pendingTeams.has(team)) return;

  state.pendingTeams.add(team);
  updateGiantStaffView(state);

  try {
    const teamDocument = doc(firestore, "teams", teamDocumentId(team));
    await runTransaction(firestore, async (transaction) => {
      const snapshot = await transaction.get(teamDocument);
      if (!snapshot.exists()) throw new Error("チームデータが見つかりません");

      const teamData = snapshot.data();
      const task = normalizeDeskTask(teamData);
      if (task.status !== "pending" || task.revision !== revision) {
        throw new Error("依頼内容が更新されました。現在の表示を確認してください");
      }
      const completedSteps = task.step
        ? [...new Set([...task.completedSteps, task.step])].sort((a, b) => a - b)
        : task.completedSteps;

      transaction.set(
        teamDocument,
        {
          deskTaskStatus: "done",
          deskTaskCompletedSteps: completedSteps,
          deskTaskCompletedAt: firestoreServerTimestamp(),
          deskTaskCompletedBy: clientId,
          ...deskTaskCompletionStepUpdate(teamData, task),
          updatedAt: firestoreServerTimestamp(),
          updatedBy: clientId,
        },
        { merge: true },
      );
    });
  } catch (error) {
    showToast(`チーム${team}の机上作業を完了できません: ${error.message}`);
  } finally {
    state.pendingTeams.delete(team);
    updateGiantStaffView(state);
  }
}

function openProgressResetConfirmation(state) {
  if (state.pendingProgressReset) return;

  const confirmation = stage.querySelector("#game-confirm");
  const title = stage.querySelector("#game-confirm-title");
  const message = stage.querySelector("#game-confirm-message");
  const yesButton = stage.querySelector('[data-game-confirm="yes"]');
  if (!confirmation || !title || !message || !yesButton) return;

  state.confirmationAction = "progress-reset";
  state.confirmationStatus = null;
  confirmation.dataset.action = "reset-progress";
  title.textContent = "RESET ALL PROGRESS?";
  message.textContent = "YES resets every team to STEP 1-1 and clears desk-task progress.";
  confirmation.hidden = false;
  yesButton.focus();
}

function openGameStatusConfirmation(state, status) {
  const nextStatus = normalizeGameStatus(status);
  if (state.pendingGameStatus || nextStatus === "idle") return;

  const confirmation = stage.querySelector("#game-confirm");
  const title = stage.querySelector("#game-confirm-title");
  const message = stage.querySelector("#game-confirm-message");
  const yesButton = stage.querySelector('[data-game-confirm="yes"]');
  if (!confirmation || !title || !message || !yesButton) return;

  const content = {
    running: {
      title: "ゲームを開始しますか？",
      message: "YESを押すと、全端末へゲーム開始を送信します。",
    },
    ended: {
      title: "ゲームを終了しますか？",
      message: "YESを押すと、全プレイヤー画面に終了画像を表示します。",
    },
  }[nextStatus];

  state.confirmationAction = "game-status";
  state.confirmationStatus = nextStatus;
  confirmation.dataset.action = nextStatus;
  title.textContent = content.title;
  message.textContent = content.message;
  confirmation.hidden = false;
  yesButton.focus();
}

function closeGameStatusConfirmation(state) {
  state.confirmationAction = null;
  state.confirmationStatus = null;
  const confirmation = stage.querySelector("#game-confirm");
  if (confirmation) {
    confirmation.hidden = true;
    delete confirmation.dataset.action;
  }
}

async function changeGameStatus(state, status) {
  const nextStatus = normalizeGameStatus(status);
  if (state.pendingGameStatus || nextStatus === "idle") return;

  state.pendingGameStatus = true;
  updateMasterView(state);

  try {
    await update(databaseRef(realtimeDatabase, GAME_STATE_PATH), {
      status: nextStatus,
      updatedAt: databaseServerTimestamp(),
      updatedBy: clientId,
    });
  } catch (error) {
    showToast(`ゲーム状態を更新できません: ${error.message}`);
  } finally {
    state.pendingGameStatus = false;
    updateMasterView(state);
  }
}

async function resetAllTeamProgress(state) {
  if (state.pendingProgressReset) return;

  state.pendingProgressReset = true;
  updateMasterView(state);

  try {
    const batch = writeBatch(firestore);

    for (let team = 1; team <= TEAM_COUNT; team += 1) {
      batch.set(
        doc(firestore, "teams", teamDocumentId(team)),
        {
          teamNumber: team,
          step: 1,
          previousStep: 1,
          visitedStep32: false,
          deskTaskStatus: "idle",
          deskTaskStep: null,
          deskTaskTargetStep: null,
          deskTaskTargetVisitedStep32: null,
          deskTaskInstruction: "",
          deskTaskRevision: 0,
          deskTaskCompletedSteps: [],
          deskTaskRequestedAt: null,
          deskTaskRequestedBy: null,
          deskTaskCompletedAt: null,
          deskTaskCompletedBy: null,
          progressResetAt: firestoreServerTimestamp(),
          progressResetBy: clientId,
          updatedAt: firestoreServerTimestamp(),
          updatedBy: clientId,
        },
        { merge: true },
      );
    }

    await batch.commit();
    showToast("All team progress has been reset.", "success");
  } catch (error) {
    showToast(`Progress reset failed: ${error.message}`);
  } finally {
    state.pendingProgressReset = false;
    updateMasterView(state);
  }
}

function updateStaffView(state) {
  const list = stage.querySelector("#active-team-list");
  if (!list) return;

  const skipConfirmation = stage.querySelector("#step-32-skip-confirm");
  if (skipConfirmation) {
    const confirmationTeam = Number(skipConfirmation.dataset.team);
    const confirmationStep = state.steps.get(confirmationTeam) ?? 1;
    if (
      !state.activeTeams.includes(confirmationTeam) ||
      confirmationStep !== STEP_31_INDEX
    ) {
      skipConfirmation.remove();
    }
  }

  list.innerHTML = state.teamNumbers.map((team) => {
    const isOnline = state.activeTeams.includes(team);

    return `
      <div
        class="staff-team-button ${isOnline ? "is-online" : ""}"
        aria-label="チーム${team}${isOnline ? "（接続中）" : "（未接続）"}"
      >
        ${team}
      </div>
    `;
  }).join("");

  const controls = stage.querySelector("#active-team-controls");
  if (!controls) return;

  controls.innerHTML = state.teamNumbers.map((team) => {
      const isOnline = state.activeTeams.includes(team);
      const step = state.steps.get(team) ?? 1;
      const visitedStep32 =
        state.visitedStep32ByTeam.get(team) ?? step >= STEP_32_INDEX;
      const deskTask = state.deskTasks.get(team) ?? normalizeDeskTask();
      const isDeskTaskPending = deskTask.status === "pending";
      const displayStep = getStaffDisplayStep(step, deskTask);
      const skippedStep32 = isStep32Skipped(displayStep, visitedStep32);
      const isRouteChoice = isOnline && !isDeskTaskPending && step === STEP_31_INDEX;
      const isPending = state.pendingTeams.has(team);
      const stepProgressMarkup = staffStepProgressMarkup(
        displayStep,
        visitedStep32,
        deskTask,
        isOnline,
      );

      return `
        <div class="team-control-row ${isOnline ? "is-online" : "is-offline"} ${isRouteChoice ? "has-route-choice" : ""} ${deskTask.status === "pending" ? "has-desk-task" : ""}">
          <div class="step-band ${isOnline ? "" : "is-disconnected"}">
            <div class="staff-step-progress" aria-label="TEAM ${formatNumber(team)} STEP progress">
              ${stepProgressMarkup}
            </div>
            <span class="step-note">
              <span class="step-note-text">
                ${
                  isOnline
                    ? getStepNote(displayStep) || "—"
                    : "—"
                }
              </span>
            </span>
          </div>
          ${
            isRouteChoice
              ? `
                <div class="step-route-inline">
                  <button
                    class="step-button step-route-button ${isPending ? "loading" : ""}"
                    type="button"
                    data-step-route-team="${team}"
                    data-step-route-target="3-2"
                    ${isPending ? "disabled" : ""}
                  >3-2に進む</button>
                  <button
                    class="step-button step-route-button is-skip ${isPending ? "loading" : ""}"
                    type="button"
                    data-step-route-team="${team}"
                    data-step-route-target="4-1"
                    ${isPending ? "disabled" : ""}
                  >4-1に進む</button>
                </div>
              `
              : `
                <button
                  class="step-button ${isPending ? "loading" : ""} ${isDeskTaskPending ? "is-force" : ""}"
                  type="button"
                  data-step-team="${team}"
                  data-step-delta="1"
                  ${isDeskTaskPending ? 'data-force-step="true"' : ""}
                  ${!isOnline || isPending || step >= STEP_COUNT ? "disabled" : ""}
                >${isDeskTaskPending ? "強制進行" : "進める"}</button>
              `
          }
          <button
            class="step-button ${isPending ? "loading" : ""}"
            type="button"
            data-step-team="${team}"
            data-step-delta="-1"
            ${!isOnline || isPending || (!isDeskTaskPending && step <= 1) ? "disabled" : ""}
          >${skippedStep32 && step === STEP_41_INDEX ? "3-1へ戻す" : "戻す"}</button>
        </div>
      `;
    }).join("");

  controls.querySelectorAll("[data-step-team]").forEach((button) => {
    button.addEventListener("click", () => {
      const team = Number(button.dataset.stepTeam);
      const delta = Number(button.dataset.stepDelta);
      if (button.dataset.forceStep === "true" && delta > 0) {
        openForceStepConfirmation(state, team);
        return;
      }

      changeStep(state, team, delta);
    });
  });

  controls.querySelectorAll("[data-step-route-team]").forEach((button) => {
    button.addEventListener("click", () => {
      const team = Number(button.dataset.stepRouteTeam);
      const target = button.dataset.stepRouteTarget;

      if (target === "4-1") {
        openStep32SkipConfirmation(state, team);
      } else {
        changeStep(state, team, 1, "3-2");
      }
    });
  });
}

function getStaffDisplayStep(step, deskTask) {
  if (deskTask?.status === "pending" && deskTask.step) {
    return normalizeStep(deskTask.step);
  }

  return normalizeStep(step);
}

function staffStepProgressMarkup(currentStep, visitedStep32, deskTask, isOnline) {
  const normalizedStep = normalizeStep(currentStep);
  const task = deskTask ?? normalizeDeskTask();
  const pendingTaskStep = task.status === "pending" ? task.step : null;
  const skippedStep32 = isStep32Skipped(normalizedStep, visitedStep32);

  return STEP_LABELS.map((stepLabel, index) => {
    const stepNumber = index + 1;
    const isSkipped = skippedStep32 && stepNumber === STEP_32_INDEX;
    let statusClass = "is-upcoming";
    let statusLabel = "upcoming";

    if (!isOnline) {
      statusClass = "is-offline";
      statusLabel = "offline";
    } else if (isSkipped) {
      statusClass = "is-skipped";
      statusLabel = "skipped";
    } else if (pendingTaskStep === stepNumber) {
      statusClass = "is-waiting";
      statusLabel = "waiting for giant staff";
    } else if (stepNumber === normalizedStep) {
      statusClass = "is-current";
      statusLabel = "current challenge";
    } else if (stepNumber < normalizedStep) {
      statusClass = "is-complete";
      statusLabel = "complete";
    }

    return `
      <span class="staff-step-check ${statusClass}" aria-label="STEP ${stepLabel}: ${statusLabel}">
        <span class="staff-step-mark" aria-hidden="true"></span>
        <span class="staff-step-label">${stepLabel}</span>
      </span>
    `;
  }).join("");
}

function openForceStepConfirmation(state, team) {
  stage.querySelector("#force-step-confirm")?.remove();

  const confirmation = document.createElement("div");
  confirmation.className = "master-confirm-backdrop";
  confirmation.id = "force-step-confirm";
  confirmation.dataset.team = String(team);
  confirmation.dataset.action = "ended";
  confirmation.innerHTML = `
    <section
      class="master-confirm-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="force-step-confirm-title"
      aria-describedby="force-step-confirm-message"
    >
      <p class="eyebrow">TEAM ${formatNumber(team)} / FORCE STEP</p>
      <h2 id="force-step-confirm-title">強制的にSTEPを進めますか？</h2>
      <p id="force-step-confirm-message">
        巨人スタッフの完了を待たずに、現在の依頼を完了扱いにします。基本は使用しない操作です。
      </p>
      <div class="master-confirm-actions">
        <button class="master-confirm-button is-yes" type="button" data-force-step-confirm="yes">
          YES
        </button>
        <button class="master-confirm-button is-no" type="button" data-force-step-confirm="no">
          NO
        </button>
      </div>
    </section>
  `;
  stage.append(confirmation);

  confirmation
    .querySelector('[data-force-step-confirm="yes"]')
    .addEventListener("click", () => {
      confirmation.remove();
      forceCompleteDeskTask(state, team);
    });
  confirmation
    .querySelector('[data-force-step-confirm="no"]')
    .addEventListener("click", () => {
      confirmation.remove();
    });
  confirmation.addEventListener("click", (event) => {
    if (event.target === confirmation) confirmation.remove();
  });
  confirmation.querySelector('[data-force-step-confirm="no"]').focus();
}

function openStep32SkipConfirmation(state, team) {
  stage.querySelector("#step-32-skip-confirm")?.remove();

  const confirmation = document.createElement("div");
  confirmation.className = "master-confirm-backdrop";
  confirmation.id = "step-32-skip-confirm";
  confirmation.dataset.team = String(team);
  confirmation.dataset.action = "ended";
  confirmation.innerHTML = `
    <section
      class="master-confirm-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="step-skip-confirm-title"
      aria-describedby="step-skip-confirm-message"
    >
      <p class="eyebrow">TEAM ${formatNumber(team)} / CONFIRM ROUTE</p>
      <h2 id="step-skip-confirm-title">4-1に進みますか？</h2>
      <p id="step-skip-confirm-message">
        STEP 3-2をスキップします。プレイヤー画面に3-2のログは表示されません。
      </p>
      <div class="master-confirm-actions">
        <button class="master-confirm-button is-yes" type="button" data-step-skip-confirm="yes">
          YES
        </button>
        <button class="master-confirm-button is-no" type="button" data-step-skip-confirm="no">
          NO
        </button>
      </div>
    </section>
  `;
  stage.append(confirmation);

  confirmation
    .querySelector('[data-step-skip-confirm="yes"]')
    .addEventListener("click", () => {
      confirmation.remove();
      changeStep(state, team, 1, "4-1");
    });
  confirmation
    .querySelector('[data-step-skip-confirm="no"]')
    .addEventListener("click", () => {
      confirmation.remove();
    });
  confirmation.addEventListener("click", (event) => {
    if (event.target === confirmation) confirmation.remove();
  });
  confirmation.querySelector('[data-step-skip-confirm="no"]').focus();
}

async function changeStep(state, team, delta, routeTarget = null) {
  if (!state.activeTeams.includes(team) || state.pendingTeams.has(team)) return;

  const teamDocument = doc(firestore, "teams", teamDocumentId(team));
  state.pendingTeams.add(team);
  updateStaffView(state);

  try {
    await runTransaction(firestore, async (transaction) => {
      const snapshot = await transaction.get(teamDocument);
      const teamData = snapshot.exists() ? snapshot.data() : {};
      const currentStep = normalizeStep(teamData.step);
      const visitedStep32 = normalizeVisitedStep32(teamData);

      if (routeTarget && currentStep !== STEP_31_INDEX) {
        throw new Error("別の端末でSTEPが変更されました。現在の表示を確認してください");
      }

      let nextStep = Math.min(STEP_COUNT, Math.max(1, currentStep + delta));
      let nextVisitedStep32 = visitedStep32;

      if (currentStep === STEP_31_INDEX && delta > 0) {
        if (routeTarget === "4-1") {
          nextStep = STEP_41_INDEX;
          nextVisitedStep32 = false;
        } else {
          nextStep = STEP_32_INDEX;
          nextVisitedStep32 = true;
        }
      } else if (
        currentStep === STEP_41_INDEX &&
        delta < 0 &&
        !visitedStep32
      ) {
        nextStep = STEP_31_INDEX;
      } else if (nextStep === STEP_32_INDEX) {
        nextVisitedStep32 = true;
      }

      const currentDeskTask = normalizeDeskTask(teamData);
      const deskTaskInstruction =
        delta > 0 ? getConfiguredDeskTaskInstruction(currentStep) : null;
      const shouldWaitForDeskTask = Boolean(deskTaskInstruction);
      const isDeskTaskRollback =
        delta < 0 &&
        DESK_TASK_STEPS.includes(nextStep) &&
        (
          currentDeskTask.step === nextStep ||
          currentDeskTask.completedSteps.includes(nextStep)
        );
      const isPendingDeskTaskCancel =
        delta < 0 && currentDeskTask.status === "pending";
      const deskTaskUpdate = deskTaskInstruction
        ? {
            deskTaskStatus: "pending",
            deskTaskStep: currentStep,
            deskTaskTargetStep: nextStep,
            deskTaskTargetVisitedStep32: nextVisitedStep32,
            deskTaskInstruction,
            deskTaskRevision: currentDeskTask.revision + 1,
            deskTaskRequestedAt: firestoreServerTimestamp(),
            deskTaskRequestedBy: clientId,
          }
        : isPendingDeskTaskCancel
          ? {
              deskTaskStatus: "idle",
              deskTaskStep: null,
              deskTaskTargetStep: null,
              deskTaskTargetVisitedStep32: null,
              deskTaskInstruction: "",
              deskTaskRevision: currentDeskTask.revision + 1,
              deskTaskCompletedSteps: currentDeskTask.completedSteps.filter(
                (completedStep) => completedStep !== nextStep,
              ),
              deskTaskRequestedAt: null,
              deskTaskRequestedBy: null,
            }
        : isDeskTaskRollback
          ? {
              deskTaskStatus: "idle",
              deskTaskCompletedSteps: currentDeskTask.completedSteps.filter(
                (completedStep) => completedStep !== nextStep,
              ),
            }
          : delta > 0 && currentDeskTask.status === "done"
            ? { deskTaskStatus: "idle" }
            : {};

      transaction.set(
        teamDocument,
        {
          teamNumber: team,
          step: shouldWaitForDeskTask ? currentStep : nextStep,
          previousStep: currentStep,
          visitedStep32: shouldWaitForDeskTask ? visitedStep32 : nextVisitedStep32,
          ...deskTaskUpdate,
          updatedAt: firestoreServerTimestamp(),
          updatedBy: clientId,
        },
        { merge: true },
      );
    });
  } catch (error) {
    showToast(`チーム${team}のSTEPを更新できません: ${error.message}`);
  } finally {
    state.pendingTeams.delete(team);
    updateStaffView(state);
  }
}

async function forceCompleteDeskTask(state, team) {
  if (!state.activeTeams.includes(team) || state.pendingTeams.has(team)) return;

  const teamDocument = doc(firestore, "teams", teamDocumentId(team));
  state.pendingTeams.add(team);
  updateStaffView(state);

  try {
    await runTransaction(firestore, async (transaction) => {
      const snapshot = await transaction.get(teamDocument);
      if (!snapshot.exists()) throw new Error("チームデータが見つかりません");

      const teamData = snapshot.data();
      const task = normalizeDeskTask(teamData);
      if (task.status !== "pending" || !task.step) {
        throw new Error("完了待ちの依頼がありません");
      }

      const completedSteps = [...new Set([...task.completedSteps, task.step])]
        .sort((a, b) => a - b);

      transaction.set(
        teamDocument,
        {
          deskTaskStatus: "done",
          deskTaskCompletedSteps: completedSteps,
          deskTaskCompletedAt: firestoreServerTimestamp(),
          deskTaskCompletedBy: clientId,
          deskTaskForceCompletedAt: firestoreServerTimestamp(),
          deskTaskForceCompletedBy: clientId,
          ...deskTaskCompletionStepUpdate(teamData, task),
          updatedAt: firestoreServerTimestamp(),
          updatedBy: clientId,
        },
        { merge: true },
      );
    });
    showToast(`チーム${team}の依頼を強制完了しました`, "success");
  } catch (error) {
    showToast(`チーム${team}を強制進行できません: ${error.message}`);
  } finally {
    state.pendingTeams.delete(team);
    updateStaffView(state);
  }
}

function deskTaskCompletionStepUpdate(teamData, task) {
  if (!task.targetStep) return {};

  return {
    step: task.targetStep,
    previousStep: task.step ?? normalizeStep(teamData?.step),
    visitedStep32:
      typeof task.targetVisitedStep32 === "boolean"
        ? task.targetVisitedStep32
        : normalizeVisitedStep32(teamData),
  };
}

function renderPlayer(team) {
  const cameraLayers = Array.from({ length: CAMERA_COUNT }, (_, index) => {
    const buttonNumber = index + 1;
    const assetNumber = formatNumber(buttonNumber);
    const lockedAsset = versionedAssetUrl(`./Camera_Button_${assetNumber}-B.png`);
    const activeAsset = versionedAssetUrl(`./Camera_Button_${assetNumber}-A.png`);

    return `
      <img
        class="player-camera-layer player-camera-layer-locked"
        src="${lockedAsset}"
        alt=""
        data-camera-locked-layer="${buttonNumber}"
      />
      <img
        class="player-camera-layer player-camera-layer-active"
        src="${activeAsset}"
        alt=""
        data-camera-active-layer="${buttonNumber}"
      />
    `;
  }).join("");

  const cameraButtons = Array.from({ length: CAMERA_COUNT }, (_, index) => {
    const buttonNumber = index + 1;
    return `
      <button
        class="player-camera-button"
        type="button"
        data-camera-button="${buttonNumber}"
        aria-label="カメラ${formatNumber(buttonNumber)}"
        aria-pressed="false"
      ></button>
    `;
  }).join("");

  stage.innerHTML = `
    <section class="screen player-screen">
      <img class="player-base-layer player-base-layer-01" src="${versionedAssetUrl("./Base_01.png")}" alt="" />
      <div class="player-camera-feed" aria-hidden="true">
        <img class="player-camera-feed-layer" data-camera-feed-base alt="" />
        <img class="player-camera-feed-layer" data-camera-feed-frame alt="" />
      </div>
      <img class="player-base-layer player-base-layer-02" src="${versionedAssetUrl("./Base_02.png")}" alt="" />
      <img class="player-step-layer" data-player-step-layer alt="" />
      <div class="player-log-viewport" data-player-log-viewport aria-label="ロボットの行動ログ">
        <div class="player-log-list" data-player-log-list></div>
      </div>
      <div class="player-log-scrollbar" data-player-log-scrollbar aria-hidden="true">
        <div class="player-log-scrollbar-thumb" data-player-log-scrollbar-thumb></div>
      </div>
      <div class="player-camera-layers" aria-hidden="true">
        ${cameraLayers}
      </div>
      <div class="player-camera-controls" aria-label="カメラ操作">
        ${cameraButtons}
      </div>
      <button
        class="player-map-trigger"
        id="player-map-trigger"
        type="button"
        aria-label="MAPを開く"
      ></button>
      <img
        class="player-game-end-overlay"
        src="${versionedAssetUrl("./hutae.png")}"
        alt="ゲーム終了"
        data-game-end-overlay
        hidden
      />
      <button
        class="hidden-staff-trigger"
        id="hidden-staff-trigger"
        type="button"
        aria-label="スタッフメニュー"
      ></button>
      <div class="player-map-popup" id="player-map-popup" role="dialog" aria-modal="true" aria-label="MAP" hidden>
        <img class="player-map-layer player-map-window" src="${versionedAssetUrl("./Map_Window.png")}" alt="" />
        <img class="player-map-layer player-map-base" data-map-base alt="" />
        <div class="player-map-camera-layers" data-map-camera-layers aria-hidden="true"></div>
        <button class="player-map-room-button player-map-room-a" type="button" data-map-room="A" aria-label="ルームα"></button>
        <button class="player-map-room-button player-map-room-b" type="button" data-map-room="B" aria-label="ルームβ"></button>
        <button class="player-map-close-button" type="button" data-map-close aria-label="MAPを閉じる"></button>
      </div>
      <div class="player-step-popup" id="player-step-popup" role="dialog" aria-modal="true" aria-label="STEPメッセージ" hidden>
        <img class="player-step-popup-layer player-step-popup-content" data-step-popup-content alt="" />
        <img class="player-step-popup-layer player-step-popup-window" src="${versionedAssetUrl("./Pop_window.png")}" alt="" />
        <button class="player-step-popup-close" type="button" data-step-popup-close aria-label="メッセージを閉じる"></button>
      </div>
      <audio data-player-click-sound src="${versionedAssetUrl("./click.mp3")}" preload="auto" playsinline></audio>
    </section>
  `;

  const teamDocument = doc(firestore, "teams", teamDocumentId(team));
  setupPlayerClickSound();
  const cameraControls = setupPlayerCameraControls();
  const savedManualProgress = readLocalPlayerProgress(team);
  let manualStepOverride = savedManualProgress?.step ?? null;
  let manualVisitedStep32 = savedManualProgress?.visitedStep32 ?? null;
  if (manualStepOverride !== null) {
    manualVisitedStep32 =
      typeof manualVisitedStep32 === "boolean"
        ? manualVisitedStep32
        : getManualVisitedStep32(
            manualStepOverride,
            cameraControls.getCurrentStep(),
            cameraControls.hasVisitedStep32(),
          );
    cameraControls.updateStep(manualStepOverride, false, manualVisitedStep32);
    syncManualPlayerStep(teamDocument, team, manualStepOverride, manualVisitedStep32);
  }

  setupHiddenStaffMenu(team, cameraControls, (step) => {
    const selectedStep = normalizeStep(step);
    const visitedStep32 = getManualVisitedStep32(
      selectedStep,
      cameraControls.getCurrentStep(),
      cameraControls.hasVisitedStep32(),
    );
    manualStepOverride = selectedStep;
    manualVisitedStep32 = visitedStep32;
    saveLocalPlayerProgress(team, selectedStep, visitedStep32);
    cameraControls.updateStep(selectedStep, true, visitedStep32);
    syncManualPlayerStep(teamDocument, team, selectedStep, visitedStep32);
  });

  const gameEndOverlay = stage.querySelector("[data-game-end-overlay]");

  runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(teamDocument);
    if (!snapshot.exists()) {
      transaction.set(teamDocument, {
        teamNumber: team,
        step: 1,
        visitedStep32: false,
        createdAt: firestoreServerTimestamp(),
      });
    }
  }).catch((error) => {
    showToast(`チームデータを初期化できません: ${error.message}`);
  });

  const unsubscribe = onSnapshot(
    teamDocument,
    { includeMetadataChanges: true },
    (snapshot) => {
      const teamData = snapshot.exists() ? snapshot.data() : {};
      const step = normalizeStep(teamData.step);
      const visitedStep32 = normalizeVisitedStep32(teamData);

      if (manualStepOverride !== null) {
        manualVisitedStep32 =
          typeof manualVisitedStep32 === "boolean"
            ? manualVisitedStep32
            : getManualVisitedStep32(manualStepOverride, step, visitedStep32);
        cameraControls.updateStep(manualStepOverride, false, manualVisitedStep32);

        if (
          step === manualStepOverride &&
          visitedStep32 === manualVisitedStep32 &&
          !snapshot.metadata.hasPendingWrites
        ) {
          clearLocalPlayerProgress(team);
          manualStepOverride = null;
          manualVisitedStep32 = null;
        }
        return;
      }

      cameraControls.updateStep(step, true, visitedStep32);
    },
    (error) => showToast(`STEPを受信できません: ${error.message}`),
  );

  const unsubscribeGame = onValue(
    databaseRef(realtimeDatabase, GAME_STATE_PATH),
    (snapshot) => {
      gameEndOverlay.hidden = normalizeGameStatus(snapshot.val()?.status) !== "ended";
    },
    (error) => showToast(`ゲーム状態を受信できません: ${error.message}`),
  );

  viewCleanups.push(unsubscribe, unsubscribeGame);
}

function setupPlayerClickSound() {
  const playerScreen = stage.querySelector(".player-screen");
  const baseSound = stage.querySelector("[data-player-click-sound]");
  if (!playerScreen || !baseSound) return;

  const soundPool = [
    baseSound,
    ...Array.from({ length: 3 }, () => {
      const sound = baseSound.cloneNode();
      sound.removeAttribute("data-player-click-sound");
      playerScreen.append(sound);
      return sound;
    }),
  ];
  soundPool.forEach((sound) => {
    sound.volume = PLAYER_CLICK_VOLUME;
  });
  let nextSoundIndex = 0;
  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  const audioContext = AudioContextClass ? new AudioContextClass() : null;
  let clickSoundBuffer = null;

  if (audioContext) {
    fetch(versionedAssetUrl("./click.mp3"), { credentials: "same-origin" })
      .then((response) => {
        if (!response.ok) throw new Error(`click.mp3: ${response.status}`);
        return response.arrayBuffer();
      })
      .then((audioData) => audioContext.decodeAudioData(audioData))
      .then((buffer) => {
        clickSoundBuffer = buffer;
      })
      .catch(() => {});
  }

  const playWithWebAudio = () => {
    if (!audioContext || !clickSoundBuffer || audioContext.state !== "running") return;

    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    source.buffer = clickSoundBuffer;
    gain.gain.value = PLAYER_CLICK_VOLUME;
    source.connect(gain);
    gain.connect(audioContext.destination);
    source.start();
  };

  const playClickSound = (event) => {
    const button = event.target instanceof Element
      ? event.target.closest("button")
      : null;
    if (
      !button ||
      button.disabled ||
      button.id === "hidden-staff-trigger"
    ) {
      return;
    }

    const resumeAudioContext =
      audioContext?.state === "suspended"
        ? audioContext.resume().catch(() => {})
        : Promise.resolve();

    const availableSound = soundPool.find((sound) => sound.paused || sound.ended);
    const clickSound = availableSound ?? soundPool[nextSoundIndex];
    nextSoundIndex = (nextSoundIndex + 1) % soundPool.length;

    try {
      clickSound.currentTime = 0;
    } catch {
      clickSound.load();
    }

    const playResult = clickSound.play();
    playResult?.catch?.(() => {
      resumeAudioContext.then(playWithWebAudio);
    });
  };

  soundPool.forEach((sound) => sound.load());
  const pressEvent = "PointerEvent" in window ? "pointerdown" : "touchstart";
  playerScreen.addEventListener(pressEvent, playClickSound, true);
  viewCleanups.push(() => {
    playerScreen.removeEventListener(pressEvent, playClickSound, true);
    soundPool.forEach((sound) => {
      sound.pause();
      sound.removeAttribute("src");
      sound.load();
    });
    audioContext?.close().catch(() => {});
  });
}

function setupPlayerCameraControls() {
  const buttons = [...stage.querySelectorAll("[data-camera-button]")];
  const lockedLayers = [...stage.querySelectorAll("[data-camera-locked-layer]")];
  const activeLayers = [...stage.querySelectorAll("[data-camera-active-layer]")];
  const feedBase = stage.querySelector("[data-camera-feed-base]");
  const feedFrame = stage.querySelector("[data-camera-feed-frame]");
  const stepLayer = stage.querySelector("[data-player-step-layer]");
  const logViewport = stage.querySelector("[data-player-log-viewport]");
  const logList = stage.querySelector("[data-player-log-list]");
  const logScrollbar = stage.querySelector("[data-player-log-scrollbar]");
  const logScrollbarThumb = stage.querySelector("[data-player-log-scrollbar-thumb]");
  const mapTrigger = stage.querySelector("#player-map-trigger");
  const mapPopup = stage.querySelector("#player-map-popup");
  const mapBase = stage.querySelector("[data-map-base]");
  const mapCameraLayers = stage.querySelector("[data-map-camera-layers]");
  const mapRoomButtons = [...stage.querySelectorAll("[data-map-room]")];
  const mapCloseButton = stage.querySelector("[data-map-close]");
  const stepPopup = stage.querySelector("#player-step-popup");
  const stepPopupContent = stage.querySelector("[data-step-popup-content]");
  const stepPopupClose = stage.querySelector("[data-step-popup-close]");
  let currentStep = 1;
  let selectedCamera = 1;
  let selectedMapRoom = "A";
  let visitedStep32 = false;
  let renderedLogState = null;

  const updateLogScrollbar = () => {
    const scrollRange = logViewport.scrollHeight - logViewport.clientHeight;
    if (scrollRange <= 0) {
      logScrollbar.hidden = true;
      return;
    }

    logScrollbar.hidden = false;
    const thumbHeight = Math.max(
      52,
      Math.round(
        logScrollbar.clientHeight *
          (logViewport.clientHeight / logViewport.scrollHeight),
      ),
    );
    const thumbRange = logScrollbar.clientHeight - thumbHeight;
    const thumbTop = Math.round(
      thumbRange * (logViewport.scrollTop / scrollRange),
    );

    logScrollbarThumb.style.height = `${thumbHeight}px`;
    logScrollbarThumb.style.transform = `translateY(${thumbTop}px)`;
  };

  logViewport.addEventListener("scroll", updateLogScrollbar, { passive: true });
  viewCleanups.push(() => {
    logViewport.removeEventListener("scroll", updateLogScrollbar);
  });

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const cameraNumber = Number(button.dataset.cameraButton);
      if (!isCameraUnlocked(cameraNumber, currentStep)) return;

      selectedCamera = cameraNumber;
      render();
    });
  });

  mapTrigger.addEventListener("click", () => {
    mapPopup.hidden = false;
    renderMap();
  });

  mapRoomButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedMapRoom = button.dataset.mapRoom;
      renderMap();
    });
  });

  mapCloseButton.addEventListener("click", () => {
    mapPopup.hidden = true;
  });

  stepPopupClose.addEventListener("click", () => {
    stepPopup.hidden = true;
  });

  function updateStep(step, shouldShowPopup = true, nextVisitedStep32 = null) {
    const nextStep = normalizeStep(step);
    const didStepChange = nextStep !== currentStep;
    currentStep = nextStep;
    visitedStep32 =
      typeof nextVisitedStep32 === "boolean"
        ? nextVisitedStep32
        : nextStep >= STEP_32_INDEX;

    if (!isCameraUnlocked(selectedCamera, currentStep)) {
      selectedCamera = getUnlockedCameras(currentStep).at(-1) ?? 1;
    }

    render();

    if (didStepChange && shouldShowPopup) {
      showStepPopup();
    }
  }

  function render() {
    buttons.forEach((button) => {
      const cameraNumber = Number(button.dataset.cameraButton);
      const isUnlocked = isCameraUnlocked(cameraNumber, currentStep);
      const isActive = isUnlocked && cameraNumber === selectedCamera;

      button.disabled = !isUnlocked;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
      button.setAttribute(
        "aria-label",
        `カメラ${formatNumber(cameraNumber)}${isUnlocked ? "" : " ロック中"}`,
      );
    });

    lockedLayers.forEach((layer) => {
      const cameraNumber = Number(layer.dataset.cameraLockedLayer);
      layer.classList.toggle("is-visible", !isCameraUnlocked(cameraNumber, currentStep));
    });

    activeLayers.forEach((layer) => {
      const cameraNumber = Number(layer.dataset.cameraActiveLayer);
      layer.classList.toggle(
        "is-visible",
        isCameraUnlocked(cameraNumber, currentStep) && cameraNumber === selectedCamera,
      );
    });

    renderCameraFeed();
    renderStepDisplay();
    renderLogs();
    renderMap();
  }

  function renderCameraFeed() {
    const frameStep = getCameraFrameStep(selectedCamera, currentStep);
    const hasFrame = Boolean(frameStep);

    feedBase.classList.toggle("is-visible", hasFrame && selectedCamera === 1);
    if (hasFrame && selectedCamera === 1) {
      feedBase.src = versionedAssetUrl("./Cam_01_Base.png");
    }

    feedFrame.classList.toggle("is-visible", hasFrame);
    if (hasFrame) {
      feedFrame.src =
        versionedAssetUrl(`./Cam_${formatNumber(selectedCamera)}_${frameStep}.png`);
    }
  }

  function renderStepDisplay() {
    stepLayer.src = versionedAssetUrl(`./Stage_${getStepLabel(currentStep)}.png`);
  }

  function renderLogs() {
    const logState = `${currentStep}:${visitedStep32}`;
    if (renderedLogState === logState) return;

    const visibleLogs = STEP_LABELS.slice(0, currentStep)
      .filter(
        (stepLabel) =>
          stepLabel !== "3-2" ||
          currentStep === STEP_32_INDEX ||
          visitedStep32,
      )
      .flatMap((stepLabel) => STEP_LOGS[stepLabel] ?? []);

    logList.innerHTML = visibleLogs
      .map(
        (logAsset, index) => `
          <img
            class="player-log-entry"
            src="${versionedAssetUrl(`./${logAsset}`)}"
            alt="行動ログ ${index + 1}"
          />
        `,
      )
      .join("");

    renderedLogState = logState;
    logViewport.scrollTop = logViewport.scrollHeight;
    requestAnimationFrame(updateLogScrollbar);
  }

  function renderMap() {
    mapBase.src = versionedAssetUrl(`./Map_base_${selectedMapRoom}.png`);

    mapRoomButtons.forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.mapRoom === selectedMapRoom),
      );
    });

    mapCameraLayers.innerHTML = (MAP_CAMERA_LAYERS[selectedMapRoom] ?? [])
      .filter(({ step }) => getStepIndex(step) <= currentStep)
      .map(
        ({ asset }) => `
          <img class="player-map-layer player-map-camera-layer" src="${versionedAssetUrl(`./${asset}`)}" alt="" />
        `,
      )
      .join("");
  }

  function showStepPopup() {
    const popupAsset = STEP_POPUPS[getStepLabel(currentStep)];
    if (!popupAsset) {
      stepPopup.hidden = true;
      return;
    }

    stepPopupContent.src = versionedAssetUrl(`./${popupAsset}`);
    stepPopup.hidden = false;
  }

  updateStep(1);

  function getCurrentStep() {
    return currentStep;
  }

  function hasVisitedStep32() {
    return visitedStep32;
  }

  return { updateStep, getCurrentStep, hasVisitedStep32 };
}

function setupHiddenStaffMenu(team, cameraControls, onStepSelect) {
  const trigger = stage.querySelector("#hidden-staff-trigger");
  let tapCount = 0;
  let resetTimer = null;

  trigger.addEventListener("click", () => {
    tapCount += 1;
    clearTimeout(resetTimer);

    if (tapCount >= 5) {
      tapCount = 0;
      openStaffPopup(team, cameraControls, onStepSelect);
      return;
    }

    resetTimer = window.setTimeout(() => {
      tapCount = 0;
    }, 1800);
  });

  viewCleanups.push(() => clearTimeout(resetTimer));
}

function openStaffPopup(team, cameraControls, onStepSelect) {
  if (stage.querySelector("#staff-popup")) return;

  const popup = document.createElement("div");
  popup.className = "staff-popup-backdrop";
  popup.id = "staff-popup";
  popup.innerHTML = `
    <section class="staff-popup" role="dialog" aria-modal="true" aria-labelledby="staff-popup-title">
      <p class="eyebrow">AUTHORIZED PERSONNEL ONLY</p>
      <h2 id="staff-popup-title">STAFF MENU</h2>
      <div class="staff-popup-actions">
        <button type="button" data-popup-action="step">STEP移動</button>
        <button type="button" data-popup-action="home">ホームに戻る</button>
        <button type="button" data-popup-action="reload">リロード</button>
        <button type="button" data-popup-action="close">戻る</button>
      </div>
    </section>
  `;
  stage.append(popup);

  popup.querySelector('[data-popup-action="step"]').addEventListener("click", () => {
    popup.remove();
    openPlayerStepSelector(team, cameraControls, onStepSelect);
  });
  popup.querySelector('[data-popup-action="home"]').addEventListener("click", () => {
    navigate({ mode: "home" });
  });
  popup.querySelector('[data-popup-action="reload"]').addEventListener("click", () => {
    window.location.reload();
  });
  popup.querySelector('[data-popup-action="close"]').addEventListener("click", () => {
    popup.remove();
  });
}

function openPlayerStepSelector(team, cameraControls, onStepSelect) {
  stage.querySelector("#player-step-selector")?.remove();

  const selector = document.createElement("div");
  selector.className = "staff-popup-backdrop";
  selector.id = "player-step-selector";
  selector.innerHTML = `
    <section
      class="staff-popup player-step-selector"
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-step-selector-title"
    >
      <p class="eyebrow">TEAM ${formatNumber(team)} / MANUAL CONTROL</p>
      <h2 id="player-step-selector-title">STEP移動</h2>
      <p class="player-step-selector-note">
        通信停止中でも、この端末の画面を選択したSTEPへ移動できます。
      </p>
      <div class="player-step-selector-grid">
        ${STEP_LABELS.map(
          (stepLabel, index) => `
            <button
              type="button"
              data-select-step="${index + 1}"
              class="${cameraControls.getCurrentStep() === index + 1 ? "is-current" : ""}"
            >
              <span>STEP</span>
              <strong>${stepLabel}</strong>
              <small>${STEP_NOTES[stepLabel] || "補足なし"}</small>
            </button>
          `,
        ).join("")}
      </div>
      <button class="player-step-selector-cancel" type="button" data-step-selector-close>
        戻る
      </button>
    </section>
  `;
  stage.append(selector);

  selector.querySelectorAll("[data-select-step]").forEach((button) => {
    button.addEventListener("click", () => {
      onStepSelect(Number(button.dataset.selectStep));
      selector.remove();
      showToast(`STEP ${getStepLabel(Number(button.dataset.selectStep))}へ移動しました`, "success");
    });
  });
  selector.querySelector("[data-step-selector-close]").addEventListener("click", () => {
    selector.remove();
    openStaffPopup(team, cameraControls, onStepSelect);
  });
  selector.addEventListener("click", (event) => {
    if (event.target === selector) selector.remove();
  });
}

function syncManualPlayerStep(teamDocument, team, step, visitedStep32) {
  const selectedStep = normalizeStep(step);

  setDoc(
    teamDocument,
    {
      teamNumber: team,
      step: selectedStep,
      visitedStep32: Boolean(visitedStep32),
      updatedAt: firestoreServerTimestamp(),
      updatedBy: clientId,
    },
    { merge: true },
  ).catch((error) => {
    showToast(
      `STEP ${getStepLabel(selectedStep)}を端末内に保存しました。通信復帰後に再同期します: ${error.message}`,
    );
  });
}

function normalizeStep(value) {
  const step = Number(value);
  if (!Number.isFinite(step)) return 1;
  return Math.min(STEP_COUNT, Math.max(1, Math.round(step)));
}

function normalizeVisitedStep32(teamData) {
  if (typeof teamData?.visitedStep32 === "boolean") {
    return teamData.visitedStep32;
  }

  // Documents created before this branch existed followed the normal 3-2 route.
  return normalizeStep(teamData?.step) >= STEP_32_INDEX;
}

function normalizeDeskTask(teamData = {}) {
  const savedStatus =
    teamData?.deskTaskStatus === "pending" ||
    teamData?.deskTaskStatus === "done" ||
    teamData?.deskTaskStatus === "idle"
      ? teamData.deskTaskStatus
      : "idle";
  const step = Number(teamData?.deskTaskStep);
  const targetStep = Number(teamData?.deskTaskTargetStep);
  const revision = Number(teamData?.deskTaskRevision);
  const completedSteps = Array.isArray(teamData?.deskTaskCompletedSteps)
    ? teamData.deskTaskCompletedSteps
        .map(Number)
        .filter(
          (completedStep, index, values) =>
            DESK_TASK_STEPS.includes(completedStep) &&
            values.indexOf(completedStep) === index,
        )
        .sort((a, b) => a - b)
    : [];
  const normalizedTaskStep =
    Number.isInteger(step) && step >= 1 && step <= STEP_COUNT
      ? step
      : null;
  const normalizedTargetStep =
    Number.isInteger(targetStep) && targetStep >= 1 && targetStep <= STEP_COUNT
      ? targetStep
      : null;
  const instruction =
    typeof teamData?.deskTaskInstruction === "string"
      ? teamData.deskTaskInstruction.trim()
      : normalizedTaskStep
        ? getConfiguredDeskTaskInstruction(normalizedTaskStep) ?? ""
        : "";
  const status =
    instruction || savedStatus === "idle"
      ? savedStatus
      : "idle";

  return {
    status,
    step: normalizedTaskStep,
    revision:
      Number.isInteger(revision) && revision >= 0
        ? revision
        : 0,
    instruction,
    completedSteps,
    targetStep: normalizedTargetStep,
    targetVisitedStep32:
      typeof teamData?.deskTaskTargetVisitedStep32 === "boolean"
        ? teamData.deskTaskTargetVisitedStep32
        : null,
  };
}

function getConfiguredDeskTaskInstruction(step) {
  const label = getStepLabel(step);
  const instruction = DESK_TASKS[label];
  return typeof instruction === "string" && instruction.trim()
    ? instruction.trim()
    : null;
}

function getDeskTaskName(step) {
  return DESK_TASK_NAMES[getStepLabel(step)] ?? "机作業";
}

function isStep32Skipped(step, visitedStep32) {
  return normalizeStep(step) >= STEP_41_INDEX && !visitedStep32;
}

function getManualVisitedStep32(selectedStep, currentStep, currentVisitedStep32) {
  const nextStep = normalizeStep(selectedStep);
  const previousStep = normalizeStep(currentStep);

  if (nextStep === STEP_32_INDEX) return true;
  if (nextStep < STEP_32_INDEX) return Boolean(currentVisitedStep32);
  if (previousStep >= STEP_41_INDEX) return Boolean(currentVisitedStep32);
  if (previousStep === STEP_31_INDEX && nextStep >= STEP_41_INDEX) return false;
  return true;
}

function playerStepStorageKey(team) {
  return `control-player-manual-step-${team}`;
}

function readLocalPlayerProgress(team) {
  const saved = localStorage.getItem(playerStepStorageKey(team));
  if (saved === null) return null;

  try {
    const progress = JSON.parse(saved);
    if (progress && typeof progress === "object" && "step" in progress) {
      return {
        step: normalizeStep(progress.step),
        visitedStep32:
          typeof progress.visitedStep32 === "boolean"
            ? progress.visitedStep32
            : null,
      };
    }
  } catch {
    // Older versions stored only the step number.
  }

  return { step: normalizeStep(saved), visitedStep32: null };
}

function saveLocalPlayerProgress(team, step, visitedStep32) {
  localStorage.setItem(
    playerStepStorageKey(team),
    JSON.stringify({
      step: normalizeStep(step),
      visitedStep32: Boolean(visitedStep32),
    }),
  );
}

function clearLocalPlayerProgress(team) {
  localStorage.removeItem(playerStepStorageKey(team));
}

function normalizeGameStatus(value) {
  return value === "running" || value === "ended" ? value : "idle";
}

function getStepLabel(step) {
  return STEP_LABELS[normalizeStep(step) - 1];
}

function getStepNote(step) {
  return STEP_NOTES[getStepLabel(step)] ?? "";
}

function getCameraFrameStep(cameraNumber, step) {
  const frameSteps = CAMERA_FRAME_STEPS[cameraNumber] ?? [];
  const currentStep = normalizeStep(step);

  return frameSteps
    .filter((frameStep) => STEP_LABELS.indexOf(frameStep) + 1 <= currentStep)
    .at(-1);
}

function getCameraUnlockStep(cameraNumber) {
  const unlockStepLabel = CAMERA_UNLOCK_STEP_LABELS[cameraNumber];
  return unlockStepLabel ? getStepIndex(unlockStepLabel) : STEP_COUNT + 1;
}

function isCameraUnlocked(cameraNumber, step) {
  return normalizeStep(step) >= getCameraUnlockStep(cameraNumber);
}

function getUnlockedCameras(step) {
  return Array.from({ length: CAMERA_COUNT }, (_, index) => index + 1).filter(
    (cameraNumber) => isCameraUnlocked(cameraNumber, step),
  );
}

function getStepIndex(stepLabel) {
  return STEP_LABELS.indexOf(stepLabel) + 1;
}

function formatNumber(value) {
  return String(value).padStart(2, "0");
}

function teamDocumentId(team) {
  return `team-${formatNumber(team)}`;
}

function connectionBadgeMarkup() {
  return `
    <div class="connection-badge" data-connection-badge data-connected="pending">
      RTDB CHECKING
    </div>
  `;
}

function updateConnectionBadges() {
  const version = ASSET_CACHE_CONFIG?.version ?? "unknown";
  document.querySelectorAll("[data-connection-badge]").forEach((badge) => {
    if (rtdbConnected === null) {
      badge.dataset.connected = "pending";
      badge.textContent = `RTDB CHECKING / ${version}`;
    } else if (rtdbConnected) {
      badge.dataset.connected = "true";
      badge.textContent = `RTDB ONLINE / ${version}`;
    } else {
      badge.dataset.connected = "false";
      badge.textContent = `RTDB OFFLINE / ${version}`;
    }
  });
}

async function registerPresence(reportError = true) {
  if (!rtdbConnected || route.mode === "home") return;

  const sequence = ++presenceSequence;
  await clearPresence(false);
  if (sequence !== presenceSequence || !rtdbConnected || route.mode === "home") return;

  const path =
    route.mode === "player"
      ? `${PRESENCE_ROOT}/players/${teamDocumentId(route.team)}/${clientId}`
      : `${PRESENCE_ROOT}/${route.mode}/${clientId}`;
  const presenceRef = databaseRef(realtimeDatabase, path);
  const disconnectOperation = onDisconnect(presenceRef);
  const presence = {
    ref: presenceRef,
    disconnectOperation,
    mode: route.mode,
    team: route.mode === "player" ? route.team : null,
    staffGroup: route.mode === "staff" ? route.staffGroup : null,
    clientId,
  };

  try {
    await disconnectOperation.remove();
    if (sequence !== presenceSequence) {
      await disconnectOperation.cancel();
      return;
    }

    await set(presenceRef, {
      online: true,
      mode: presence.mode,
      team: presence.team,
      staffGroup: presence.staffGroup,
      clientId,
      appVersion: ASSET_CACHE_CONFIG?.version ?? "unknown",
      connectedAt: databaseServerTimestamp(),
      lastSeenAt: databaseServerTimestamp(),
    });

    if (sequence !== presenceSequence) {
      await disconnectOperation.cancel();
      await remove(presenceRef);
      return;
    }

    activePresence = presence;
    schedulePresenceHeartbeat(presence, sequence);
  } catch (error) {
    try {
      await disconnectOperation.cancel();
    } catch {
      // 接続が切れている場合は、再接続後の再登録に任せます。
    }

    if (sequence === presenceSequence && rtdbConnected && route.mode !== "home") {
      if (reportError) showToast(`RTDB presenceの登録に失敗しました: ${error.message}`);
      schedulePresenceRetry(sequence);
    }
  }
}

async function clearPresence(invalidateSequence = true) {
  if (invalidateSequence) presenceSequence += 1;
  stopPresenceHeartbeat();
  stopPresenceRetry();
  const currentPresence = activePresence;
  activePresence = null;
  if (!currentPresence) return;

  try {
    await currentPresence.disconnectOperation.cancel();
    await remove(currentPresence.ref);
  } catch {
    // オフライン時は、登録済みのonDisconnectがサーバー側で削除を処理します。
  }
}

function refreshPresenceNow() {
  if (!rtdbConnected || route.mode === "home") return;

  const currentPresence = activePresence;
  if (!currentPresence) {
    registerPresence();
    return;
  }

  writePresenceHeartbeat(currentPresence, presenceSequence);
}

function schedulePresenceHeartbeat(presence, sequence) {
  stopPresenceHeartbeat();
  presenceHeartbeatTimer = window.setTimeout(async () => {
    presenceHeartbeatTimer = null;
    await writePresenceHeartbeat(presence, sequence);

    if (
      sequence === presenceSequence &&
      activePresence === presence &&
      rtdbConnected &&
      route.mode !== "home"
    ) {
      schedulePresenceHeartbeat(presence, sequence);
    }
  }, PRESENCE_HEARTBEAT_INTERVAL_MS);
}

function stopPresenceHeartbeat() {
  window.clearTimeout(presenceHeartbeatTimer);
  presenceHeartbeatTimer = null;
}

function schedulePresenceRetry(sequence) {
  stopPresenceRetry();
  presenceRetryTimer = window.setTimeout(() => {
    presenceRetryTimer = null;
    if (sequence === presenceSequence && rtdbConnected && route.mode !== "home") {
      registerPresence(false);
    }
  }, PRESENCE_RETRY_DELAY_MS);
}

function stopPresenceRetry() {
  window.clearTimeout(presenceRetryTimer);
  presenceRetryTimer = null;
}

async function writePresenceHeartbeat(presence, sequence) {
  if (
    sequence !== presenceSequence ||
    activePresence !== presence ||
    !rtdbConnected ||
    route.mode === "home"
  ) {
    return;
  }

  try {
    await update(presence.ref, {
      online: true,
      mode: presence.mode,
      team: presence.team,
      clientId: presence.clientId,
      appVersion: ASSET_CACHE_CONFIG?.version ?? "unknown",
      lastSeenAt: databaseServerTimestamp(),
    });
  } catch (error) {
    if (sequence === presenceSequence && activePresence === presence && rtdbConnected) {
      stopPresenceHeartbeat();
      showToast(`RTDB presenceの更新に失敗しました: ${error.message}`);
      schedulePresenceRetry(sequence);
    }
  }
}

function showToast(message, kind = "error") {
  document.querySelector(".toast")?.remove();
  clearTimeout(toastTimer);

  const toast = document.createElement("div");
  toast.className = `toast ${kind === "success" ? "is-success" : ""}`;
  toast.textContent = message;
  stage.append(toast);

  toastTimer = window.setTimeout(() => toast.remove(), 6000);
}
