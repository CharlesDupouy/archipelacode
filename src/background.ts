/** @format */
import { MessagePayload } from "./shared/types";

let creatingOffscreen: Promise<void> | null = null;

async function setupOffscreenDocument(path = "offscreen.html") {
  // Check if an offscreen document already exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });

  if (existingContexts.length > 0) {
    return;
  }

  // Create offscreen document if not already in progress
  if (creatingOffscreen) {
    await creatingOffscreen;
  } else {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: path,
      reasons: [chrome.offscreen.Reason.BLOBS],
      justification:
        "Maintain persistent WebSocket connection to Archipelago Multiworld",
    });
    await creatingOffscreen;
    creatingOffscreen = null;
  }
}

// Enable opening side panel when clicking the toolbar action icon
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));
});

// Ensure offscreen document is ready on startup
chrome.runtime.onStartup.addListener(() => {
  setupOffscreenDocument().catch(console.error);
});

// Message router between Offscreen, Side Panel, and Content Scripts
chrome.runtime.onMessage.addListener(
  (message: MessagePayload, sender, sendResponse) => {
    (async () => {
      // Ensure offscreen document is initialized if connecting or querying state
      if (
        message.type === "CONNECT_AP" ||
        message.type === "DISCONNECT_AP" ||
        message.type === "SEND_CHECK" ||
        message.type === "SEND_DEATH_LINK" ||
        message.type === "SEND_CHAT" ||
        message.type === "GET_STATE"
      ) {
        await setupOffscreenDocument();
      }

      // If state was updated from Offscreen, cache it in local storage
      if (message.type === "STATE_UPDATED") {
        await chrome.storage.local.set({ archipelacodeState: message.state });

        // Forward to all LeetCode tabs
        const tabs = await chrome.tabs.query({ url: "*://*.leetcode.com/*" });
        for (const tab of tabs) {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, message).catch(() => {});
          }
        }
      }

      sendResponse({ received: true });
    })();

    return true; // Keep sendResponse async channel open
  },
);
