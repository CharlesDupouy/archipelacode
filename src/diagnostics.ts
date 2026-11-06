/** @format */
import * as vscode from "vscode";
import { apVerifier } from "./apVerifier";
import { apController } from "./archipelago";
import { APStatus } from "./shared";

export class DiagnosticsManager implements vscode.Disposable {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.diagnosticCollection =
      vscode.languages.createDiagnosticCollection("archipelacode");
    this.disposables.push(this.diagnosticCollection);
  }

  public initialize(context: vscode.ExtensionContext): void {
    context.subscriptions.push(this);

    // Watch for document changes
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        this.updateDiagnostics(event.document);
      }),
      vscode.workspace.onDidOpenTextDocument((document) => {
        this.updateDiagnostics(document);
      }),
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
          this.updateDiagnostics(editor.document);
        }
      }),
      vscode.workspace.onDidCloseTextDocument((document) => {
        this.diagnosticCollection.delete(document.uri);
      }),
    );

    // Initial check for currently open editors
    this.refreshAll();
  }

  public updateDiagnostics(document: vscode.TextDocument): void {
    // Only analyze if connected or in an ArchipelaCode workspace
    const fileName = document.fileName;
    // Check supported language
    const lang = apVerifier.getFileLanguage(fileName);
    if (lang !== "python" && lang !== "python3") {
      return;
    }

    // Only inspect file if Archipelago is connected or connecting
    if (apController.status === APStatus.DISCONNECTED) {
      this.diagnosticCollection.delete(document.uri);
      return;
    }

    const text = document.getText();
    const violations = apVerifier.getViolations(lang, text);

    const diagnostics: vscode.Diagnostic[] = violations.map((v) => {
      const range = new vscode.Range(
        new vscode.Position(v.line, v.startCol),
        new vscode.Position(v.line, v.endCol),
      );
      const diagnostic = new vscode.Diagnostic(
        range,
        `Locked language feature: ${v.itemName} is not yet unlocked in Archipelago.`,
        vscode.DiagnosticSeverity.Error,
      );
      diagnostic.source = "ArchipelaCode";
      diagnostic.code = v.itemId;
      return diagnostic;
    });

    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  public refreshAll(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      this.updateDiagnostics(editor.document);
    }
  }

  public clear(): void {
    this.diagnosticCollection.clear();
  }

  public dispose(): void {
    this.clear();
    this.disposables.forEach((d) => d.dispose());
  }
}

export const diagnosticsManager = new DiagnosticsManager();
