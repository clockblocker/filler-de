import type { Maybe } from "../../../types/general";
import {
  type BranchNode,
  NodeStatus,
  NodeType,
  type PageNode,
  type SectionNode,
  type SerializedText,
  type TextNode,
  type TreeNode,
  type TreePath,
} from "../currator-types";
import { areShallowEqual } from "../pure-functions/node";
import { bfs } from "./helpers/walks";

export class CurratedTree {
  children: BranchNode[];
  type: typeof NodeType.Section;
  name: string;
  status: NodeStatus;

  constructor(serializedTexts: SerializedText[], name: string) {
    this.children = [];
    this.type = NodeType.Section;
    this.name = name;
    this.status = NodeStatus.NotStarted;

    // Build tree from serialized texts
    for (const serializedText of serializedTexts) {
      this.addText(serializedText);
    }

    // Compute initial statuses for all nodes
    this.recomputeStatuses();
  }

  public getTexts(path: TreePath): SerializedText[] {
    const mbNode = this.getMaybeNode({ path });
    if (mbNode.error) {
      return [];
    }

    const textNodes = this.getTextNodesFromNode(mbNode.data as BranchNode);
    return textNodes.map(
      (node) =>
        ({
          path: path,
          pageStatuses: node.children.map((child) => child.status),
        }) satisfies SerializedText,
    );
  }

  public getAllTexts(): SerializedText[] {
    return this.children.flatMap((child) =>
      this.getAllTextsRecursive(child, [child.name]),
    );
  }

  private getAllTextsRecursive(
    node: BranchNode,
    path: TreePath,
  ): SerializedText[] {
    if (node.type === NodeType.Text) {
      const textNode = node as TextNode;
      return [
        {
          path: path,
          pageStatuses: textNode.children.map((child) => child.status),
        } satisfies SerializedText,
      ];
    }

    if (node.type === NodeType.Section) {
      const section = node as SectionNode;
      return section.children.flatMap((child) =>
        this.getAllTextsRecursive(child, [...path, child.name]),
      );
    }

    return [];
  }

  public addText(serializedText: SerializedText): Maybe<TextNode> {
    const textNode = this.getOrCreateTextNode({ path: serializedText.path });
    if (textNode.error) {
      return textNode;
    }

    textNode.data.children = Array.from(
      { length: serializedText.pageStatuses.length },
      (_, index) =>
        ({
          index,
          status: serializedText.pageStatuses[index] ?? NodeStatus.NotStarted,
          type: NodeType.Page,
          parent: textNode.data,
        }) satisfies PageNode,
    );

    // Initialize parent references for the newly created node
    this.initializeParents();

    // Recompute statuses after adding pages
    this.recomputeStatuses();

    return { error: false, data: textNode.data };
  }

  public deleteText({ path }: { path: TreePath }): void {
    const node = this.getMaybeNode({ path });
    if (node.error) {
      return;
    }

    // Handle root-level text nodes
    if (path.length === 1) {
      const textName = path[0];
      const textIndex = this.children.findIndex(
        (child) => child.type === NodeType.Text && child.name === textName,
      );

      if (textIndex !== -1) {
        this.children.splice(textIndex, 1);
      }
      this.recomputeStatuses();
      return;
    }

    // Handle nested text nodes
    const parentChain = this.getParentChain({ path });
    if (parentChain.length === 0) {
      return;
    }

    const textName = path[path.length - 1];
    const parent = parentChain[0];

    if (!parent || !textName) {
      return;
    }

    // Delete the text node from its parent
    const textIndex = parent.children.findIndex(
      (child) => child.type === NodeType.Text && child.name === textName,
    );

    if (textIndex !== -1) {
      parent.children.splice(textIndex, 1);
    }

    // Remove empty section nodes up the chain
    for (let i = 0; i < parentChain.length; i++) {
      const current = parentChain[i];
      const isLastNode = i === parentChain.length - 1;

      if (current && current.children.length === 0) {
        if (isLastNode) {
          // Last node in chain - remove from root if it's empty
          const rootIndex = this.children.findIndex(
            (child) =>
              child.name === current.name && child.type === current.type,
          );
          if (rootIndex !== -1) {
            this.children.splice(rootIndex, 1);
          }
        } else {
          // Not the last node - remove from its parent
          const grandParent = parentChain[i + 1];
          if (grandParent) {
            const sectionIndex = grandParent.children.findIndex(
              (child) =>
                child.name === current.name && child.type === current.type,
            );

            if (sectionIndex !== -1) {
              grandParent.children.splice(sectionIndex, 1);
            }
          }
        }
      } else {
        // Stop if we find a non-empty parent
        break;
      }
    }

    // Recompute statuses after deletion
    this.recomputeStatuses();
  }

