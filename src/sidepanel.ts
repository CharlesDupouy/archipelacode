/** @format */
import { PYTHON_ITEM_MAP } from "./languages/pythonLexer";
import {
  APConnectionConfig,
  APStatus,
  ExtensionState,
  MessagePayload,
  ProblemCategory,
} from "./shared/types";

let state: ExtensionState | null = null;
let currentCategoryFilter: ProblemCategory = ProblemCategory.Available;
let currentDifficultyFilter: string = "all";
let currentSearchTerm: string = "";

// DOM Elements
const connectSection = document.getElementById("connect-section")!;
const activeSection = document.getElementById("active-section")!;
const statusPill = document.getElementById("status-pill")!;
const statusText = document.getElementById("status-text")!;

const inputHost = document.getElementById("input-host") as HTMLInputElement;
const inputPort = document.getElementById("input-port") as HTMLInputElement;
const inputSlot = document.getElementById("input-slot") as HTMLInputElement;
const inputPass = document.getElementById("input-pass") as HTMLInputElement;
const btnConnect = document.getElementById("btn-connect") as HTMLButtonElement;
const btnDisconnect = document.getElementById(
  "btn-disconnect",
) as HTMLButtonElement;

const goalCounter = document.getElementById("goal-counter")!;
const goalProgressBar = document.getElementById("goal-progress-bar")!;
const slotDisplay = document.getElementById("slot-display")!;
const deathlinkBadge = document.getElementById("deathlink-badge")!;

const problemSearch = document.getElementById(
  "problem-search",
) as HTMLInputElement;
const problemsList = document.getElementById("problems-list")!;
const countAvailable = document.getElementById("count-available")!;
const countSolved = document.getElementById("count-solved")!;
const countLocked = document.getElementById("count-locked")!;
const countAll = document.getElementById("count-all")!;

const progCount = document.getElementById("prog-count")!;
const pythonInventoryGrid = document.getElementById("python-inventory-grid")!;
const specialInventoryList = document.getElementById("special-inventory-list")!;

const chatMessages = document.getElementById("chat-messages")!;
const chatInput = document.getElementById("chat-input") as HTMLInputElement;
const btnSendChat = document.getElementById(
  "btn-send-chat",
) as HTMLButtonElement;

// Tab switcher
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".tab-btn")
      .forEach((b) => b.classList.remove("active"));
    document
      .querySelectorAll(".tab-content")
      .forEach((c) => c.classList.remove("active"));
    btn.classList.add("active");
    const tabName = btn.getAttribute("data-tab");
    document.getElementById(`tab-${tabName}`)?.classList.add("active");
  });
});

// Category filter pills
document.querySelectorAll(".filter-pill").forEach((pill) => {
  pill.addEventListener("click", () => {
    document
      .querySelectorAll(".filter-pill")
      .forEach((p) => p.classList.remove("active"));
    pill.classList.add("active");
    currentCategoryFilter = pill.getAttribute("data-cat") as ProblemCategory;
    renderProblems();
  });
});

// Difficulty filter buttons
document.querySelectorAll(".diff-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".diff-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentDifficultyFilter = btn.getAttribute("data-diff") || "all";
    renderProblems();
  });
});

// Search input
problemSearch?.addEventListener("input", () => {
  currentSearchTerm = problemSearch.value.trim().toLowerCase();
  renderProblems();
});

// Connect button
btnConnect?.addEventListener("click", () => {
  const host = inputHost.value.trim() || "archipelago.gg";
  const port = Number(inputPort.value.trim()) || 38281;
  const slot = inputSlot.value.trim();
  const password = inputPass.value.trim();

  if (!slot) {
    alert("Please enter a slot name.");
    return;
  }

  const config: APConnectionConfig = {
    hostname: host,
    port,
    slotname: slot,
    password,
  };

  chrome.storage.local.set({ archipelacodeConfig: config });

  chrome.runtime.sendMessage({
    type: "CONNECT_AP",
    config,
  } as MessagePayload);
});

// Disconnect button
btnDisconnect?.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "DISCONNECT_AP" } as MessagePayload);
});

// Chat Send button
btnSendChat?.addEventListener("click", sendChatMessage);
chatInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendChatMessage();
});

function sendChatMessage() {
  const msg = chatInput.value.trim();
  if (msg) {
    chrome.runtime.sendMessage({
      type: "SEND_CHAT",
      message: msg,
    } as MessagePayload);
    chatInput.value = "";
  }
}

// Restore saved config
chrome.storage.local.get(
  ["archipelacodeConfig", "archipelacodeState"],
  (res) => {
    if (res.archipelacodeConfig) {
      inputHost.value = res.archipelacodeConfig.hostname || "archipelago.gg";
      inputPort.value = String(res.archipelacodeConfig.port || "");
      inputSlot.value = res.archipelacodeConfig.slotname || "";
      inputPass.value = res.archipelacodeConfig.password || "";
    }
    if (res.archipelacodeState) {
      applyState(res.archipelacodeState);
    }
  },
);

// Query latest state
chrome.runtime.sendMessage({ type: "GET_STATE" }, (resp) => {
  if (resp?.state) {
    applyState(resp.state);
  }
});

// Listen for updates
chrome.runtime.onMessage.addListener((message: MessagePayload) => {
  if (message.type === "STATE_UPDATED") {
    applyState(message.state);
  }
});

