import { TFile, TFolder, type Vault } from "obsidian";
import {
  type Maybe,
  type PathParts,
  type PrettyPath,
  unwrapMaybe,
} from "../../../types/general";
import { SLASH } from "../../../types/literals";
import {
  pathToFolderFromPathParts,
  systemPathToFileFromPrettyPath,
  systemPathToFolderFromPrettyPath,
  systemPathToPrettyPath,
} from "../../pure-formatters/paths/path-helpers";
import { logError, logWarning } from "../helpers/issue-handlers";

export class BackgroundFileService {
  constructor(private vault: Vault) {}

  async getFile(prettyPath: PrettyPath): Promise<TFile> {
    const mbFile = await this.getMaybeFileByPrettyPath(prettyPath);
    return unwrapMaybe(mbFile);
  }

  async createFileInPrettyPath(
    prettyPath: PrettyPath,
    content = "",
  ): Promise<Maybe<TFile>> {
    const systemPath = `${systemPathToFileFromPrettyPath(prettyPath)}`;
    return await this.createMaybeFileInSystemPath(systemPath, content);
  }

  async createFolderInPrettyPath(
    prettyPath: PrettyPath,
  ): Promise<Maybe<TFolder>> {
    const systemPath = `${systemPathToFolderFromPrettyPath(prettyPath)}`;

    return await this.createMaybeFolderBySystemPath(systemPath);
  }

  async createFileInFolder(
    folder: TFolder,
    title: PrettyPath["title"],
  ): Promise<Maybe<TFile>> {
    const path = `${folder.path}/${title}`;
    const maybeFile = await this.createMaybeFileInSystemPath(path);

    return maybeFile;
  }

  async renameFile(prettyPath: PrettyPath, newName: string): Promise<TFile> {
    const systemPath = systemPathToFileFromPrettyPath(prettyPath);
    const maybeFile = await this.renameMaybeFileInSystemPath(
      systemPath,
      newName,
    );

    return unwrapMaybe(maybeFile);
  }

  async renameFolder(
    prettyPath: PrettyPath,
    newName: string,
  ): Promise<TFolder> {
    const systemPath = systemPathToFolderFromPrettyPath(prettyPath);
    const maybeFolder = await this.renameMaybeFolderInSystemPath(
      systemPath,
      newName,
    );
    return unwrapMaybe(maybeFolder);
  }

  async createFolderInFolder(
    folder: TFolder,
    title: PrettyPath["title"],
  ): Promise<Maybe<TFolder>> {
    const path = `${folder.path}/${title}`;
    const maybeFolder = await this.createMaybeFolderBySystemPath(path);

    return maybeFolder;
  }

  async readFileContent(prettyPath: PrettyPath): Promise<string> {
    const maybeFile = await this.getFile(prettyPath);
    const content = await this.vault.read(maybeFile);

    return content;
  }

  async replaceFileContent(
    prettyPath: PrettyPath,
    content: string,
  ): Promise<string> {
    const maybeFile = await this.getFile(prettyPath);
    await this.vault.modify(maybeFile, content);

    return content;
  }

  async getParentOfFileWithPath(prettyPath: PrettyPath): Promise<TFolder> {
    const maybeParent = await this.getMaybeParentOfFileWithPath(prettyPath);
    return unwrapMaybe(maybeParent);
  }

  async getSiblingsOfFileWithPath(
    prettyPath: PrettyPath,
  ): Promise<Maybe<Array<TFile>>> {
    const maybeFile = await this.getMaybeFileByPrettyPath(prettyPath);
    const file = unwrapMaybe(maybeFile);

    return this.getSiblingsOfFile(file);
  }

  async createManyFiles(
    files: Array<{ prettyPath: PrettyPath; content?: string }>,
  ): Promise<TFile[]> {
    // Verify existence of all the folders for each file's path, and create them if missing
    for (const { prettyPath } of files) {
      const path = systemPathToFileFromPrettyPath(prettyPath);
      const folderPath = path.substring(0, path.lastIndexOf("/"));
      if (folderPath && !this.vault.getAbstractFileByPath(folderPath)) {
        // Recursively create missing folders
        const parts = folderPath.split("/");
        let currentPath = "";
        for (const part of parts) {
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          if (!this.vault.getAbstractFileByPath(currentPath)) {
            await this.vault.createFolder(currentPath);
          }
        }
      }
    }

    const created = await this.createManyFilesInExistingFolders(files);
    return unwrapMaybe(created);
  }