  public changeStatus({
    path,
    status,
  }: {
    path: TreePath;
    status: "Done" | "NotStarted";
  }): Maybe<BranchNode> {
    const mbNode = this.getMaybeNode({ path });
    if (mbNode.error) {
      return mbNode;
    }

    const node = mbNode.data as BranchNode;

    // DFS to find all text nodes and update their page statuses
    this.setPageStatusesRecursive(node, status);

    // Recompute all statuses based on the new page statuses
    this.recomputeStatuses();

    return { error: false, data: node };
  }

  private setPageStatusesRecursive(
    node: BranchNode,
    status: "Done" | "NotStarted",
  ): void {
    if (node.type === NodeType.Text) {
      const textNode = node as TextNode;
      // Set all page statuses to the given status
      for (const page of textNode.children) {
        page.status = status as NodeStatus;
      }
    } else if (node.type === NodeType.Section) {
      const section = node as SectionNode;
      // Recursively process all children
      for (const child of section.children) {
        this.setPageStatusesRecursive(child, status);
      }
    }
  }

  public getDiff(other: CurratedTree): TreeNode[] {
    const otherSet = new Map<string, TreeNode>();
    for (const { node, path } of bfs(other)) {
      otherSet.set(path.join("-"), node);
    }

    const diff: TreeNode[] = [];

    for (const { node, path } of bfs(this)) {
      const key = path.join("-");
      const otherNode = otherSet.get(key);
      if (!otherNode) {
        diff.push(node);
        continue;
      }

      const found = areShallowEqual(node, otherNode);
      if (!found) {
        diff.push(node);
      }
    }

    return diff;
  }

  public isEqualTo(other: CurratedTree): boolean {
    return this.getDiff(other).length === 0;
  }

  getMaybeNode({ path }: { path: TreePath }): Maybe<BranchNode | CurratedTree> {
    // Empty path returns the tree itself (root)
    if (path.length === 0) {
      return { error: false, data: this };
    }

    let candidats = this.children;
    let lastMatchingNode: BranchNode | undefined;

    for (const part of path) {
      lastMatchingNode = candidats.find((node) => node.name === part);

      if (!lastMatchingNode) {
        return { error: true, description: `Node "${part}" not found` };
      }
      if (lastMatchingNode.type === NodeType.Section) {
        candidats = lastMatchingNode.children;
      } else {
        candidats = [];
      }
    }

    return lastMatchingNode
      ? { error: false, data: lastMatchingNode }
      : { error: true, description: `Node ${path.join("-")} not found` };
  }

  getMaybePage({
    path,
    index,
  }: {
    path: TreePath;
    index: number;
  }): Maybe<PageNode> {
    const maybeNode = this.getMaybeNode({ path });
    if (maybeNode.error) {
      return maybeNode;
    }

    const node = maybeNode.data as TextNode;
    if (node.type !== NodeType.Text) {
      return {
        error: true,
        description: `Node ${path.join("-")} is not a text`,
      };
    }

    const page = node.children.find((child) => child.index === index);
    if (!page) {
      return { error: true, description: `Page ${index} not found` };
    }

    return {
      error: false,
      data: page,
    };
  }

  getParentNode({
    path,
  }: {
    path: TreePath;
  }): Maybe<BranchNode | CurratedTree> {
    const nodeCheck = this.getMaybeNode({ path });
    if (nodeCheck.error) {
      return nodeCheck;
    }

    if (path.length === 1) {
      return { error: false, data: this };
    }

    const parentPath = path.slice(0, -1) as TreePath;
    return this.getMaybeNode({ path: parentPath });
  }

