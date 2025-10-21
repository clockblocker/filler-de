import {
  type Editor,
  type MarkdownView,
  Plugin,
  TFile,
  type WorkspaceLeaf,
} from "obsidian";
import { AboveSelectionToolbarService } from "./services/obsidian-services/atomic-services/above-selection-toolbar-service";
import { ApiService } from "./services/obsidian-services/atomic-services/api-service";
import { BackgroundFileService } from "./services/obsidian-services/atomic-services/background-file-service";
import { BottomToolbarService } from "./services/obsidian-services/atomic-services/bottom-toolbar-service";
import { OpenedFileService } from "./services/obsidian-services/atomic-services/opened-file-service";
import { SelectionService } from "./services/obsidian-services/atomic-services/selection-service";
import { logError } from "./services/obsidian-services/helpers/issue-handlers";
import { extractMetaInfo } from "./services/pure-formatters/meta-info-manager/interface";
import { ACTION_CONFIGS } from "./services/wip-configs/actions/actions-config";
import {
  getAboveSelectionActionConfigs,
  getBottomActionConfigs,
} from "./services/wip-configs/actions/interface";
import newGenCommand from "./services/wip-configs/actions/new/new-gen-command";
// import { VaultCurrator } from './obsidian-related/obsidian-services/managers/vault-currator';
import addBacklinksToCurrentFile from "./services/wip-configs/actions/old/addBacklinksToCurrentFile";
import { makeClickListener } from "./services/wip-configs/event-listeners/click-listener/click-listener";
import { onNewFileThenRun } from "./services/wip-configs/event-listeners/create-new-file-listener/run-on-new-file";
import { SettingsTab } from "./settings";
import { DEFAULT_SETTINGS, type TextEaterSettings } from "./types";

export default class TextEaterPlugin extends Plugin {
  settings: TextEaterSettings;
  apiService: ApiService;
  openedFileService: OpenedFileService;
  backgroundFileService: BackgroundFileService;
  selectionService: SelectionService;
  // textsManagerService: VaultCurrator;

  selectionToolbarService: AboveSelectionToolbarService;
  bottomToolbarService: BottomToolbarService;

  override async onload() {
    try {
      await this.loadPlugin();
      this.addSettingTab(new SettingsTab(this.app, this));
    } catch (error) {
      logError({
        description: `Error during plugin initialization: ${error.message}`,
        location: "TextEaterPlugin",
      });
    }
  }

  async loadPlugin() {
    await this.loadSettings();
    await this.addCommands();

    this.apiService = new ApiService(this.settings);
    this.openedFileService = new OpenedFileService(this.app);
    this.backgroundFileService = new BackgroundFileService(this.app.vault);
    this.selectionToolbarService = new AboveSelectionToolbarService(this.app);
    this.selectionService = new SelectionService(this.app);
    // this.textsManagerService = new VaultCurrator(this.app);

    this.registerDomEvent(document, "click", makeClickListener(this));

    this.registerEvent(
      this.app.vault.on("create", (af) => {
        if (!(af instanceof TFile) || af.extension !== "md") return;

        onNewFileThenRun(this.app, af, () => {});
      }),
    );

    this.bottomToolbarService = new BottomToolbarService(this.app);
    this.bottomToolbarService.init();

    this.app.workspace.onLayoutReady(async () => {
      await this.updateBottomActions();
      await this.updateSelectionActions();
      this.selectionToolbarService.reattach();
      this.bottomToolbarService.reattach();
    });

    // Reattach when user switches panes/notes
    this.registerEvent(
      this.app.workspace.on(
        "active-leaf-change",
        async (_leaf: WorkspaceLeaf) => {
          await this.updateBottomActions();
          this.selectionToolbarService.reattach();
        },
      ),
    );

    // Add listeners to show the selection toolbar after drag or keyboard selection
    this.registerDomEvent(document, "dragend", async () => {
      await this.updateSelectionActions();
      this.selectionToolbarService.reattach();
    });

    this.registerDomEvent(document, "mouseup", async () => {
      await this.updateSelectionActions();
      this.selectionToolbarService.reattach();
    });

    this.registerDomEvent(document, "keyup", async (evt: KeyboardEvent) => {
      // Only reattach for keys that could affect selection
      const selectionKeys = [
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Shift",
        "Home",
        "End",
        "PageUp",
        "PageDown",
        "a",
      ];

      if (evt.shiftKey || selectionKeys.includes(evt.key)) {
        await this.updateSelectionActions();
        this.selectionToolbarService.reattach();
      }
    });

    // Also re-check after major layout changes (splits, etc.)
    this.registerEvent(
      this.app.workspace.on("layout-change", async () => {
        await this.updateBottomActions();
        this.selectionToolbarService.reattach();
      }),
    );

    this.registerEvent(
      this.app.workspace.on("css-change", () =>
        this.selectionToolbarService.onCssChange(),
      ),
    );
  }

