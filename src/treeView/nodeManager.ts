/** @format */
import { Disposable, workspace } from "vscode";
import { apController } from "../archipelago";
import { Category, defaultProblem, State } from "../shared";
import { shouldHideSolvedProblem } from "../utils";
import { ArchipelaCodeTreeViewNode as TreeViewNode } from "./treeViewNode";

class TreeViewNodeManager implements Disposable {
  private nodeMap: Map<string, TreeViewNode> = new Map<string, TreeViewNode>();

  public dispose(): void {
    this.nodeMap.clear();
  }

  public async refreshCache(): Promise<void> {
    this.dispose();
    const shouldHideSolved: boolean = shouldHideSolvedProblem();
    for (const problem of await apController.getAllLocations()) {
      if (shouldHideSolved && problem.state === State.Solved) {
        continue;
      }
      this.nodeMap.set(problem.titleSlug, new TreeViewNode(problem));
    }
  }

  public getDifficultyFilter(): string {
    const config = workspace.getConfiguration("archipelacode");
    return config.get<string>("difficultyFilter", "all").toLowerCase();
  }

  private filterByDifficulty(nodes: TreeViewNode[]): TreeViewNode[] {
    const filter = this.getDifficultyFilter();
    if (filter === "all") {
      return nodes;
    }
    return nodes.filter(
      (node) => (node.difficulty || "").toLowerCase() === filter,
    );
  }

  public getRootNodes(): TreeViewNode[] {
    const filter = this.getDifficultyFilter();
    const filterSuffix = filter !== "all" ? ` [${filter.toUpperCase()}]` : "";

    const availableCount = this.getUnsolvedNodes().length;
    const solvedCount = this.getSolvedNodes().length;
    const lockedCount = this.getLockedNodes().length;
    const allCount = this.getAllNodes().length;

    return [
      new TreeViewNode(
        Object.assign({}, defaultProblem, {
          id: `${Category.Available}`,
          name: `Available (${availableCount})${filterSuffix}`,
          title: `Available (${availableCount})${filterSuffix}`,
          isProblem: false,
          category: Category.Available,
        }),
        false,
      ),
      new TreeViewNode(
        Object.assign({}, defaultProblem, {
          id: `${Category.Solved}`,
          name: `Solved (${solvedCount})${filterSuffix}`,
          title: `Solved (${solvedCount})${filterSuffix}`,
          isProblem: false,
          category: Category.Solved,
        }),
        false,
      ),
      new TreeViewNode(
        Object.assign({}, defaultProblem, {
          id: `${Category.Locked}`,
          name: `Locked (${lockedCount})${filterSuffix}`,
          title: `Locked (${lockedCount})${filterSuffix}`,
          isProblem: false,
          category: Category.Locked,
        }),
        false,
      ),
      new TreeViewNode(
        Object.assign({}, defaultProblem, {
          id: `${Category.All}`,
          name: `All (${allCount})${filterSuffix}`,
          title: `All (${allCount})${filterSuffix}`,
          isProblem: false,
          category: Category.All,
        }),
        false,
      ),
    ];
  }

  public getAllNodes(): TreeViewNode[] {
    return this.filterByDifficulty(Array.from(this.nodeMap.values()));
  }

  public getSolvedNodes(): TreeViewNode[] {
    return this.filterByDifficulty(
      Array.from(this.nodeMap.values()).filter((node) => {
        return node.category === Category.Solved;
      }),
    );
  }

  public getUnsolvedNodes(): TreeViewNode[] {
    return this.filterByDifficulty(
      Array.from(this.nodeMap.values()).filter((node) => {
        return node.category === Category.Available;
      }),
    );
  }

  public getLockedNodes(): TreeViewNode[] {
    return this.filterByDifficulty(
      Array.from(this.nodeMap.values()).filter((node) => {
        return node.category === Category.Locked;
      }),
    );
  }
}

export const treeViewNodeManager: TreeViewNodeManager =
  new TreeViewNodeManager();