  getOrCreateSectionNode({ path }: { path: TreePath }): Maybe<SectionNode> {
    if (path.length === 0) {
      return {
        error: true,
        description: "Path is empty",
      };
    }

    const mbNode = this.getMaybeNode({ path });
    if (!mbNode.error && mbNode.data.type === NodeType.Section) {
      return { error: false, data: mbNode.data as SectionNode };
    }

    const pathCopy = [...path];
    const name = pathCopy.pop();
    const pathToParent = pathCopy;

    if (!name) {
      return {
        error: true,
        description: "Path is empty",
      };
    }

    const sectionNode: SectionNode = {
      name,
      status: NodeStatus.NotStarted,
      type: NodeType.Section,
      children: [],
      parent: null,
    };

    // Handle root-level section creation
    if (pathToParent.length === 0) {
      sectionNode.parent = null;
      this.children.push(sectionNode);
      return { error: false, data: sectionNode };
    }

    // Handle nested section creation
    const mbParent = this.getMaybeNode({ path: pathToParent as TreePath });

    if (mbParent.error) {
      return mbParent;
    }
    if (mbParent.data.type !== NodeType.Section) {
      return {
        error: true,
        description: "Parent is not a section",
      };
    }

    const parent = mbParent.data as SectionNode;
    sectionNode.parent = parent;
    parent.children.push(sectionNode);

    return { error: false, data: sectionNode };
  }

  getOrCreateTextNode({ path }: { path: TreePath }): Maybe<TextNode> {
    const mbNode = this.getMaybeNode({ path });
    if (!mbNode.error && mbNode.data.type === NodeType.Text) {
      return { error: false, data: mbNode.data };
    }

    let parent: SectionNode | undefined;
    for (let i = 0; i < path.length - 1; i++) {
      const mbSection = this.getOrCreateSectionNode({
        path: path.slice(0, i + 1) as TreePath,
      });
      if (mbSection.error) {
        return mbSection;
      }
      parent = mbSection.data;
    }

    const pathCopy = [...path];
    const textName = pathCopy.pop();
    if (!textName) {
      return {
        error: true,
        description: "Text name is empty",
      };
    }

    // Handle root-level text node (path.length === 1)
    if (path.length === 1) {
      // Check if TextNode with the same name already exists at root
      const existing = this.children.find(
        (node) => node.type === NodeType.Text && node.name === textName,
      ) as TextNode;

      if (existing) {
        return { error: false, data: existing };
      }

      const textNode: TextNode = {
        name: textName,
        status: NodeStatus.NotStarted,
        type: NodeType.Text,
        children: [],
        parent: null,
      };

      this.children.push(textNode);
      return { error: false, data: textNode };
    }

    if (!parent) {
      return {
        error: true,
        description: "No parent section found for TextNode. Path too short?",
      };
    }

    // Check if TextNode with the same name already exists
    const existing = parent.children.find(
      (node) => node.type === NodeType.Text && node.name === textName,
    ) as TextNode;

    if (existing) {
      return { error: false, data: existing };
    }

    const textNode: TextNode = {
      name: textName,
      status: NodeStatus.NotStarted,
      type: NodeType.Text,
      children: [],
      parent: parent,
    };

    parent.children.push(textNode);

    return { error: false, data: textNode };
  }

  getParentChain({ path }: { path: TreePath }): BranchNode[] {
    // Base case: stop at root level (path length 1)
    if (path.length <= 1) {
      return [];
    }

    const parent = this.getParentNode({ path });
    if (parent.error) {
      return [];
    }

    // Only include BranchNodes in the chain, not the tree root
    if ("children" in parent.data && parent.data !== this) {
      return [
        parent.data as BranchNode,
        ...this.getParentChain({ path: path.slice(0, -1) as TreePath }),
      ];
    }

    return [];
  }

