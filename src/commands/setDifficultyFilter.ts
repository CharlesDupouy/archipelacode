/** @format */
import * as vscode from "vscode";
import { archipelaCodeTreeDataProvider } from "../treeView/treeDataProvider";

export async function setDifficultyFilter() {
  const choices: Array<{ label: string; description: string; value: string }> =
    [
      {
        label: "All",
        description: "Show problems of all difficulties",
        value: "all",
      },
      { label: "Easy", description: "Show Easy problems only", value: "easy" },
      {
        label: "Medium",
        description: "Show Medium problems only",
        value: "medium",
      },
      { label: "Hard", description: "Show Hard problems only", value: "hard" },
    ];

  const selection = await vscode.window.showQuickPick(choices, {
    placeHolder: "Select a difficulty filter for the Problem Explorer",
  });

  if (selection) {
    const config = vscode.workspace.getConfiguration("archipelacode");
    await config.update(
      "difficultyFilter",
      selection.value,
      vscode.ConfigurationTarget.Global,
    );
    await archipelaCodeTreeDataProvider.refresh();
    vscode.window.showInformationMessage(
      `ArchipelaCode difficulty filter set to: ${selection.label}`,
    );
  }
}
