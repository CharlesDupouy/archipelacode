/** @format */
import {
  ExtensionState,
  MessagePayload,
  ProblemCategory,
} from "./shared/types";

(() => {
  let currentState: ExtensionState | null = null;

  // 1. Inject the page interceptor script into the MAIN page world
  function injectScript(file: string) {
    const s = document.createElement("script");
    s.src = chrome.runtime.getURL(file);
    s.onload = () => s.remove();
    (document.head || document.documentElement).appendChild(s);
  }

  injectScript("pageInterceptor.js");

  // 2. Fetch current state from storage
  chrome.storage.local.get("archipelacodeState", (res) => {
    if (res.archipelacodeState) {
      updateState(res.archipelacodeState);
    }
  });

  // Request latest state from background
  chrome.runtime.sendMessage({ type: "GET_STATE" }).catch(() => {});

  // 3. Listen for state updates and notifications from background
  chrome.runtime.onMessage.addListener((message: MessagePayload) => {
    if (message.type === "STATE_UPDATED") {
      updateState(message.state);
    } else if (message.type === "ITEM_RECEIVED") {
      showToast(
        message.isTrap ? "trap" : "item",
        message.isTrap ? "TRAP ACTIVATED" : "Archipelago Item Received",
        `Received ${message.itemName} from ${message.sender}`,
      );
    } else if (message.type === "DEATH_LINK_RECEIVED") {
      showToast(
        "death",
        "DeathLink Received",
        `${message.source} died${message.cause ? `: ${message.cause}` : ""}`,
      );
    }
  });

  function updateState(state: ExtensionState) {
    currentState = state;

    // Send unlocked items to pageInterceptor
    window.postMessage(
      {
        type: "ARCHIPELACODE_UPDATE_ITEMS",
        unlockedItemIds: state.unlockedItemIds || [],
      },
      "*",
    );

    updateFloatingBadge();
  }

  // 4. Listen for messages from pageInterceptor
  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data) return;

    if (event.data.type === "ARCHIPELACODE_GET_ITEMS") {
      window.postMessage(
        {
          type: "ARCHIPELACODE_UPDATE_ITEMS",
          unlockedItemIds: currentState?.unlockedItemIds || [],
        },
        "*",
      );
    } else if (event.data.type === "ARCHIPELACODE_ACCEPTED") {
      const rawTitleSlug = event.data.titleSlug || "";
      const titleSlug = rawTitleSlug.toLowerCase().trim();
      console.log(
        `[ArchipelaCode Content] Received ARCHIPELACODE_ACCEPTED for "${titleSlug}"`,
      );

      if (
        currentState &&
        currentState.problems &&
        currentState.problems.length > 0
      ) {
        const problem = currentState.problems.find(
          (p) => p.titleSlug.toLowerCase().trim() === titleSlug,
        );
        if (!problem) {
          console.warn(
            `[ArchipelaCode Content] Problem "${titleSlug}" is not in current multiworld pool. Ignoring check.`,
          );
          return;
        }
        if (problem.category === ProblemCategory.Solved) {
          console.log(
            `[ArchipelaCode Content] Problem "${titleSlug}" is already marked as solved.`,
          );
          return;
        }
      }

      showToast(
        "cleared",
        "Problem Cleared",
        `Accepted by LeetCode! Sending check for "${titleSlug}" to Archipelago...`,
      );

      chrome.runtime
        .sendMessage({
          type: "SEND_CHECK",
          titleSlug,
        } as MessagePayload)
        .then((res) => {
          console.log(
            `[ArchipelaCode Content] SEND_CHECK dispatched successfully:`,
            res,
          );
        })
        .catch((err) => {
          console.error(
            `[ArchipelaCode Content] Failed to dispatch SEND_CHECK:`,
            err,
          );
        });
    } else if (event.data.type === "ARCHIPELACODE_FAILED") {
      const rawTitleSlug = event.data.titleSlug || "";
      const titleSlug = rawTitleSlug.toLowerCase().trim();
      const statusMsg = event.data.statusMsg;

      if (
        currentState &&
        currentState.problems &&
        currentState.problems.length > 0
      ) {
        const problem = currentState.problems.find(
          (p) => p.titleSlug.toLowerCase().trim() === titleSlug,
        );
        if (!problem) {
          return;
        }
      }

      if (currentState?.deathLinkEnabled) {
        showToast(
          "death",
          "DeathLink Triggered",
          `Submission failed (${statusMsg}) on "${titleSlug}". Sending death to multiworld...`,
        );
        chrome.runtime
          .sendMessage({
            type: "SEND_DEATH_LINK",
            cause: `failed test cases (${statusMsg}) on "${titleSlug}"`,
          } as MessagePayload)
          .catch(() => {});
      }
    }
  });

  // 5. In-page Toast Notifications (antislop design with clean SVG icons)
  function showToast(
    type: "item" | "trap" | "death" | "cleared" | "notice",
    title: string,
    text: string,
  ) {
    let container = document.getElementById("archipelacode-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "archipelacode-toast-container";
      container.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 9999999;
        display: flex;
        flex-direction: column;
        gap: 12px;
        pointer-events: none;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      `;
      document.body.appendChild(container);
    }

    const configMap = {
      cleared: {
        color: "#10b981",
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`,
      },
      item: {
        color: "#10b981",
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
      },
      trap: {
        color: "#f59e0b",
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
      },
      death: {
        color: "#ef4444",
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
      },
      notice: {
        color: "#3b82f6",
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
      },
    };

    const currentConfig = configMap[type] || configMap.notice;

    const toast = document.createElement("div");
    toast.style.cssText = `
      background: #18181b;
      border: 1px solid ${currentConfig.color};
      border-radius: 8px;
      padding: 12px 18px;
      color: #fafafa;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      max-width: 380px;
      pointer-events: auto;
      transition: all 0.25s ease;
      animation: slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    toast.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        ${currentConfig.icon}
        <strong style="color:${currentConfig.color}; font-size:13px; font-weight:600;">${title}</strong>
      </div>
      <p style="font-size:12px; color:#d4d4d8; margin:6px 0 0 0; line-height:1.4;">
        ${text}
      </p>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }

  // 6. Floating Status Badge on LeetCode Problem Page
  function updateFloatingBadge() {
    const match = window.location.pathname.match(/\/problems\/([^/]+)/);
    if (!match) return;
    const titleSlug = match[1].toLowerCase().trim();

    let badge = document.getElementById("archipelacode-floating-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "archipelacode-floating-badge";
      badge.style.cssText = `
        position: fixed;
        top: 60px;
        right: 20px;
        z-index: 999999;
        background: rgba(24, 24, 27, 0.95);
        backdrop-filter: blur(8px);
        border: 1px solid #3f3f46;
        border-radius: 20px;
        padding: 6px 14px;
        font-size: 12px;
        font-weight: 500;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #ffffff;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        user-select: none;
        transition: all 0.2s ease;
      `;
      badge.onclick = () => {
        chrome.runtime.sendMessage({ type: "GET_STATE" });
      };
      document.body.appendChild(badge);
    }

    if (!currentState || currentState.status !== "CONNECTED") {
      badge.innerHTML = `<span style="color:#71717a;">●</span> ArchipelaCode: Disconnected`;
      badge.style.borderColor = "#3f3f46";
      return;
    }

    const problem = currentState.problems.find(
      (p) => p.titleSlug.toLowerCase().trim() === titleSlug,
    );
    if (!problem) {
      badge.innerHTML = `<span style="color:#52525b;">●</span> ArchipelaCode: Not in Multiworld Pool`;
      badge.style.borderColor = "#27272a";
      return;
    }

    if (problem.category === ProblemCategory.Solved) {
      badge.innerHTML = `<span style="color:#10b981; font-weight:600;">✓</span> ArchipelaCode: Check Cleared`;
      badge.style.borderColor = "#10b981";
    } else if (problem.category === ProblemCategory.Locked) {
      badge.innerHTML = `<span style="color:#f59e0b;">●</span> ArchipelaCode: Region Locked`;
      badge.style.borderColor = "#f59e0b";
    } else {
      badge.innerHTML = `<span style="color:#3b82f6;">●</span> ArchipelaCode: Check Available (${problem.difficulty})`;
      badge.style.borderColor = "#3b82f6";
    }
  }

  // Monitor URL changes in SPA
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      updateFloatingBadge();
    }
  }).observe(document, { subtree: true, childList: true });
})();
