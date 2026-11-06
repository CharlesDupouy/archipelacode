/** @format */
import * as vscode from "vscode";
import packageJson from "../package.json";
import problemsJson from "./data/problems.json";
import { diagnosticsManager } from "./diagnostics";
import { APConnectionInfo, globalState } from "./globalState";
import { archipelacodeChannel } from "./outputChannel";
import {
  APStatus,
  Category,
  LangEnable,
  Problem,
  State,
  SubProblem,
  VersionIdentifier,
} from "./shared";
import { archipelaCodeTreeDataProvider } from "./treeView/treeDataProvider";
import { countOccurrences, versionStringToVersion } from "./utils";

type Item = import("archipelago.js", {
  with: { "resolution-mode": "import" }
}).Item;

class ArchipelagoController {
  hostname: string = "archipelago.gg";
  port!: number;
  slotname!: string;
  password: string = "";
  status: APStatus = APStatus.DISCONNECTED;
  protocol: string = "ws";
  client: any;
  uuid: string = "";
  slotData!: any;
  extensionVersion!: VersionIdentifier;

  constructor() {}

  getUrl(): string {
    return `${this.protocol}://${this.hostname}:${this.port}`;
  }

  isDeathLinkEnabled(): boolean {
    const config = vscode.workspace.getConfiguration("archipelacode");
    const settingEnabled = config.get<boolean>("enableDeathLink", false);
    const slotDataEnabled = Boolean(
      this.slotData?.metadata &&
        typeof this.slotData.metadata === "object" &&
        (this.slotData.metadata as any).death_link,
    );
    return settingEnabled || slotDataEnabled;
  }

  sendDeathLink(cause: string): void {
    if (this.isDeathLinkEnabled() && this.client?.deathLink) {
      archipelacodeChannel.appendLine(`[DeathLink] Sending death: ${cause}`);
      this.client.deathLink.sendDeathLink(this.slotname, cause);
    }
  }

  async initializeClient(
    hostname = "archipelago.gg",
    port: number,
    slotname: string,
    password = "",
  ) {
    this.hostname = hostname;
    this.port = port;
    this.slotname = slotname;
    this.password = password;
    this.status = APStatus.CONNECTING;

    this.extensionVersion = await this.getExtensionVersion();
    this.protocol = "ws";

    const { Client } = await import("archipelago.js");
    const uuid = await import("uuid");
    this.client = new Client();
    this.uuid = uuid.v4();

    this.client.messages.on("message", (text: string) => {
      archipelacodeChannel.appendLine(text);
    });

    this.client.items.on(
      "itemsReceived",
      async (items: Item[], startingIndex: number) => {
        await this.receiveItem(items, startingIndex);
        await archipelaCodeTreeDataProvider.refresh();
        diagnosticsManager.refreshAll();
      },
    );

    this.client.deathLink.on(
      "deathReceived",
      (source: string, time: number, cause?: string) => {
        const msg =
          cause ?
            `[DeathLink] Received death from ${source}: ${cause}`
          : `[DeathLink] Received death from ${source}!`;
        vscode.window.showErrorMessage(msg);
        archipelacodeChannel.appendLine(msg);
      },
    );

    this.client.socket.on("disconnected", () => {
      if (this.status === APStatus.CONNECTED) {
        this.status = APStatus.DISCONNECTED;
        vscode.window.showWarningMessage(
          "Archipelago connection lost. Will attempt to reconnect in 5 seconds...",
        );
        archipelacodeChannel.appendLine(
          "Archipelago connection lost. Scheduling reconnect...",
        );
        setTimeout(async () => {
          try {
            await this.reconnect();
          } catch (e) {
            archipelacodeChannel.appendLine(`Auto-reconnect failed: ${e}`);
          }
        }, 5000);
      }
    });

    const tags: string[] = [];
    if (this.isDeathLinkEnabled()) {
      tags.push("DeathLink");
    }

    const loginOptions = {
      items: 7,
      password: this.password,
      slotData: true,
      tags,
      uuid: this.uuid,
      version: {
        major: 0,
        minor: 5,
        build: 0,
      },
    };

    try {
      await this.client.login(
        this.getUrl(),
        this.slotname,
        "ArchipelaCode",
        loginOptions,
      );
    } catch {
      this.protocol = "wss";
      await this.client.login(
        this.getUrl(),
        this.slotname,
        "ArchipelaCode",
        loginOptions,
      );
    }

    this.slotData = await this.client.players.self.fetchSlotData();
    this.status = APStatus.CONNECTED;

    if (this.isDeathLinkEnabled()) {
      this.client.deathLink.enableDeathLink();
      archipelacodeChannel.appendLine("[DeathLink] DeathLink is active.");
    }

    if (!(await this.checkVersion())) {
      vscode.window.showWarningMessage(
        "Extension version differs from APWorld recommendation. You may want to check for updates.",
      );
      archipelacodeChannel.appendLine(
        "Notice: Extension version differs from APWorld recommendation.",
      );
    }

    let connectionInfo: APConnectionInfo = {
      hostname: this.hostname,
      port: this.port,
      slotname: this.slotname,
      password: this.password,
    };

    globalState.setAPConnectionInfo(connectionInfo);
    diagnosticsManager.refreshAll();
  }