  private getTextNodesFromNode(node: BranchNode): TextNode[] {
    const textNodes: TextNode[] = [];

    function textFindingDfs(node: BranchNode) {
      if (node.type === NodeType.Text) {
        textNodes.push(node as TextNode);
      } else if (node.type === NodeType.Section) {
        for (const child of (node as SectionNode).children) {
          textFindingDfs(child);
        }
      }
    }

    textFindingDfs(node);
    return textNodes;
  }

  private initializeParents(): void {
    for (const child of this.children) {
      child.parent = null;
      this.setChildParents(child);
    }
  }

  private setChildParents(node: BranchNode): void {
    if (node.type === NodeType.Section) {
      const section = node as SectionNode;
      for (const child of section.children) {
        child.parent = node;
        this.setChildParents(child);
      }
    } else if (node.type === NodeType.Text) {
      const text = node as TextNode;
      for (const page of text.children) {
        page.parent = node;
      }
    }
  }

  /**
   * Recomputes statuses for all nodes in the tree starting from the bottom.
   * Returns the closest to root node that had its status changed, or null if no changes.
   */
  public recomputeStatuses(): BranchNode | null {
    let closestChangedNode: BranchNode | null = null;

    // Compute statuses for all nodes bottom-up
    for (const child of this.children) {
      const changed = this.computeNodeStatusBottomUp(child);
      if (changed && !closestChangedNode) {
        closestChangedNode = changed;
      }
    }

    return closestChangedNode;
  }

  /**
   * Computes status for a single node and its ancestors bottom-up.
   * Returns the first (closest to root) node whose status changed.
   */
  private computeNodeStatusBottomUp(node: BranchNode): BranchNode | null {
    let closestChangedNode: BranchNode | null = null;

    // First, recursively compute statuses for all children
    if (node.type === NodeType.Section) {
      const section = node as SectionNode;
      for (const child of section.children) {
        const changed = this.computeNodeStatusBottomUp(child);
        if (changed && !closestChangedNode) {
          closestChangedNode = changed;
        }
      }
    }

    // Then compute status for this node based on its children
    const oldStatus = node.status;
    const newStatus = this.computeNodeStatus(node);

    if (oldStatus !== newStatus) {
      node.status = newStatus;
      // If this node's status changed, update parent chain
      if (node.parent) {
        const parentChanged = this.computeNodeStatusBottomUp(node.parent);
        if (parentChanged && !closestChangedNode) {
          closestChangedNode = parentChanged;
        }
      }
      // Return the current node as the closest changed if no child changed
      if (!closestChangedNode) {
        closestChangedNode = node;
      }
    }

    return closestChangedNode;
  }

  /**
   * Computes the status of a single node based on its children's statuses.
   * Rules:
   * - Text node: all pages Done → Done, all pages NotStarted → NotStarted, otherwise → InProgress
   * - Section node: all children Done → Done, all children NotStarted → NotStarted, otherwise → InProgress
   */
  private computeNodeStatus(node: BranchNode): NodeStatus {
    if (node.type === NodeType.Text) {
      const textNode = node as TextNode;
      if (textNode.children.length === 0) {
        return NodeStatus.NotStarted;
      }

      const allDone = textNode.children.every(
        (page) => page.status === NodeStatus.Done,
      );
      const allNotStarted = textNode.children.every(
        (page) => page.status === NodeStatus.NotStarted,
      );

      if (allDone) return NodeStatus.Done;
      if (allNotStarted) return NodeStatus.NotStarted;
      return NodeStatus.InProgress;
    }
    if (node.type === NodeType.Section) {
      const section = node as SectionNode;
      if (section.children.length === 0) {
        return NodeStatus.NotStarted;
      }

      const allDone = section.children.every(
        (child) => child.status === NodeStatus.Done,
      );
      const allNotStarted = section.children.every(
        (child) => child.status === NodeStatus.NotStarted,
      );

      if (allDone) return NodeStatus.Done;
      if (allNotStarted) return NodeStatus.NotStarted;
      return NodeStatus.InProgress;
    }

    return NodeStatus.NotStarted;
  }
}
