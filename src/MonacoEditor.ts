import { AbstractWraplet, Core, DefaultCore } from "wraplet";
import { Storage, StorageValidators } from "wraplet/storage";
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
  attributes?: Record<string, string>;
  valueSelector?: string;
};

type RequiredMonacoEditorOptions = Required<
  Omit<MonacoEditorOptions, "valueSelector" | "attributes">
> & {
  valueSelector?: MonacoEditorOptions["valueSelector"];
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
    };

    const validators: StorageValidators<MonacoEditorOptions> = {
      optionsAttribute: (data: unknown) => typeof data === "string",
      // We generally don't validate monacoOptions, leaving it to the monaco editor.
      monacoOptions: () => true,
      location: (data: unknown) =>
        typeof data === "string" && ["head", "body"].includes(data),
      priority: (data: unknown) => Number.isInteger(data),
      attributes: (data: unknown) => typeof data === "object",
      valueSelector: (data: unknown) =>
        typeof data === "undefined" ||
        (typeof data !== "undefined" && typeof data === "string"),
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

  public static create(
    element: HTMLElement,
    options: MonacoEditorOptions = {},
  ): MonacoEditor {
    const core = new DefaultCore(element, {});
    return new MonacoEditor(core, options);
  }
}