  async createManyFolders(
    prettyPaths: PrettyPath[],
  ): Promise<Maybe<TFolder[]>> {
    const created: TFolder[] = [];
    const errors: string[] = [];

    for (const prettyPath of prettyPaths) {
      const path = systemPathToFolderFromPrettyPath(prettyPath);

      const existing = this.vault.getAbstractFileByPath(path);
      if (existing instanceof TFolder) {
        continue; // skip if already exists
      }

      const maybeFolder = await this.createMaybeFolderBySystemPath(path);
      created.push(unwrapMaybe(maybeFolder));
    }

    if (errors.length > 0) {
      logWarning({
        description: `Failed to create many folders: ${errors.join(", ")}`,
        location: "BackgroundFileService",
      });
    }

    return { error: false, data: created };
  }

  async renameManyFolders(
    folders: Array<{ prettyPath: PrettyPath; newName: string }>,
  ): Promise<TFolder[]> {
    const renamed: TFolder[] = [];
    const errors: string[] = [];

    for (const { prettyPath, newName } of folders) {
      const systemPath = systemPathToFolderFromPrettyPath(prettyPath);
      const maybeFolder = await this.renameMaybeFolderInSystemPath(
        systemPath,
        newName,
      );

      if (maybeFolder.error) {
        errors.push(`${prettyPath}: ${maybeFolder.description}`);
        continue;
      }

      renamed.push(unwrapMaybe(maybeFolder));
    }

    if (errors.length > 0) {
      logWarning({
        description: `Failed to rename many folders: ${errors.join(", ")}`,
        location: "BackgroundFileService",
      });
    }

    return renamed;
  }

  async renameManyFiles(
    files: Array<{ prettyPath: PrettyPath; newName: string }>,
  ): Promise<TFile[]> {
    const renamed: TFile[] = [];
    const errors: string[] = [];

    for (const { prettyPath, newName } of files) {
      const systemPath = systemPathToFolderFromPrettyPath(prettyPath);
      const maybeFile = await this.renameMaybeFileInSystemPath(
        systemPath,
        newName,
      );

      if (maybeFile.error) {
        errors.push(`${prettyPath}: ${maybeFile.description}`);
        continue;
      }

      renamed.push(unwrapMaybe(maybeFile));
    }

    if (errors.length > 0) {
      logWarning({
        description: `Failed to rename many files: ${errors.join(", ")}`,
        location: "BackgroundFileService",
      });
    }

    return renamed;
  }

  private async getMaybeParentOfFileWithPath(
    prettyPath: PrettyPath,
  ): Promise<Maybe<TFolder>> {
    const maybeFile = await this.getMaybeFileByPrettyPath(prettyPath);
    if (maybeFile.error) return maybeFile;

    const parent = unwrapMaybe(maybeFile).parent;

    if (!parent) {
      return { error: true, description: "File does not have a parent" };
    }

    return { error: false, data: parent };
  }

  private async getSiblingsOfFile(file: TFile): Promise<Maybe<Array<TFile>>> {
    const parent = file.parent;

    if (parent && parent instanceof TFolder) {
      const siblings = parent.children
        .filter((child): child is TFile => child instanceof TFile)
        .filter((f) => f.path !== file.path);
      return { error: false, data: siblings };
    }

    return { error: false, data: [] };
  }

  private async getMaybeFileByPrettyPath(
    prettyPath: PrettyPath,
  ): Promise<Maybe<TFile>> {
    const filePath = systemPathToFileFromPrettyPath(prettyPath);
    try {
      const file = this.vault.getAbstractFileByPath(filePath);
      if (!file || !(file instanceof TFile)) {
        return { error: true };
      }
      return { data: file, error: false };
    } catch (error) {
      logError({
        description: `Failed to get file by path: ${error}`,
        location: "BackgroundFileService",
      });
      return { error: true };
    }
  }

