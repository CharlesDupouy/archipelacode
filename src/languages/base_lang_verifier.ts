/** @format */

export interface ViolationSpan {
  itemId: number;
  itemName: string;
  token: string;
  line: number;
  startCol: number;
  endCol: number;
}

export interface BaseLanguageVerifier {
  regexes?: RegExEntry[];
  langSlugs: string[];
  lastGeneratedLineRegex?: RegExp;
  verify(fileContents: string): [boolean, number[]];
  checkIfLineIsAComment(line: string): boolean;
  getViolations?(fileContents: string): ViolationSpan[];
}

export interface RegExEntry {
  regex: RegExp; // RegEx to check the code against
  itemId: number; // Archipelago Item ID needed to disable the RegEx
  disabled: boolean; // RegEx disable flag
}