  async reconnect(): Promise<void> {
    const info = globalState.getAPConnectionInfo();
    if (!info) {
      return;
    }
    await this.disconnectIfConnected();
    await this.initializeClient(
      info.hostname,
      info.port,
      info.slotname,
      info.password,
    );
  }

  async getExtensionVersion(): Promise<VersionIdentifier> {
    return versionStringToVersion(packageJson.version);
  }

  async checkVersion(): Promise<boolean> {
    let extensionVersion: VersionIdentifier = await this.getExtensionVersion();
    let apworldVersion: VersionIdentifier = {
      major: 0,
      minor: 0,
      build: 1,
    };
    let metadata = this.slotData?.metadata;
    if (metadata && typeof metadata === "object") {
      for (const [key, value] of Object.entries(metadata)) {
        if (key === "minimum_extension_version") {
          apworldVersion = versionStringToVersion(String(value));
        }
      }
    }
    if (extensionVersion.major > apworldVersion.major) {
      return true;
    } else if (
      extensionVersion.major === apworldVersion.major &&
      extensionVersion.minor > apworldVersion.minor
    ) {
      return true;
    } else if (
      extensionVersion.major === apworldVersion.major &&
      extensionVersion.minor === apworldVersion.minor &&
      extensionVersion.build >= apworldVersion.build
    ) {
      return true;
    }
    return false;
  }

  async disconnectIfConnected(): Promise<void> {
    if (
      this.status === APStatus.CONNECTED ||
      this.status === APStatus.CONNECTING
    ) {
      this.status = APStatus.DISCONNECTING;
      try {
        this.client?.socket?.disconnect();
      } catch (err) {
        // ignore
      }
      this.status = APStatus.DISCONNECTED;
      diagnosticsManager.clear();
    }
  }

  async hasLocationBeenClaimedPreviously(titleSlug: string): Promise<boolean> {
    let locationID = this.titleSlugToLocationId(titleSlug);
    return Boolean(this.client?.room?.checkedLocations?.includes(locationID));
  }

  async sendCheck(titleSlug: string) {
    let locationID = this.titleSlugToLocationId(titleSlug);
    archipelacodeChannel.appendLine(
      `Sending check for location '${locationID}' (${titleSlug})`,
    );
    await this.client.check(locationID);
    if (this.client.room.checkedLocations.length + 1 >= this.getEndGoal()) {
      this.client.goal();
      vscode.window.showInformationMessage(
        "🎉 Goal completed! You have won ArchipelaCode!",
      );
    }
    await archipelaCodeTreeDataProvider.refresh();
  }

