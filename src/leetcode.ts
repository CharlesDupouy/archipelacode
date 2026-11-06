/** @format */
import * as vscode from "vscode";
import { apVerifier } from "./apVerifier";
import { apController } from "./archipelago";
import { globalState } from "./globalState";
import { archipelacodeChannel } from "./outputChannel";
import {
  queryUserData,
  recentSubmissions,
  submissionDetails,
  type RecentSubmission,
} from "./requests/requests";
import { Endpoint, getUrl, urls, urlsCn, UserStatus } from "./shared";
import { getLeetCodeEndpoint, openUrl, parseQuery, sleep } from "./utils";
export { queryQuestionDetail } from "./requests/requests";

const PENDING_STATUSES = ["", "pending", "judging", "started"];

const isJudged = (s: RecentSubmission): boolean =>
  !PENDING_STATUSES.includes((s.statusDisplay ?? "").trim().toLowerCase());

class LeetCodeController {
  cookie: string;
  currentUser: string | undefined;
  private userStatus: UserStatus;

  constructor() {
    this.cookie = "";
    this.userStatus = UserStatus.SignedOut;
    this.currentUser = undefined;
    this.handleUriSignIn = this.handleUriSignIn.bind(this);
  }

  async initializeClient(
    cookie: string | undefined,
    expiration: number | undefined,
  ) {
    if (cookie === undefined || expiration === undefined) {
      openUrl(this.getAuthLoginUrl());
    } else {
      if (expiration > Date.now()) {
        const data = await queryUserData();
        globalState.setUserStatus(data);
        if (data.username) {
          vscode.window.showInformationMessage(
            `Successfully logged in as ${data.username}.`,
          );
          this.currentUser = data.username;
          this.userStatus = UserStatus.SignedIn;
        } else {
          vscode.window.showErrorMessage(
            "An error occurred while reconnecting to LeetCode. Please connect again.",
          );
        }
      } else {
        openUrl(this.getAuthLoginUrl());
      }
    }
  }

