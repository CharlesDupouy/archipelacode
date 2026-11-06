/**
 * Shared Type Definitions for ArchipelaCode Chrome Extension
 */

export enum APStatus {
  DISCONNECTED = "DISCONNECTED",
  CONNECTING = "CONNECTING",
  CONNECTED = "CONNECTED",
}

export enum ProblemCategory {
  Available = "Available",
  Solved = "Solved",
  Locked = "Locked",
  All = "All",
}

export type ProblemDifficulty = "EASY" | "MEDIUM" | "HARD" | "UNKNOWN";

export interface APProblem {
  id: number;
  difficulty: ProblemDifficulty;
  title: string;
  titleSlug: string;
  problemUrl: string;
  locationId: number;
  category: ProblemCategory;
  requiredFeatures: number[];
}

export interface APConnectionConfig {
  hostname: string;
  port: number;
  slotname: string;
  password?: string;
}

export interface APSlotMetadata {
  endGoal: number;
  deathLink: boolean;
  enableTraps: boolean;
  includedLanguages: Record<string, boolean>;
}

export interface ExtensionState {
  status: APStatus;
  connectionConfig?: APConnectionConfig;
  slotname?: string;
  checkedLocations: number[];
  unlockedItemIds: number[];
  unlockedItemNames: string[];
  endGoal: number;
  deathLinkEnabled: boolean;
  problems: APProblem[];
  chatLog: string[];
}

// Runtime Message Types between Side Panel, Background, Offscreen, and Content Script
export type MessagePayload =
  | { type: "CONNECT_AP"; config: APConnectionConfig }
  | { type: "DISCONNECT_AP" }
  | { type: "GET_STATE" }
  | { type: "STATE_UPDATED"; state: ExtensionState }
  | { type: "SEND_CHECK"; titleSlug: string }
  | { type: "CHECK_SENT"; locationId: number; titleSlug: string }
  | { type: "SEND_DEATH_LINK"; cause: string }
  | { type: "DEATH_LINK_RECEIVED"; source: string; cause?: string }
  | { type: "SEND_CHAT"; message: string }
  | { type: "ITEM_RECEIVED"; itemName: string; sender: string; isTrap: boolean }
  | { type: "VERIFY_CODE"; code: string; lang: string }
  | { type: "VERIFY_RESULT"; isValid: boolean; missingItemIds: number[]; missingItemNames: string[] }
  | { type: "SUBMISSION_ACCEPTED"; titleSlug: string; code: string; lang: string }
  | { type: "SUBMISSION_FAILED"; titleSlug: string; statusMsg: string };
