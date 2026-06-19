import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  runTransaction,
  serverTimestamp as firestoreServerTimestamp,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import {
  getDatabase,
  onDisconnect,
  onValue,
  ref as databaseRef,
  remove,
  serverTimestamp as databaseServerTimestamp,
  set,
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
const STEP_COUNT = 10;
const PRESENCE_ROOT = "control/presence";

const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);
const realtimeDatabase = getDatabase(app);

const stage = document.querySelector("#stage");
const clientId = getClientId();

let route = readRoute();
let rtdbConnected = null;
let activePresence = null;
let presenceSequence = 0;
let renderSequence = 0;
let viewCleanups = [];
let toastTimer = null;

resizeStage();
window.addEventListener("resize", resizeStage);
window.addEventListener("popstate", () => {
  route = readRoute();
  renderRoute();
});
window.addEventListener("keydown", (event) => {
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

renderRoute();

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
  const team = Number(params.get("team"));

  if (mode === "staff") return { mode: "staff" };
  if (mode === "player" && Number.isInteger(team) && team >= 1 && team <= TEAM_COUNT) {
    return { mode: "player", team };
  }
  return { mode: "home" };
}

function navigate(nextRoute) {
  const url = new URL(window.location.href);
  url.search = "";

  if (nextRoute.mode === "staff") {
    url.searchParams.set("mode", "staff");
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

  if (route.mode === "staff") {
    renderStaff();
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
        aria-label="チーム${team}のプレイヤー画面を開く">${team}</button>
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
          <button class="mode-button" id="open-staff" type="button">STAFF</button>
          <button class="mode-button is-disabled" type="button" disabled>
            MASTER
            <small>NOT IMPLEMENTED</small>
          </button>
        </div>
      </div>
    </section>
  `;

  stage.querySelectorAll("[data-team]").forEach((button) => {
    button.addEventListener("click", () => {
      navigate({ mode: "player", team: Number(button.dataset.team) });
    });
  });
  stage.querySelector("#open-staff").addEventListener("click", () => {
    navigate({ mode: "staff" });
  });
}

function renderStaff() {
  stage.innerHTML = `
    <section class="screen staff-screen">
      <header class="staff-topbar">
        <div class="staff-brand">
          <button class="nav-button" id="staff-home" type="button">← HOME</button>
          <h1>STAFF CONTROL</h1>
          <p class="eyebrow">ACTIVE PLAYER TERMINALS</p>
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
          <div class="staff-control-row">
            <div class="step-band">
              <span class="step-team" id="selected-team-label">NO TEAM</span>
              <span class="step-value" id="selected-step-label">STEP -- / ${formatNumber(STEP_COUNT)}</span>
            </div>
            <button class="step-button" id="step-forward" type="button" disabled>進める</button>
            <button class="step-button" id="step-back" type="button" disabled>戻す</button>
          </div>
        </section>
      </div>
    </section>
  `;

  stage.querySelector("#staff-home").addEventListener("click", () => navigate({ mode: "home" }));

  const state = {
    activeTeams: [],
    selectedTeam: null,
    steps: new Map(),
    commandPending: false,
  };

  const unsubscribePresence = onValue(
    databaseRef(realtimeDatabase, `${PRESENCE_ROOT}/players`),
    (snapshot) => {
      const value = snapshot.val() ?? {};
      state.activeTeams = Object.entries(value)
        .filter(([, connections]) => connections && Object.keys(connections).length > 0)
        .map(([teamKey]) => Number(teamKey.replace("team-", "")))
        .filter((team) => Number.isInteger(team) && team >= 1 && team <= TEAM_COUNT)
        .sort((a, b) => a - b);

      if (!state.activeTeams.includes(state.selectedTeam)) {
        state.selectedTeam = state.activeTeams[0] ?? null;
      }
      updateStaffView(state);
    },
    (error) => showToast(`プレイヤー接続一覧を取得できません: ${error.message}`),
  );

  const unsubscribeTeams = onSnapshot(
    collection(firestore, "teams"),
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const team = Number(change.doc.id.replace("team-", ""));
        if (!Number.isInteger(team)) return;

        if (change.type === "removed") {
          state.steps.delete(team);
        } else {
          state.steps.set(team, normalizeStep(change.doc.data().step));
        }
      });
      updateStaffView(state);
    },
    (error) => showToast(`FirestoreのSTEP監視に失敗しました: ${error.message}`),
  );

  stage.querySelector("#step-forward").addEventListener("click", () => changeStep(state, 1));
  stage.querySelector("#step-back").addEventListener("click", () => changeStep(state, -1));

  viewCleanups.push(unsubscribePresence, unsubscribeTeams);
  updateStaffView(state);
}

function updateStaffView(state) {
  const list = stage.querySelector("#active-team-list");
  if (!list) return;

  list.innerHTML = Array.from({ length: TEAM_COUNT }, (_, index) => {
    const team = index + 1;
    const isOnline = state.activeTeams.includes(team);
    const isSelected = team === state.selectedTeam;

    return `
      <button
        class="staff-team-button ${isOnline ? "is-online" : ""} ${isSelected ? "is-selected" : ""}"
        type="button"
        data-staff-team="${team}"
        aria-label="チーム${team}${isOnline ? "（接続中）" : "（未接続）"}"
        ${isOnline ? "" : "disabled"}
      >
        ${team}
      </button>
    `;
  }).join("");

  list.querySelectorAll("[data-staff-team]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedTeam = Number(button.dataset.staffTeam);
      updateStaffView(state);
    });
  });

  const selectedTeamLabel = stage.querySelector("#selected-team-label");
  const selectedStepLabel = stage.querySelector("#selected-step-label");
  const forwardButton = stage.querySelector("#step-forward");
  const backButton = stage.querySelector("#step-back");
  const selectedStep = state.selectedTeam ? state.steps.get(state.selectedTeam) ?? 1 : null;

  selectedTeamLabel.textContent = state.selectedTeam
    ? `TEAM ${formatNumber(state.selectedTeam)}`
    : "NO TEAM";
  selectedStepLabel.textContent = selectedStep
    ? `STEP ${formatNumber(selectedStep)} / ${formatNumber(STEP_COUNT)}`
    : `STEP -- / ${formatNumber(STEP_COUNT)}`;

  forwardButton.disabled =
    state.commandPending || !state.selectedTeam || selectedStep >= STEP_COUNT;
  backButton.disabled = state.commandPending || !state.selectedTeam || selectedStep <= 1;
  forwardButton.classList.toggle("loading", state.commandPending);
  backButton.classList.toggle("loading", state.commandPending);
}

async function changeStep(state, delta) {
  if (!state.selectedTeam || state.commandPending) return;

  const team = state.selectedTeam;
  const teamDocument = doc(firestore, "teams", teamDocumentId(team));
  state.commandPending = true;
  updateStaffView(state);

  try {
    await runTransaction(firestore, async (transaction) => {
      const snapshot = await transaction.get(teamDocument);
      const currentStep = snapshot.exists() ? normalizeStep(snapshot.data().step) : 1;
      const nextStep = Math.min(STEP_COUNT, Math.max(1, currentStep + delta));

      transaction.set(
        teamDocument,
        {
          teamNumber: team,
          step: nextStep,
          updatedAt: firestoreServerTimestamp(),
          updatedBy: clientId,
        },
        { merge: true },
      );
    });
  } catch (error) {
    showToast(`STEPを更新できません: ${error.message}`);
  } finally {
    state.commandPending = false;
    updateStaffView(state);
  }
}

function renderPlayer(team) {
  stage.innerHTML = `
    <section class="screen player-screen">
      <div class="player-connection">${connectionBadgeMarkup()}</div>
      <div class="player-step-badge">
        <span>TEAM ${formatNumber(team)} / FIRESTORE SYNC</span>
        <strong id="player-step">STEP --</strong>
      </div>
      <button
        class="hidden-staff-trigger"
        id="hidden-staff-trigger"
        type="button"
        aria-label="スタッフメニュー"
      ></button>
    </section>
  `;

  setupHiddenStaffMenu();

  const teamDocument = doc(firestore, "teams", teamDocumentId(team));
  runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(teamDocument);
    if (!snapshot.exists()) {
      transaction.set(teamDocument, {
        teamNumber: team,
        step: 1,
        createdAt: firestoreServerTimestamp(),
      });
    }
  }).catch((error) => {
    showToast(`チームデータを初期化できません: ${error.message}`);
  });

  const unsubscribe = onSnapshot(
    teamDocument,
    (snapshot) => {
      const step = snapshot.exists() ? normalizeStep(snapshot.data().step) : 1;
      const label = stage.querySelector("#player-step");
      if (label) label.textContent = `STEP ${formatNumber(step)} / ${formatNumber(STEP_COUNT)}`;
    },
    (error) => showToast(`STEPを受信できません: ${error.message}`),
  );

  viewCleanups.push(unsubscribe);
}

function setupHiddenStaffMenu() {
  const trigger = stage.querySelector("#hidden-staff-trigger");
  let tapCount = 0;
  let resetTimer = null;

  trigger.addEventListener("click", () => {
    tapCount += 1;
    clearTimeout(resetTimer);

    if (tapCount >= 5) {
      tapCount = 0;
      openStaffPopup();
      return;
    }

    resetTimer = window.setTimeout(() => {
      tapCount = 0;
    }, 1800);
  });

  viewCleanups.push(() => clearTimeout(resetTimer));
}

function openStaffPopup() {
  if (stage.querySelector("#staff-popup")) return;

  const popup = document.createElement("div");
  popup.className = "staff-popup-backdrop";
  popup.id = "staff-popup";
  popup.innerHTML = `
    <section class="staff-popup" role="dialog" aria-modal="true" aria-labelledby="staff-popup-title">
      <p class="eyebrow">AUTHORIZED PERSONNEL ONLY</p>
      <h2 id="staff-popup-title">STAFF MENU</h2>
      <div class="staff-popup-actions">
        <button type="button" data-popup-action="home">ホームに戻る</button>
        <button type="button" data-popup-action="reload">リロード</button>
        <button type="button" data-popup-action="close">戻る</button>
      </div>
    </section>
  `;
  stage.append(popup);

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

function normalizeStep(value) {
  const step = Number(value);
  if (!Number.isFinite(step)) return 1;
  return Math.min(STEP_COUNT, Math.max(1, Math.round(step)));
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
  document.querySelectorAll("[data-connection-badge]").forEach((badge) => {
    if (rtdbConnected === null) {
      badge.dataset.connected = "pending";
      badge.textContent = "RTDB CHECKING";
    } else if (rtdbConnected) {
      badge.dataset.connected = "true";
      badge.textContent = "RTDB ONLINE";
    } else {
      badge.dataset.connected = "false";
      badge.textContent = "RTDB OFFLINE";
    }
  });
}

async function registerPresence() {
  if (!rtdbConnected || route.mode === "home") return;

  const sequence = ++presenceSequence;
  await clearPresence(false);
  if (sequence !== presenceSequence || !rtdbConnected || route.mode === "home") return;

  const path =
    route.mode === "player"
      ? `${PRESENCE_ROOT}/players/${teamDocumentId(route.team)}/${clientId}`
      : `${PRESENCE_ROOT}/staff/${clientId}`;
  const presenceRef = databaseRef(realtimeDatabase, path);
  const disconnectOperation = onDisconnect(presenceRef);

  try {
    await disconnectOperation.remove();
    if (sequence !== presenceSequence) {
      await disconnectOperation.cancel();
      return;
    }

    await set(presenceRef, {
      online: true,
      mode: route.mode,
      team: route.mode === "player" ? route.team : null,
      clientId,
      connectedAt: databaseServerTimestamp(),
    });

    if (sequence !== presenceSequence) {
      await disconnectOperation.cancel();
      await remove(presenceRef);
      return;
    }

    activePresence = { ref: presenceRef, disconnectOperation };
  } catch (error) {
    showToast(`RTDB presenceの登録に失敗しました: ${error.message}`);
  }
}

async function clearPresence(invalidateSequence = true) {
  if (invalidateSequence) presenceSequence += 1;
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

function showToast(message, kind = "error") {
  document.querySelector(".toast")?.remove();
  clearTimeout(toastTimer);

  const toast = document.createElement("div");
  toast.className = `toast ${kind === "success" ? "is-success" : ""}`;
  toast.textContent = message;
  stage.append(toast);

  toastTimer = window.setTimeout(() => toast.remove(), 6000);
}
