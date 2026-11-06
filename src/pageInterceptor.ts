/**
 * Runs in the MAIN execution world of leetcode.com to intercept fetch requests
 * and Monaco Editor code submissions.
 */

import { analyzePythonFeatures, PYTHON_ITEM_MAP } from "./languages/pythonLexer";

(() => {
  let unlockedItemIds: Set<number> = new Set();

  // Listen for unlocked items updates from content script
  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data) return;
    if (event.data.type === "ARCHIPELACODE_UPDATE_ITEMS") {
      unlockedItemIds = new Set(event.data.unlockedItemIds || []);
    }
  });

  // Request initial items from content script
  window.postMessage({ type: "ARCHIPELACODE_GET_ITEMS" }, "*");

  // Show an in-page modal/toast
  function showBlockedNotification(missingItems: string[]) {
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

    const toast = document.createElement("div");
    toast.style.cssText = `
      background: #1e1e24;
      border: 2px solid #ef4444;
      border-radius: 8px;
      padding: 16px 20px;
      color: #ffffff;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      max-width: 420px;
      pointer-events: auto;
      animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    toast.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
        <span style="font-size:20px;">🚫</span>
        <strong style="color:#ef4444; font-size:15px;">ArchipelaCode: Submission Blocked!</strong>
      </div>
      <p style="font-size:13px; color:#d1d5db; margin:0 0 8px 0; line-height:1.4;">
        Your solution uses language features that you haven't unlocked yet in Archipelago:
      </p>
      <ul style="margin:0 0 10px 0; padding-left:20px; font-size:13px; color:#f87171;">
        ${missingItems.map((item) => `<li><strong>${item}</strong></li>`).join("")}
      </ul>
      <p style="font-size:11px; color:#9ca3af; margin:0;">
        Unlock these items in the multiworld before submitting!
      </p>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.4s ease";
      setTimeout(() => toast.remove(), 400);
    }, 6000);
  }

  // Intercept window.fetch
  const originalFetch = window.fetch;
  window.fetch = async function (...args: any[]) {
    const [resource, config] = args;
    const url = typeof resource === "string" ? resource : resource?.url || "";

    // Check for LeetCode submit route: /problems/<slug>/submit/
    if (url.includes("/problems/") && url.includes("/submit/")) {
      const match = url.match(/\/problems\/([^/]+)\/submit\//);
      const titleSlug = match ? match[1] : "";

      if (config && config.body) {
        try {
          const body = JSON.parse(config.body.toString());
          const lang = (body.lang || "").toLowerCase();
          const code = body.typed_code || "";

          if (lang.startsWith("python")) {
            const violations = analyzePythonFeatures(code, unlockedItemIds);
            if (violations.length > 0) {
              const uniqueMissingNames = Array.from(
                new Set(violations.map((v) => v.itemName)),
              );
              showBlockedNotification(uniqueMissingNames);

              // Cancel submission
              return Promise.reject(
                new Error("ArchipelaCode: Submission blocked due to locked language features."),
              );
            }
          }
        } catch (e) {
          console.warn("[ArchipelaCode] Error analyzing code:", e);
        }
      }
    }

    // Call real fetch
    const response = await originalFetch.apply(this, args);

    // Check for LeetCode check route: /submissions/detail/<id>/check/
    if (url.includes("/submissions/detail/") && url.includes("/check/")) {
      try {
        const clone = response.clone();
        clone.json().then((data) => {
          if (data && data.state === "SUCCESS") {
            const titleSlugMatch = window.location.pathname.match(/\/problems\/([^/]+)/);
            const titleSlug = titleSlugMatch ? titleSlugMatch[1] : "";

            if (data.status_msg === "Accepted") {
              window.postMessage(
                {
                  type: "ARCHIPELACODE_ACCEPTED",
                  titleSlug,
                },
                "*",
              );
            } else {
              window.postMessage(
                {
                  type: "ARCHIPELACODE_FAILED",
                  titleSlug,
                  statusMsg: data.status_msg,
                },
                "*",
              );
            }
          }
        }).catch(() => {});
      } catch (e) {
        // ignore
      }
    }

    return response;
  };
})();
