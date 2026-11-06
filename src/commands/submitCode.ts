/** @format */
import * as path from "path";
import * as vscode from "vscode";
import { apVerifier } from "../apVerifier";
import { apController } from "../archipelago";
import { leetCodeController } from "../leetcode";

export async function submitCode() {
  if (
    vscode.workspace.workspaceFolders === undefined ||
    vscode.workspace.workspaceFolders.length === 0
  ) {
    vscode.window.showErrorMessage("Please open a workspace folder first.");
    return;
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active file editor open.");
    return;
  }

  const fileContents = editor.document.getText();
  const filename = path.basename(editor.document.fileName);
  const titleSlug = filename.split(".")[0];
  const lang = apVerifier.getFileLanguage(filename);

  if (await apController.hasLocationBeenClaimedPreviously(titleSlug)) {
    vscode.window.showInformationMessage(
      "You've already received the check for this problem. Try another!",
    );
    return;
  }

  const result = await leetCodeController.submitSolution(
    titleSlug,
    fileContents,
    lang,
  );

  if (result) {
    vscode.window.showInformationMessage(
      "Solution verified! Sending check to Archipelago...",
    );
    await apController.sendCheck(titleSlug);
  }
}