  public async handleUriSignIn(uri: vscode.Uri): Promise<void> {
    try {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification },
        async (progress: vscode.Progress<{}>) => {
          progress.report({ message: "Fetching user data..." });
          const queryParams = parseQuery(uri.query);
          const cookie = queryParams["cookie"];
          if (!cookie) {
            vscode.window.showErrorMessage(
              `Failed to get cookie. Please log in again`,
            );
            return;
          }
          await this.updateUserStatusWithCookie(cookie, undefined);
        },
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to log in. Check debug console for details.`,
      );
      console.log(error);
    }
  }

  public async updateUserStatusWithCookie(
    cookie: string,
    expiration: number | undefined,
  ): Promise<void> {
    globalState.setCookie(cookie);
    globalState.setExpiration(expiration ?? Date.now() + 86400000);
    const data = await queryUserData();
    globalState.setUserStatus(data);
    if (data.username) {
      vscode.window.showInformationMessage(
        `Successfully logged in as ${data.username}.`,
      );
      this.currentUser = data.username;
      this.userStatus = UserStatus.SignedIn;
    }
  }

  public getAuthLoginUrl(): string {
    switch (getLeetCodeEndpoint()) {
      case Endpoint.LeetCodeCN:
        return urlsCn.authLoginUrl;
      case Endpoint.LeetCode:
      default:
        return urls.authLoginUrl;
    }
  }

  public getUser(): string | undefined {
    return this.currentUser;
  }

  /**
   * Submits a solution via the browser to bypass Cloudflare bot protection,
   * then polls GraphQL for the submission verdict and verifies the submitted code.
   */
  public async submitSolution(
    titleSlug: string,
    fileContents: string,
    lang: string,
  ): Promise<boolean> {
    // 1. Initial local verification check
    if (!(await apVerifier.verifySubmission(lang, fileContents))) {
      vscode.window.showErrorMessage(
        `Your code uses language features you haven't unlocked yet. Please check the "ArchipelaCode" output channel.`,
      );
      return false;
    }

    const username =
      this.currentUser ?? globalState.getUserStatus()?.username ?? "";
    if (!username) {
      vscode.window.showErrorMessage(
        "Not signed in to LeetCode. Please start a session and sign in first.",
      );
      return false;
    }

    // 2. Fetch baseline timestamp so only newer submissions are considered
    const baselineTimestamp = await this.latestSubmissionTimestamp(
      username,
      titleSlug,
    );
    archipelacodeChannel.appendLine(
      `Watching for new submissions of "${titleSlug}" (baseline ts=${baselineTimestamp}).`,
    );

    // 3. Copy code to clipboard and open problem in browser
    await vscode.env.clipboard.writeText(fileContents);
    vscode.window.showInformationMessage(
      "Your code was copied to clipboard! Paste it into LeetCode and click Submit.",
    );
    openUrl(`${getUrl("problemUrl")}${titleSlug}/`);

    // 4. Poll for new submissions
    const submission = await this.waitForNewSubmission(
      username,
      titleSlug,
      baselineTimestamp,
    );
    if (!submission) {
      return false;
    }

    // 5. Verify the code actually judged by LeetCode
    return await this.verifySubmittedCode(submission);
  }

  private async latestSubmissionTimestamp(
    username: string,
    titleSlug: string,
  ): Promise<number> {
    try {
      const recent = await recentSubmissions(username);
      const matching = recent.filter((s) => s.titleSlug === titleSlug);
      return matching.reduce((max, s) => Math.max(max, Number(s.timestamp)), 0);
    } catch (error) {
      archipelacodeChannel.appendLine(
        `Could not read baseline timestamp: ${error}`,
      );
      return Math.floor(Date.now() / 1000);
    }
  }

  private async waitForNewSubmission(
    username: string,
    titleSlug: string,
    since: number,
  ): Promise<RecentSubmission | undefined> {
    const POLL_MS = 4000;
    const TIMEOUT_MS = 15 * 60 * 1000;
    const MAX_CONSECUTIVE_FAILURES = 4;

    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Waiting for LeetCode submission of "${titleSlug}"...`,
        cancellable: true,
      },
      async (progress, token) => {
        const deadline = Date.now() + TIMEOUT_MS;
        const reportedFailures = new Set<string>();
        let consecutiveFailures = 0;

        while (Date.now() < deadline) {
          if (token.isCancellationRequested) {
            archipelacodeChannel.appendLine(
              "Submission watching cancelled by user.",
            );
            return undefined;
          }
          await sleep(POLL_MS);
          if (token.isCancellationRequested) {
            return undefined;
          }

          let recent: RecentSubmission[];
          try {
            recent = await recentSubmissions(username);
            consecutiveFailures = 0;
          } catch (error) {
            consecutiveFailures++;
            archipelacodeChannel.appendLine(`Poll error: ${error}`);
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
              vscode.window.showErrorMessage(
                `Failed to query LeetCode submissions: ${error}. Session may have expired.`,
              );
              return undefined;
            }
            continue;
          }

          const fresh = recent
            .filter(
              (s) => s.titleSlug === titleSlug && Number(s.timestamp) > since,
            )
            .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));

          const accepted = fresh.find((s) => s.statusDisplay === "Accepted");
          if (accepted) {
            return accepted;
          }

          // Report any judged non-accepted submissions (e.g. Wrong Answer)
          for (const s of fresh) {
            if (!isJudged(s) || reportedFailures.has(s.id)) {
              continue;
            }
            reportedFailures.add(s.id);
            archipelacodeChannel.appendLine(
              `Submission ${s.id}: ${s.statusDisplay}`,
            );
            progress.report({
              message: `LeetCode returned "${s.statusDisplay}" - watching for next submission...`,
            });

            // Trigger DeathLink if enabled!
            if (apController.isDeathLinkEnabled()) {
              apController.sendDeathLink(
                `${username} got ${s.statusDisplay} on "${titleSlug}"!`,
              );
            }
          }
        }

        vscode.window.showWarningMessage(
          `Timed out waiting for submission of "${titleSlug}".`,
        );
        return undefined;
      },
    );
  }

  private async verifySubmittedCode(
    submission: RecentSubmission,
  ): Promise<boolean> {
    let details: { code: string; lang: string } | undefined;
    try {
      details = await submissionDetails(submission.id);
    } catch (error) {
      archipelacodeChannel.appendLine(
        `Could not fetch submitted code: ${error}`,
      );
    }

    if (!details) {
      vscode.window.showErrorMessage(
        `Could not retrieve submission code for verification. Check was not sent.`,
      );
      return false;
    }

    archipelacodeChannel.appendLine(
      `Verifying submission ${submission.id} (lang="${details.lang}")...`,
    );

    if (!(await apVerifier.verifySubmission(details.lang, details.code))) {
      vscode.window.showErrorMessage(
        `LeetCode accepted the submission, but it uses locked Archipelago language features! Check the output channel.`,
      );
      return false;
    }

    return true;
  }
}

export const leetCodeController: LeetCodeController = new LeetCodeController();