function applyState(newState: ExtensionState) {
  state = newState;

  // Status pill
  statusPill.className = `status-pill ${newState.status.toLowerCase()}`;
  statusText.textContent = newState.status;

  if (newState.status === APStatus.CONNECTED) {
    connectSection.style.display = "none";
    activeSection.style.display = "flex";

    // Goal and progress
    const solvedCount = newState.checkedLocations?.length || 0;
    const goal = newState.endGoal || 40;
    const pct = Math.min(100, Math.round((solvedCount / goal) * 100));

    goalCounter.textContent = `${solvedCount} / ${goal} (${pct}%)`;
    goalProgressBar.style.width = `${pct}%`;
    slotDisplay.textContent = `Slot: ${newState.slotname || "-"}`;

    if (newState.deathLinkEnabled) {
      deathlinkBadge.style.display = "inline-block";
    } else {
      deathlinkBadge.style.display = "none";
    }

    renderCounters();
    renderProblems();
    renderInventory();
    renderChat();
  } else {
    connectSection.style.display = "block";
    activeSection.style.display = "none";
  }
}

function renderCounters() {
  if (!state) return;
  const problems = state.problems || [];
  const available = problems.filter(
    (p) => p.category === ProblemCategory.Available,
  ).length;
  const solved = problems.filter(
    (p) => p.category === ProblemCategory.Solved,
  ).length;
  const locked = problems.filter(
    (p) => p.category === ProblemCategory.Locked,
  ).length;

  countAvailable.textContent = String(available);
  countSolved.textContent = String(solved);
  countLocked.textContent = String(locked);
  countAll.textContent = String(problems.length);

  const badgeProblems = document.getElementById("tab-badge-problems");
  if (badgeProblems) badgeProblems.textContent = String(available);
  const badgeInventory = document.getElementById("tab-badge-inventory");
  if (badgeInventory)
    badgeInventory.textContent = `${state.unlockedItemIds.length} unlocked`;
}

function renderProblems() {
  if (!state || !problemsList) return;
  problemsList.innerHTML = "";

  let filtered = state.problems || [];

  // Filter by category
  if (currentCategoryFilter !== ProblemCategory.All) {
    filtered = filtered.filter((p) => p.category === currentCategoryFilter);
  }

  // Filter by difficulty
  if (currentDifficultyFilter !== "all") {
    filtered = filtered.filter(
      (p) => p.difficulty.toUpperCase() === currentDifficultyFilter,
    );
  }

  // Filter by search
  if (currentSearchTerm) {
    filtered = filtered.filter((p) =>
      p.title.toLowerCase().includes(currentSearchTerm),
    );
  }

  if (filtered.length === 0) {
    problemsList.innerHTML = `<div style="text-align:center; padding:24px; color:#71717a; font-size:12px;">No problems matching current filters.</div>`;
    return;
  }

  filtered.forEach((prob) => {
    const card = document.createElement("div");
    card.className = "problem-card";

    let statusIcon = "●";
    let statusColor = "#3b82f6";
    if (prob.category === ProblemCategory.Solved) {
      statusIcon = "✓";
      statusColor = "#10b981";
    } else if (prob.category === ProblemCategory.Locked) {
      statusIcon = "🔒";
      statusColor = "#f59e0b";
    }

    card.innerHTML = `
      <div class="problem-info">
        <span class="diff-tag ${prob.difficulty}">${prob.difficulty.slice(0, 4)}</span>
        <span class="problem-title" title="${prob.title}">${prob.title}</span>
      </div>
      <span class="problem-status-icon" style="color:${statusColor};">${statusIcon}</span>
    `;

    // Click to navigate active tab to LeetCode problem
    card.addEventListener("click", () => {
      const targetUrl = `https://leetcode.com/problems/${prob.titleSlug}/`;
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id) {
          chrome.tabs.update(tabs[0].id, { url: targetUrl });
        } else {
          chrome.tabs.create({ url: targetUrl });
        }
      });
    });

    problemsList.appendChild(card);
  });
}

function renderInventory() {
  if (!state || !pythonInventoryGrid) return;
  pythonInventoryGrid.innerHTML = "";

  const unlockedIds = new Set(state.unlockedItemIds || []);

  // 1. Progressive unlocks
  const progCountValue =
    state.unlockedItemIds?.filter((id) => id === 6700902002).length || 0;
  const totalProgBatches = 1 + progCountValue;
  progCount.textContent = `${totalProgBatches} / 5 (${totalProgBatches * 20}%)`;

  // 2. Python language features
  for (const [idStr, name] of Object.entries(PYTHON_ITEM_MAP)) {
    const itemId = Number(idStr);
    const isUnlocked = unlockedIds.has(itemId);

    const pill = document.createElement("div");
    pill.className = `item-pill ${isUnlocked ? "unlocked" : "locked"}`;
    pill.innerHTML = `
      <span>${isUnlocked ? "✓" : "🔒"}</span>
      <span>${name}</span>
    `;
    pythonInventoryGrid.appendChild(pill);
  }

  // 3. Special items (Traps & Assistants)
  specialInventoryList.innerHTML = "";
  const itemNames = state.unlockedItemNames || [];
  const traps = itemNames.filter((name) => name.toLowerCase().includes("trap"));
  const assistants = itemNames.filter((name) =>
    ["copilot", "claude", "cursor", "chatgpt", "aider", "jules", "gemini"].some(
      (k) => name.toLowerCase().includes(k),
    ),
  );

  const specialSummary = document.createElement("div");
  specialSummary.className = "prog-card";
  specialSummary.innerHTML = `
    <span>AI Assistants Unlocked: <strong>${assistants.length}</strong></span>
    <span>Traps Triggered: <strong style="color:#ef4444;">${traps.length}</strong></span>
  `;
  specialInventoryList.appendChild(specialSummary);
}

function renderChat() {
  if (!state || !chatMessages) return;
  chatMessages.innerHTML = "";

  (state.chatLog || []).forEach((msg) => {
    const line = document.createElement("div");
    line.className = "chat-line";
    line.textContent = msg;
    chatMessages.appendChild(line);
  });

  chatMessages.scrollTop = chatMessages.scrollHeight;
}