  override onunload() {
    if (this.bottomToolbarService) this.bottomToolbarService.detach();
    if (this.selectionToolbarService) this.selectionToolbarService.detach();
  }

  private async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  private async addCommands() {
    this.addCommand({
      id: "backlink-all-to-current-file",
      name: "Populate all referenced files with a backlink to the current file",
      editorCheckCallback: (
        checking: boolean,
        editor: Editor,
        view: MarkdownView,
      ) => {
        const fileName = view.file?.name;
        const backlink = view.file?.basename;

        if (view.file && fileName && backlink) {
          if (!checking) {
            addBacklinksToCurrentFile(
              view.file,
              backlink,
              this.app.vault,
              this.app.metadataCache,
              editor,
            );
          }
          return true;
        }

        return false;
      },
    });

    this.addCommand({
      id: "fill-template",
      name: "Generate a dictionary entry for the word in the title of the file",
      editorCheckCallback: (
        checking: boolean,
        editor: Editor,
        view: MarkdownView,
      ) => {
        if (view.file) {
          if (!checking) {
            // fillTemplate(this, editor, view.file);
            // testEndgame(this, editor, view.file);
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "get-infinitive-and-emoji",
      name: "Get infinitive/normal form and emoji for current word",
      editorCheckCallback: (
        checking: boolean,
        editor: Editor,
        view: MarkdownView,
      ) => {
        if (view.file) {
          if (!checking) {
            // getInfinitiveAndEmoji(this, editor, view.file);
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "duplicate-selection",
      name: "Add links to normal/inf forms to selected text",
      editorCheckCallback: (
        checking: boolean,
        editor: Editor,
        view: MarkdownView,
      ) => {
        const selection = editor.getSelection();
        if (selection && view.file) {
          if (!checking) {
            // normalizeSelection(this, editor, view.file, selection);
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "translate-selection",
      name: "Translate selected text",
      editorCheckCallback: () => {
        ACTION_CONFIGS.TranslateSelection.execute(this);
      },
    });

    this.addCommand({
      id: "format-selection-with-number",
      name: "Split selection into linked blocks",
      editorCheckCallback: () => {
        ACTION_CONFIGS.SplitInBlocks.execute(this);
      },
    });

    this.addCommand({
      id: "check-ru-de-translation",
      name: "Keymaker",
      editorCheckCallback: (checking: boolean, editor: Editor) => {
        const selection = editor.getSelection();
        if (selection) {
          if (!checking) {
            // insertReplyFromKeymaker(this, editor, selection);
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "check-schriben",
      name: "Schriben check",
      editorCheckCallback: (checking: boolean, editor: Editor) => {
        const selection = editor.getSelection();
        if (selection) {
          if (!checking) {
            // insertReplyFromC1Richter(this, editor, selection);
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "new-gen-command",
      name: "new-gen-command",
      editorCheckCallback: (
        checking: boolean,
        editor: Editor,
        view: MarkdownView,
      ) => {
        if (view.file) {
          if (!checking) {
            newGenCommand(this);
          }
          return true;
        }
        return false;
      },
    });
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private async updateBottomActions(): Promise<void> {
    const { fileName, pathParts } =
      this.openedFileService.getFileNameAndPathParts();

    const metaInfo = extractMetaInfo(
      await this.openedFileService.getFileContent(),
    );

    this.bottomToolbarService.setActions(
      getBottomActionConfigs({
        metaInfo,
        fileName,
        pathParts,
      }),
    );
  }

  private async updateSelectionActions(): Promise<void> {
    const { fileName, pathParts } =
      this.openedFileService.getFileNameAndPathParts();

    const sectionText = await this.selectionService.getSelection();

    const metaInfo = extractMetaInfo(
      await this.openedFileService.getFileContent(),
    );

    this.selectionToolbarService.setActions(
      getAboveSelectionActionConfigs({
        metaInfo,
        fileName,
        pathParts,
        sectionText,
      }),
    );
  }
}
