import { AbstractWraplet, Core, DefaultCore } from "wraplet";
import { Storage, StorageValidators } from "wraplet/storage";

// This is an AI-generated workaround for monaco-editor workers not working correctly in iframes.
// Error it fixes is:
// ```
// Uncaught TypeError: Failed to execute 'importScripts' on 'WorkerGlobalScope': Module scripts don't support importScripts().
// ```

const inIframe = window.self !== window.top;
if (typeof window !== "undefined" && inIframe) {
  (window as any).MonacoEnvironment = {
    getWorker: function (_workerId: string, label: string) {
      // Get the base URL from the current script
      const getBaseUrl = () => {
        const scriptElements = document.getElementsByTagName("script");
        for (let i = scriptElements.length - 1; i >= 0; i--) {
          const src = scriptElements[i].src;
          if (src && (src.includes("index.js") || src.includes("index.cjs"))) {
            return src.substring(0, src.lastIndexOf("/") + 1);
          }
        }
        // Fallback: try to get from current document location
        return (
          document.location.href.substring(
            0,
            document.location.href.lastIndexOf("/") + 1,
          ) + "../dist/"
        );
      };

      const baseUrl = getBaseUrl();

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

      // Create absolute URL - this is crucial for importScripts to work
      let workerUrl: string;
      if (
        baseUrl.startsWith("http://") ||
        baseUrl.startsWith("https://") ||
        baseUrl.startsWith("file://")
      ) {
        // baseUrl is already absolute
        workerUrl = baseUrl + workerFile;
      } else {
        // Convert relative to absolute
        const a = document.createElement("a");
        a.href = baseUrl + workerFile;
        workerUrl = a.href;
      }

      // Create a blob-based worker to avoid CORS issues in iframes
      const workerBlob = new Blob([`importScripts('${workerUrl}');`], {
        type: "application/javascript",
      });

      return new Worker(URL.createObjectURL(workerBlob));
    },
  };
}

import * as monaco from "monaco-editor";

import { editor, languages } from "monaco-editor";
import IStandaloneCodeEditor = editor.IStandaloneCodeEditor;
import { Editor } from "./types/Editor";
import { ElementStorage } from "wraplet/storage";
import { defaultOptionsAttribute } from "./selectors";
import { PreviewValue } from "./types/PreviewValue";
import {
  getTagFromType,
  getTypeFromLanguage,
  isSingleTagType,
  isSingleTagValue,
  MonacoEditorLanguages,
  ValueTypes,
} from "./TypeMap";

export type MonacoEditorOptions = {
  optionsAttribute?: string;
  monacoOptions?: editor.IStandaloneEditorConstructionOptions;
  location?: "head" | "body";
  priority?: number;
  trimDefaultValue?: boolean;
  attributes?: Record<string, string>;
};

type RequiredMonacoEditorOptions = Required<
  Omit<MonacoEditorOptions, "attributes">
> & {
  attributes?: MonacoEditorOptions["attributes"];
};

export class MonacoEditor
  extends AbstractWraplet<{}, HTMLElement>
  implements Editor
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
      attributes: (data: unknown) => typeof data === "object",
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
        elementOptionsMerger: (defaults, elementOptions) => {
          elementOptions.monacoOptions = {
            ...defaults.monacoOptions,
            ...elementOptions.monacoOptions,
          };

          return { ...defaults, ...elementOptions };
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

    this.editor = monaco.editor.create(
      this.node,
      this.options.get("monacoOptions"),
    );
  }

  public async getValue(): Promise<PreviewValue> {
    const language = this.getLanguage();
    const content =
      language === "typescript"
        ? await this.getTSValueAsJS()
        : this.editor.getValue();

    const type = getTypeFromLanguage(language);
    const value: Partial<PreviewValue> & { type: ValueTypes } = {
      content: content,
      type: type,
      location: this.options.get("location"),
      priority: this.options.get("priority"),
    };

    if (isSingleTagValue(value)) {
      value["attributes"] = this.options.get("attributes") ?? {};
      value["tag"] = getTagFromType(value.type);
    }

    return value as PreviewValue;
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
      if (this.options.get("attributes")) {
        throw new Error(
          "'attributes' option is only allowed for single tag types",
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
