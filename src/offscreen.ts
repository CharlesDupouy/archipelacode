/** @format */
import { Client, Item } from "archipelago.js";
import problemsJson from "./data/problems.json";
import {
  APConnectionConfig,
  APProblem,
  APStatus,
  ExtensionState,
  MessagePayload,
  ProblemCategory,
  ProblemDifficulty,
} from "./shared/types";

class ArchipelagoService {
  private client: Client | null = null;
  private status: APStatus = APStatus.DISCONNECTED;
  private config: APConnectionConfig | null = null;
  private slotData: any = null;
  private chatLog: string[] = [];
  private uuid =
    "archipelacode-chrome-" + Math.random().toString(36).substring(2, 10);

  constructor() {
    this.initMessageListener();
  }

  private initMessageListener() {
    chrome.runtime.onMessage.addListener(
      (message: MessagePayload, sender, sendResponse) => {
        switch (message.type) {
          case "CONNECT_AP":
            this.connect(message.config);
            sendResponse({ ok: true });
            break;
          case "DISCONNECT_AP":
            this.disconnect();
            sendResponse({ ok: true });
            break;
          case "SEND_CHECK":
            this.sendCheck(message.titleSlug);
            sendResponse({ ok: true });
            break;
          case "SEND_DEATH_LINK":
            this.sendDeathLink(message.cause);
            sendResponse({ ok: true });
            break;
          case "SEND_CHAT":
            this.sendChat(message.message);
            sendResponse({ ok: true });
            break;
          case "GET_STATE":
            this.broadcastState();
            sendResponse({ state: this.getState() });
            break;
        }
        return true;
      },
    );
  }

  public async connect(config: APConnectionConfig) {
    this.config = config;

    this.status = APStatus.CONNECTING;
    this.broadcastState();

    if (this.client) {
      try {
        this.client.socket.disconnect();
      } catch (e) {
        // ignore
      }
    }

    this.client = new Client();

    this.client.messages.on("message", (text: string) => {
      this.chatLog.push(text);
      if (this.chatLog.length > 200) {
        this.chatLog.shift();
      }
      this.broadcastState();
    });

    this.client.items.on("itemsReceived", (items: Item[]) => {
      items.forEach((item) => {
        const isTrap = item.name.toLowerCase().includes("trap");
        chrome.runtime
          .sendMessage({
            type: "ITEM_RECEIVED",
            itemName: item.name,
            sender: item.sender.name,
            isTrap,
          } as MessagePayload)
          .catch(() => {});
      });
      this.broadcastState();
    });

    this.client.deathLink.on(
      "deathReceived",
      (source: string, time: number, cause?: string) => {
        chrome.runtime
          .sendMessage({
            type: "DEATH_LINK_RECEIVED",
            source,
            cause,
          } as MessagePayload)
          .catch(() => {});
      },
    );

    this.client.socket.on("disconnected", () => {
      if (this.status === APStatus.CONNECTED) {
        this.status = APStatus.DISCONNECTED;
        this.chatLog.push(
          "[Connection] Disconnected from server. Reconnecting in 5s...",
        );
        this.broadcastState();
        setTimeout(() => {
          if (this.config) {
            this.connect(this.config);
          }
        }, 5000);
      }
    });

    const isDeathLinkWanted = true; // Auto-detected from slotData on connect
    const tags = isDeathLinkWanted ? ["DeathLink"] : [];

    const url = `wss://${config.hostname}:${config.port}`;
    const altUrl = `ws://${config.hostname}:${config.port}`;

    const loginOptions = {
      items: 7,
      password: config.password || "",
      slotData: true,
      tags,
      uuid: this.uuid,
      version: { major: 0, minor: 5, build: 0 },
    };

    try {
      try {
        await this.client.login(
          url,
          config.slotname,
          "ArchipelaCode",
          loginOptions,
        );
      } catch {
        await this.client.login(
          altUrl,
          config.slotname,
          "ArchipelaCode",
          loginOptions,
        );
      }

      this.slotData = await this.client.players.self.fetchSlotData();
      this.status = APStatus.CONNECTED;

      if (this.isDeathLinkEnabled()) {
        this.client.deathLink.enableDeathLink();
        this.chatLog.push("[DeathLink] DeathLink is enabled.");
      }

      this.chatLog.push(
        `[Archipelago] Successfully connected to room as ${config.slotname}!`,
      );
      this.broadcastState();
    } catch (err: any) {
      this.status = APStatus.DISCONNECTED;
      this.chatLog.push(`[Connection Error] ${err?.message || err}`);
      this.broadcastState();
    }
  }

  public disconnect() {
    if (this.client) {
      try {
        this.client.socket.disconnect();
      } catch (e) {
        // ignore
      }
    }
    this.status = APStatus.DISCONNECTED;
    this.chatLog.push("[Connection] Disconnected.");
    this.broadcastState();
  }