  private async renameMaybeFileInSystemPath(
    systemPath: string,
    newName: string,
  ): Promise<Maybe<TFile>> {
    try {
      const file = await this.vault.getFileByPath(systemPath);
      if (!(file instanceof TFile)) {
        return { error: true, description: "Renamed item is not a file" };
      }

      await this.vault.rename(file, newName);

      return { error: false, data: file };
    } catch (error) {
      return { error: true, description: `Failed to rename file: ${error}` };
    }
  }

  private async renameMaybeFolderInSystemPath(
    systemPath: string,
    newName: string,
  ): Promise<Maybe<TFolder>> {
    try {
      const folder = await this.vault.getFolderByPath(systemPath);
      if (!(folder instanceof TFolder)) {
        return { error: true, description: "Renamed item is not a folder" };
      }

      await this.vault.rename(folder, newName);

      return { error: false, data: folder };
    } catch (error) {
      return { error: true, description: `Failed to rename folder: ${error}` };
    }
  }

  private async createMaybeFileInSystemPath(
    systemPath: string,
    content = "",
  ): Promise<Maybe<TFile>> {
    try {
      const file = await this.vault.create(`${systemPath}`, content);
      if (!(file instanceof TFile)) {
        return { error: true, description: "Created item is not a file" };
      }

      return { error: false, data: file };
    } catch (error) {
      return { error: true, description: `Failed to create file: ${error}` };
    }
  }

  private async createMaybeFolderBySystemPath(
    systemPath: string,
  ): Promise<Maybe<TFolder>> {
    try {
      const folder = await this.vault.createFolder(systemPath);

      return { error: false, data: folder };
    } catch (error) {
      return { error: true, description: `Failed to create folder: ${error}` };
    }
  }

  public async treeToItems(folder: TFolder): Promise<Maybe<Array<PrettyPath>>> {
    const includeExt = ["md"].map((e) => e.toLowerCase());

    try {
      const out: Array<PrettyPath> = [];
      const stack: TFolder[] = [folder];

      while (stack.length) {
        const cur = stack.pop()!;
        const curPrettyParts = systemPathToPrettyPath(cur.path);

        for (const child of cur.children) {
          if (child instanceof TFolder) {
            stack.push(child);
          } else if (child instanceof TFile) {
            if (
              includeExt.length === 0 ||
              includeExt.includes(child.extension.toLowerCase())
            ) {
              out.push(curPrettyParts);
            }
          }
        }
      }

      out.sort((a, b) => {
        const ap = a.pathParts.join(SLASH);
        const bp = b.pathParts.join(SLASH);
        const byPath = ap.localeCompare(bp, undefined, { sensitivity: "base" });
        return byPath !== 0
          ? byPath
          : a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
      });

      return { error: false, data: out };
    } catch (e) {
      return {
        error: true,
        description: `Failed to traverse tree: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  /**
   * Convenience: start traversal from a folder path (PathParts).
   */
  public async treeToItemsByPathParts(
    pathParts: PathParts,
  ): Promise<Maybe<Array<PrettyPath>>> {
    const folderPath = pathToFolderFromPathParts(pathParts);
    try {
      const abs = this.vault.getAbstractFileByPath(folderPath);
      if (!(abs instanceof TFolder)) {
        return { error: true, description: `Not a folder: ${folderPath}` };
      }
      return this.treeToItems(abs);
    } catch (e) {
      return {
        error: true,
        description: `Failed to resolve folder: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  private async createManyFilesInExistingFolders(
    files: Array<{ prettyPath: PrettyPath; content?: string }>,
  ): Promise<Maybe<TFile[]>> {
    const created: TFile[] = [];
    const errors: string[] = [];

    for (const { prettyPath, content = "" } of files) {
      const path = systemPathToFileFromPrettyPath(prettyPath);

      const existing = this.vault.getAbstractFileByPath(path);
      if (existing instanceof TFile) {
        continue; // skip existing file
      }

      const file = await this.createMaybeFileInSystemPath(path, content);
      if (file.error) {
        errors.push(`${path}: ${file.description}`);
        continue;
      }

      created.push(unwrapMaybe(file));
    }

    if (errors.length > 0) {
      logWarning({
        description: `Failed to create many files: ${errors.join(", ")}`,
        location: "BackgroundFileService",
      });
    }

    return { error: false, data: created };
  }
}
