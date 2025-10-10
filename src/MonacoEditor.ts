import { AbstractWraplet, Core, DefaultCore } from "wraplet";
import { Storage, StorageValidators } from "wraplet/storage";

declare global {
  interface Window {
    ExhibitionJSMonacoWorkersPath?: string;
  }
}
console.log(window.ExhibitionJSMonacoWorkersPath);

if (window.ExhibitionJSMonacoWorkersPath) {
  window.MonacoEnvironment = {
    getWorkerUrl: function (_workerId, label) {
      // Map label to worker file
      const workerMap: Record<string, string> = {
        json: "json.worker.js",
        css: "css.worker.js",
        scss: "css.worker.js",
        less: "css.worker.js",
        html: "html.worker.js",
        handlebars: "html.worker.js",
        razor: "html.worker.js",
        typescript: "ts.worker.js",
        javascript: "ts.worker.js",
      };

      const workerFile = workerMap[label] || "editor.worker.js";

      console.log(window.ExhibitionJSMonacoWorkersPath + workerFile);

      return window.ExhibitionJSMonacoWorkersPath + workerFile;
    },
  };
}

import { editor, languages } from "monaco-editor";
import IStandaloneCodeEditor = editor.IStandaloneCodeEditor;
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
  monacoOptions?: editor.IStandaloneEditorConstructionOptions;
  location?: "head" | "body";
  priority?: number;
  trimDefaultValue?: boolean;
  tagAttributes?: Record<string, string>;
};

type RequiredMonacoEditorOptions = Required<
  Omit<MonacoEditorOptions, "tagAttributes" | "monacoEditorNamespace">
> & {
  tagAttributes?: MonacoEditorOptions["tagAttributes"];
};

export class MonacoEditor
  extends AbstractWraplet<{}, HTMLElement>
  implements DocumentAltererWraplet
{
  private editor: IStandaloneCodeEditor;
  private options: Storage<RequiredMonacoEditorOptions>;
  constructor(core: Core<{}, HTMLElement>, options: MonacoEditorOptions = {}) {
    super(core);

    const defaultOptions: RequiredMonacoEditorOptions = {
      optionsAttribute: "data-js-options",
      monacoOptions: {},
      location: "body",
      priority: 0,
      trimDefaultValue: true,
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

    if (this.options.get("trimDefaultValue")) {
      const monacoOptions = this.options.get("monacoOptions");
      if (monacoOptions.value) {
        monacoOptions.value = this.trimDefaultValue(monacoOptions.value);
        this.options.set("monacoOptions", monacoOptions);
      }
    }

    this.validateOptions();

    const monacoOptions = this.options.get("monacoOptions");
    this.editor = editor.create(this.node, monacoOptions);
  }

  public getPriority(): number {
    return this.options.get("priority");
  }

  public async alterDocument(document: Document): Promise<void> {
    const language = this.getLanguage();
    const content =
      language === "typescript"
        ? await this.getTSValueAsJS()
        : this.editor.getValue();

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

    if (!model) {
      throw new Error("Model is not available");
    }

    const worker = await languages.typescript.getTypeScriptWorker();
    const proxy = await worker(model.uri);

    const { outputFiles } = await proxy.getEmitOutput(model.uri.toString());
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
    options: MonacoEditorOptions = {},
  ): MonacoEditor {
    const core = new DefaultCore(element, {});
    return new MonacoEditor(core, options);
  }
}
