import { AbstractWraplet, Core, DefaultCore } from "wraplet";
import { Storage, StorageValidators } from "wraplet/storage";

import * as monaco from "monaco-editor";
import { DocumentAltererWraplet } from "./types/DocumentAltererWraplet";
import { ElementStorage } from "wraplet/storage";
import { defaultOptionsAttribute } from "./selectors";
import {
  getTagFromType,
  getTypeFromLanguage,
  isSingleTagType,
  MonacoEditorLanguages,
} from "./TypeMap";
import { DocumentAlterer } from "./types/DocumentAlterer";

export type MonacoEditorOptions = {
  optionsAttribute?: string;
  monacoEditorModule: typeof monaco;
  monacoOptions?: monaco.editor.IStandaloneEditorConstructionOptions;
  location?: "head" | "body";
  priority?: number;
  trimDefaultValue?: boolean;
  tagAttributes?: Record<string, string>;
};

type RequiredMonacoEditorOptions = Required<
  Omit<MonacoEditorOptions, "tagAttributes">
> & {
  tagAttributes?: MonacoEditorOptions["tagAttributes"];
};

export class MonacoEditor
  extends AbstractWraplet<HTMLElement>
  implements DocumentAltererWraplet
{
  private monacoEditorModule: typeof monaco;
  private editor: monaco.editor.IStandaloneCodeEditor;
  private options: Storage<RequiredMonacoEditorOptions>;

  constructor(core: Core<HTMLElement>, options: MonacoEditorOptions) {
    super(core);

    const defaultOptions: RequiredMonacoEditorOptions = {
      optionsAttribute: "data-js-options",
      monacoOptions: {},
      location: "body",
      priority: 0,
      trimDefaultValue: true,
      monacoEditorModule: options.monacoEditorModule,
    };

    const validators: StorageValidators<MonacoEditorOptions> = {
      optionsAttribute: (data: unknown) => typeof data === "string",
      // We generally don't validate monacoOptions, leaving it to the monaco editor.
      monacoOptions: () => true,
      location: (data: unknown) =>
        typeof data === "string" && ["head", "body"].includes(data),
      priority: (data: unknown) => Number.isInteger(data),
      tagAttributes: (data: unknown) => typeof data === "object",
      trimDefaultValue: (data: unknown) => typeof data === "boolean",
      monacoEditorModule: (data: unknown) =>
        data !== null && typeof data === "object",
    };

    options.monacoOptions = {
      ...defaultOptions.monacoOptions,
      ...options.monacoOptions,
    };

    this.options = new ElementStorage<RequiredMonacoEditorOptions>(
      this.node,
      defaultOptionsAttribute,
      { ...defaultOptions, ...options },
      validators,
      {
        elementOptionsMerger: (defaults, options) => {
          return { ...defaults, ...options };
        },
      },
    );

    this.monacoEditorModule = this.options.get("monacoEditorModule");

    if (this.options.get("trimDefaultValue")) {
      const monacoOptions = this.options.get("monacoOptions");
      if (monacoOptions.value) {
        monacoOptions.value = this.trimDefaultValue(monacoOptions.value);
        this.options.set("monacoOptions", monacoOptions);
      }
    }

    this.validateOptions();

    const monacoOptions = this.options.get("monacoOptions");
    this.monacoEditorModule.languages.typescript.typescriptDefaults.setEagerModelSync(
      true,
    );
    const model = this.monacoEditorModule.editor.createModel(
      this.options.get("monacoOptions").value || "",
      this.getLanguage(),
      this.monacoEditorModule.Uri.parse(`file:///${this.getLanguage()}.ts`),
    );

    const monacoEditorModule = this.options.get("monacoEditorModule");
    this.editor = monacoEditorModule.editor.create(this.node, {
      ...monacoOptions,
      ...{ model: model },
    });
  }

  public getPriority(): number {
    return this.options.get("priority");
  }

  public getValue(): string {
    return this.editor.getValue();
  }

  public async alterDocument(document: Document): Promise<void> {
    const language = this.getLanguage();
    const content =
      language === "typescript" ? await this.getTSValueAsJS() : this.getValue();

    const location = this.options.get("location");

    const type = getTypeFromLanguage(language);

    if (isSingleTagType(type)) {
      const tag = getTagFromType(type);
      const tagAttributes = this.options.get("tagAttributes") ?? {};
      const tagElement = document.createElement(tag);
      for (const [key, value] of Object.entries(tagAttributes)) {
        tagElement.setAttribute(key, value);
      }
      tagElement.innerHTML = content;
      document[location].appendChild(tagElement);
      return;
    }
    document[location].innerHTML += content;
  }

  public getDocumentAlterer(): DocumentAlterer {
    return this.alterDocument.bind(this);
  }

  /**
   * Additional validation.
   */
  private validateOptions() {
    if (!this.options.get("monacoOptions").language) {
      throw new Error("Missing language in monacoOptions");
    }

    const type = getTypeFromLanguage(this.getLanguage());
    if (!isSingleTagType(type)) {
      if (this.options.get("tagAttributes")) {
        throw new Error(
          "'tagAttributes' option is only allowed for single tag types",
        );
      }
    }
  }

  private async getTSValueAsJS() {
    const model = this.editor.getModel();
    if (!model) throw new Error("Model is not available");

    // Make sure TypeScript eager sync is enabled
    this.monacoEditorModule.languages.typescript.typescriptDefaults.setEagerModelSync(
      true,
    );

    // Ensure we're using file:/// URI
    const uri = model.uri;
    if (uri.scheme !== "file") {
      throw new Error(`Model must use file:// URI, got: ${uri.toString()}`);
    }

    // Get worker getter
    const getWorker = async (
      attempts: number = 10,
    ): Promise<
      | ((
          ...uris: monaco.Uri[]
        ) => Promise<monaco.languages.typescript.TypeScriptWorker>)
      | null
    > => {
      try {
        return await this.monacoEditorModule.languages.typescript.getTypeScriptWorker();
      } catch (error) {
        if (error !== "TypeScript not registered!") throw error;
        if (attempts <= 0) return null;
        await new Promise((r) => setTimeout(r, 200));
        return getWorker(attempts - 1);
      }
    };

    const workerGetter = await getWorker();
    if (!workerGetter)
      throw new Error("Timeout: Could not get TypeScript worker");

    const worker = await workerGetter(uri);

    // 🔸 Wait until the worker actually knows this file
    // Call something lightweight to force registration
    for (let i = 0; i < 20; i++) {
      try {
        await worker.getSemanticDiagnostics(uri.toString());
        break; // success — worker now recognizes the file
      } catch (err) {
        if (/Could not find source file/.test(String(err))) {
          await new Promise((r) => setTimeout(r, 250));
          continue;
        }
        throw err;
      }
    }

    // Now it's safe to call getEmitOutput
    const { outputFiles } = await worker.getEmitOutput(uri.toString());
    if (!outputFiles.length) throw new Error("No JS output produced");
    return outputFiles[0].text;
  }

  private getLanguage(): MonacoEditorLanguages {
    const monacoOptions = this.options.get("monacoOptions");

    if (!monacoOptions["language"]) {
      throw new Error("Missing language in monacoOptions");
    }

    return monacoOptions["language"] as MonacoEditorLanguages;
  }

  private trimDefaultValue(content: string): string {
    const lines = content.split("\n");

    // Find the first non-empty line to determine base indentation
    const firstNonEmptyLine = lines.find((line) => line.trim().length > 0);

    if (!firstNonEmptyLine) {
      return content.trim();
    }

    // Count leading spaces on the first non-empty line
    const leadingSpaces = firstNonEmptyLine.search(/\S|$/);

    // Trim the same number of spaces from each line
    const trimmedLines = lines.map((line) => {
      // Only trim if the line has at least that many leading spaces
      if (
        line.length >= leadingSpaces &&
        line.substring(0, leadingSpaces).trim() === ""
      ) {
        return line.substring(leadingSpaces);
      }
      return line;
    });

    // Join back and trim any leading/trailing empty lines
    return trimmedLines.join("\n").trim();
  }

  public static create(
    element: HTMLElement,
    options: MonacoEditorOptions,
  ): MonacoEditor {
    const core = new DefaultCore(element, {});
    return new MonacoEditor(core, options);
  }
}
