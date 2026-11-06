/**
 * Runs in the MAIN execution world of leetcode.com to intercept fetch requests
 * and Monaco Editor code submissions.
 */

import { analyzePythonFeatures } from "./languages/pythonLexer";

(() => {
  let unlockedItemIds: Set<number> = new Set();
  const activeSubmissionIds = new Set<string>();
  const activeInterpretIds = new Set<string>();
  const submissionSlugMap = new Map<string, string>();
  const processedChecks = new Set<string>();

  // Listen for unlocked items updates from content script
  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data) return;
    if (event.data.type === "ARCHIPELACODE_UPDATE_ITEMS") {
      unlockedItemIds = new Set(event.data.unlockedItemIds || []);
    }
  });

  // Request initial items from content script
  window.postMessage({ type: "ARCHIPELACODE_GET_ITEMS" }, "*");

  // Show an in-page toast notification (clean antislop design)
  function showNotification(
    type: "blocked" | "warning",
    missingItems: string[],
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

    const isBlocked = type === "blocked";
    const accentColor = isBlocked ? "#ef4444" : "#f59e0b";
    const headerTitle = isBlocked
      ? "ArchipelaCode: Submission Blocked"
      : "ArchipelaCode: Test Run Notice";
    const desc = isBlocked
      ? "Your solution uses language features that you haven't unlocked yet in Archipelago:"
      : "Your code uses locked language features. You can test sample cases, but official submission will be blocked until unlocked:";
    const footer = isBlocked
      ? "Unlock these items in the multiworld before submitting."
      : "Unlock these items in the multiworld to qualify for official submission.";

    const toast = document.createElement("div");
    toast.style.cssText = `
      background: #18181b;
      border: 1px solid ${accentColor};
      border-radius: 8px;
      padding: 14px 18px;
      color: #fafafa;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      max-width: 420px;
      pointer-events: auto;
      animation: slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    const iconSvg = isBlocked
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

    toast.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
        ${iconSvg}
        <strong style="color:${accentColor}; font-size:14px; font-weight:600;">${headerTitle}</strong>
      </div>
      <p style="font-size:13px; color:#d4d4d8; margin:0 0 8px 0; line-height:1.4;">
        ${desc}
      </p>
      <ul style="margin:0 0 8px 0; padding-left:20px; font-size:13px; color:${accentColor};">
        ${missingItems.map((item) => `<li><strong>${item}</strong></li>`).join("")}
      </ul>
      <p style="font-size:11px; color:#a1a1aa; margin:0;">
        ${footer}
      </p>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 6000);
  }

  // Intercept window.fetch
  const originalFetch = window.fetch;
  window.fetch = async function (...args: any[]) {
    const [resource, config] = args;
    const url = typeof resource === "string" ? resource : resource?.url || "";

    // 1. Intercept LeetCode test run route: /problems/<slug>/interpret_solution/
    if (url.includes("/problems/") && url.includes("/interpret_solution/")) {
      const match = url.match(/\/problems\/([^/]+)\/interpret_solution\//);
      const titleSlug = match ? match[1].toLowerCase().trim() : "";
      console.log(
        `[ArchipelaCode Interceptor] Detected TEST RUN (interpret) for slug: "${titleSlug}"`,
      );

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
              showNotification("warning", uniqueMissingNames);
            }
          }
        } catch (e) {
          console.warn(
            "[ArchipelaCode Interceptor] Error analyzing test run code:",
            e,
          );
        }
      }

      const response = await originalFetch.apply(this, args);

      try {
        const clone = response.clone();
        clone
          .json()
          .then((resData) => {
            if (resData && resData.interpret_id) {
              const interpId = String(resData.interpret_id);
              console.log(
                `[ArchipelaCode Interceptor] Registered test run interpret_id: ${interpId}`,
              );
              activeInterpretIds.add(interpId);
              setTimeout(
                () => activeInterpretIds.delete(interpId),
                5 * 60 * 1000,
              );
            }
          })
          .catch(() => {});
      } catch (e) {
        // ignore
      }

      return response;
    }

    // 2. Intercept LeetCode official submit route: /problems/<slug>/submit/
    if (url.includes("/problems/") && url.includes("/submit/")) {
      const match = url.match(/\/problems\/([^/]+)\/submit\//);
      const titleSlug = match ? match[1].toLowerCase().trim() : "";
      console.log(
        `[ArchipelaCode Interceptor] Detected OFFICIAL SUBMISSION for slug: "${titleSlug}"`,
      );

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
              console.warn(
                "[ArchipelaCode Interceptor] Submission blocked due to locked features:",
                uniqueMissingNames,
              );
              showNotification("blocked", uniqueMissingNames);

              // Cancel submission
              return Promise.reject(
                new Error(
                  "ArchipelaCode: Submission blocked due to locked language features.",
                ),
              );
            }
          }
        } catch (e) {
          console.warn("[ArchipelaCode Interceptor] Error analyzing code:", e);
        }
      }

      // Execute the submit fetch
      const response = await originalFetch.apply(this, args);

      // Extract submission_id from response to register it
      try {
        const clone = response.clone();
        clone
          .json()
          .then((resData) => {
            if (resData && resData.submission_id) {
              const subIdStr = String(resData.submission_id);
              console.log(
                `[ArchipelaCode Interceptor] Registered official submission_id: ${subIdStr} for "${titleSlug}"`,
              );
              activeSubmissionIds.add(subIdStr);
              if (titleSlug) {
                submissionSlugMap.set(subIdStr, titleSlug);
              }
              // Cleanup after 5 minutes
              setTimeout(() => {
                activeSubmissionIds.delete(subIdStr);
                submissionSlugMap.delete(subIdStr);
              }, 5 * 60 * 1000);
            }
          })
          .catch(() => {});
      } catch (e) {
        // ignore
      }

      return response;
    }

    // 3. Normal fetch for other routes
    const response = await originalFetch.apply(this, args);

    // 4. Intercept LeetCode check route: /submissions/detail/<id>/check/
    if (url.includes("/submissions/detail/") && url.includes("/check/")) {
      try {
        const checkIdMatch = url.match(
          /\/submissions\/detail\/([^/]+)\/check\//,
        );
        const checkId = checkIdMatch ? checkIdMatch[1] : null;

        const clone = response.clone();
        clone
          .json()
          .then((data) => {
            if (!data || data.state !== "SUCCESS") return;

            console.log(
              `[ArchipelaCode Interceptor] Polled check result for ID: ${checkId}`,
              data,
            );

            // Differentiate between "Run Code" (interpret_solution) and "Submit":
            // Test runs contain interpret_id, expected_output array, input_formatted, or mysubmission_ prefix
            const isInterpret = Boolean(
              (checkId && activeInterpretIds.has(checkId)) ||
                (checkId && checkId.startsWith("mysubmission_")) ||
                data.interpret_id ||
                data.expected_code_answer !== undefined ||
                Array.isArray(data.expected_output) ||
                data.input_formatted !== undefined,
            );

            if (isInterpret) {
              console.log(
                `[ArchipelaCode Interceptor] Ignoring test run result for check ID: ${checkId}`,
              );
              if (checkId) activeInterpretIds.delete(checkId);
              return;
            }

            // Official submission processing
            if (checkId && processedChecks.has(checkId)) {
              return;
            }
            if (checkId) {
              processedChecks.add(checkId);
              setTimeout(() => processedChecks.delete(checkId), 60000);
            }

            const mappedSlug = checkId ? submissionSlugMap.get(checkId) : null;
            if (checkId) {
              submissionSlugMap.delete(checkId);
              activeSubmissionIds.delete(checkId);
            }

            const pathnameSlugMatch = window.location.pathname.match(
              /\/problems\/([^/]+)/,
            );
            const titleSlug = (
              data.slug ||
              mappedSlug ||
              (pathnameSlugMatch ? pathnameSlugMatch[1] : "")
            )
              .toLowerCase()
              .trim();

            const isAccepted =
              data.status_msg === "Accepted" || data.status_code === 10;

            console.log(
              `[ArchipelaCode Interceptor] Official submission verdict for "${titleSlug}":`,
              {
                status_msg: data.status_msg,
                status_code: data.status_code,
                isAccepted,
              },
            );

            if (isAccepted) {
              console.log(
                `[ArchipelaCode Interceptor] Dispatching ARCHIPELACODE_ACCEPTED for "${titleSlug}"`,
              );
              window.postMessage(
                {
                  type: "ARCHIPELACODE_ACCEPTED",
                  titleSlug,
                },
                "*",
              );
            } else {
              console.log(
                `[ArchipelaCode Interceptor] Dispatching ARCHIPELACODE_FAILED for "${titleSlug}"`,
              );
              window.postMessage(
                {
                  type: "ARCHIPELACODE_FAILED",
                  titleSlug,
                  statusMsg: data.status_msg || "Failed",
                },
                "*",
              );
            }
          })
          .catch(() => {});
      } catch (e) {
        // ignore
      }
    }

    return response;
  };
})();