  titleSlugToLocationId(titleSlug: string): number {
    let locationID = -1;
    const problems = (problemsJson as any).problems;
    if (problems && problems[titleSlug]) {
      locationID = problems[titleSlug].locationId;
    }
    return locationID;
  }

  async receiveItem(items: Item[], startingIndex: number) {
    if (this.status !== APStatus.CONNECTING) {
      items.forEach((item) => {
        if (item.name.toLowerCase().includes("trap")) {
          vscode.window.showWarningMessage(
            `⚠️ [TRAP ACTIVATED] Received ${item.name} from ${item.sender.name}!`,
          );
          archipelacodeChannel.appendLine(
            `⚠️ [TRAP] Received ${item.name} from ${item.sender.name}!`,
          );
        } else {
          vscode.window.showInformationMessage(
            `Received ${item.name} from ${item.sender.name}`,
          );
        }
      });
    }
  }

  async isLocationLocked(entry: SubProblem): Promise<boolean> {
    if (await this.hasLocationBeenClaimedPreviously(entry.titleSlug)) {
      return false;
    } else {
      let regionId = await this.getRegionFromLocationId(entry.locationId);
      return !(
        countOccurrences(
          this.client.items.received.map((item: any) => item.id),
          6700902002,
        ) >= regionId
      );
    }
  }

  async isLocationIncluded(locationId: number): Promise<boolean> {
    return Boolean(this.client?.room?.allLocations?.includes(locationId));
  }

  async getRegionFromLocationId(locationId: number): Promise<number> {
    let regions = this.slotData?.regions;
    if (regions && typeof regions === "object") {
      for (const [key, locations] of Object.entries(regions)) {
        let regionId = Number(key);
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

  itemIdToName(itemId: number): string {
    let items = this.slotData?.items;
    if (items && typeof items === "object") {
      for (const [key, value] of Object.entries(items)) {
        if (key === String(itemId)) {
          return String(value);
        }
      }
    }
    return "Unknown Item";
  }

  getEndGoal(): number {
    let metadata = this.slotData?.metadata;
    if (metadata && typeof metadata === "object") {
      for (const [key, value] of Object.entries(metadata)) {
        if (key === "EndGoal") {
          return Number(value);
        }
      }
    }
    return -1;
  }

  getEnabledLanguages(): LangEnable[] {
    let result: LangEnable[] = [];
    let metadata = this.slotData?.metadata;
    if (metadata && typeof metadata === "object") {
      for (const [key, value] of Object.entries(metadata)) {
        if (key === "included_languages") {
          if (value && typeof value === "object") {
            for (const [lang, enabled] of Object.entries(value)) {
              result.push({
                langSlug: lang,
                enabled: Boolean(enabled),
              });
            }
          }
        }
      }
    }
    return result;
  }

  async getAllLocations(): Promise<Problem[]> {
    let problems: Problem[] = [];
    const probMap = (problemsJson as any).problems;
    for (const [, entry] of Object.entries(probMap)) {
      const e = entry as any;
      if (await this.isLocationIncluded(e.locationId)) {
        problems.push({
          id: e.id,
          difficulty: e.difficulty,
          title: e.title,
          titleSlug: e.titleSlug,
          problemUrl: e.problemUrl,
          locationId: e.locationId,
          category:
            (await this.isLocationLocked(e)) ? Category.Locked
            : (await this.hasLocationBeenClaimedPreviously(e.titleSlug)) ?
              Category.Solved
            : Category.Available,
          state:
            (await this.isLocationLocked(e)) ? State.Locked
            : (await this.hasLocationBeenClaimedPreviously(e.titleSlug)) ?
              State.Solved
            : State.Unsolved,
        });
      }
    }
    return problems;
  }

  async sendMessage(message: string): Promise<void> {
    await this.client.messages.say(message);
  }

  getReceivedItemNames(): string[] {
    let items: Item[] = this.client?.items?.received ?? [];
    let names: string[] = [];
    items.forEach((item) => {
      names.push(item.name);
    });
    return names;
  }
}

export const apController: ArchipelagoController = new ArchipelagoController();
