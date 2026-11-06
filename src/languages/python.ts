/** @format */

type Item = import("archipelago.js", {
  with: { "resolution-mode": "import" }
}).Item;
import { apController } from "../archipelago";
import {
  BaseLanguageVerifier,
  RegExEntry,
  ViolationSpan,
} from "./base_lang_verifier";
import { analyzePythonFeatures } from "./pythonLexer";

class PythonVerifier implements BaseLanguageVerifier {
  langSlugs: string[] = ["python", "python3"];
  lastGeneratedLineRegex: RegExp = new RegExp(
    "\\t| *(def)\\s+\\w*\\(.*\\)(?: ?-> ?)?\\w*:$",
  );
  regexes: RegExEntry[] = [];

  constructor() {}

  getUnlockedItemIds(): Set<number> {
    if (
      !apController.client ||
      !apController.client.items ||
      !apController.client.items.received
    ) {
      return new Set();
    }
    return new Set(
      apController.client.items.received.map((item: Item) => item.id),
    );
  }

  getViolations(fileContents: string): ViolationSpan[] {
    const unlocked = this.getUnlockedItemIds();
    return analyzePythonFeatures(fileContents, unlocked);
  }

  verify(fileContents: string): [boolean, number[]] {
    const violations = this.getViolations(fileContents);
    const missingItems = Array.from(new Set(violations.map((v) => v.itemId)));
    return [missingItems.length === 0, missingItems];
  }

  checkIfLineIsAComment(line: string): boolean {
    return line.trimStart().startsWith("#");
  }
}

export const pythonVerifier: PythonVerifier = new PythonVerifier();