  public isDeathLinkEnabled(): boolean {
    return Boolean(
      this.slotData?.metadata &&
        typeof this.slotData.metadata === "object" &&
        this.slotData.metadata.death_link,
    );
  }

  public sendDeathLink(cause: string) {
    if (this.client && this.isDeathLinkEnabled()) {
      this.client.deathLink.sendDeathLink(
        this.config?.slotname || "Player",
        cause,
      );
    }
  }

  public sendChat(msg: string) {
    if (this.client && this.status === APStatus.CONNECTED) {
      this.client.messages.say(msg);
    }
  }

  public async sendCheck(titleSlug: string) {
    if (!this.client || this.status !== APStatus.CONNECTED) {
      return;
    }

    const locationId = this.titleSlugToLocationId(titleSlug);
    if (locationId === -1) {
      return;
    }

    if (this.client.room.checkedLocations.includes(locationId)) {
      return;
    }

    this.chatLog.push(`Sending check for ${titleSlug} (id=${locationId})...`);
    await this.client.check(locationId);

    // Goal check
    const goal = this.getEndGoal();
    if (this.client.room.checkedLocations.length + 1 >= goal) {
      this.client.goal();
      this.chatLog.push("🎉 Goal Reached! You have cleared ArchipelaCode!");
    }

    this.broadcastState();
  }

  private titleSlugToLocationId(titleSlug: string): number {
    const problems = (problemsJson as any).problems;
    if (problems && problems[titleSlug]) {
      return problems[titleSlug].locationId;
    }
    return -1;
  }

  private getEndGoal(): number {
    const metadata = this.slotData?.metadata;
    if (metadata && typeof metadata === "object" && metadata.EndGoal) {
      return Number(metadata.EndGoal);
    }
    return 40;
  }

  private getProgressiveUnlocksCount(): number {
    if (!this.client) return 0;
    const receivedIds: number[] = this.client.items.received.map(
      (i: Item) => i.id,
    );
    return receivedIds.filter((id) => id === 6700902002).length;
  }

  private isLocationLocked(entry: any): boolean {
    if (!this.client) return true;
    if (this.client.room.checkedLocations.includes(entry.locationId)) {
      return false;
    }
    const regionId = this.getRegionFromLocationId(entry.locationId);
    return this.getProgressiveUnlocksCount() < regionId;
  }

  private getRegionFromLocationId(locationId: number): number {
    const regions = this.slotData?.regions;
    if (regions && typeof regions === "object") {
      for (const [key, locations] of Object.entries(regions)) {
        const regionId = Number(key);
        if (locations && typeof locations === "object") {
          for (const [locId] of Object.entries(locations)) {
            if (Number(locId) === locationId) {
              return regionId;
            }
          }
        }
      }
    }
    return 0;
  }

  public getState(): ExtensionState {
    const checkedLocations = this.client?.room?.checkedLocations ?? [];
    const receivedItems: Item[] = this.client?.items?.received ?? [];
    const unlockedItemIds = receivedItems.map((i) => i.id);
    const unlockedItemNames = receivedItems.map((i) => i.name);

    const problemsList: APProblem[] = [];
    const probMap = (problemsJson as any).problems;
    const allLocations = this.client?.room?.allLocations ?? [];

    for (const [, entry] of Object.entries(probMap)) {
      const e = entry as any;
      if (allLocations.includes(e.locationId)) {
        const isChecked = checkedLocations.includes(e.locationId);
        const isLocked = this.isLocationLocked(e);

        let category = ProblemCategory.Available;
        if (isChecked) {
          category = ProblemCategory.Solved;
        } else if (isLocked) {
          category = ProblemCategory.Locked;
        }

        problemsList.push({
          id: e.id,
          difficulty: (e.difficulty as ProblemDifficulty) || "UNKNOWN",
          title: e.title,
          titleSlug: e.titleSlug,
          problemUrl: e.problemUrl,
          locationId: e.locationId,
          category,
          requiredFeatures: e.required_features?.python3 ?? [],
        });
      }
    }

    return {
      status: this.status,
      connectionConfig: this.config || undefined,
      slotname: this.config?.slotname,
      checkedLocations,
      unlockedItemIds,
      unlockedItemNames,
      endGoal: this.getEndGoal(),
      deathLinkEnabled: this.isDeathLinkEnabled(),
      problems: problemsList,
      chatLog: this.chatLog,
    };
  }

  private broadcastState() {
    const state = this.getState();
    chrome.runtime
      .sendMessage({
        type: "STATE_UPDATED",
        state,
      } as MessagePayload)
      .catch(() => {});
  }
}

new ArchipelagoService();
