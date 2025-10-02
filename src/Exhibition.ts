import {
  AbstractWraplet,
  Constructable,
  Core,
  DefaultCore,
  WrapletChildrenMap,
} from "wraplet";
import { ExhibitionPreview } from "./ExhibitionPreview";
import { MonacoEditor, MonacoEditorOptions } from "./MonacoEditor";
import { editor } from "monaco-editor";
import { exhibitionDefaultAttribute } from "./selectors";
import { Editor } from "./types/Editor";
import { ElementStorage, Storage } from "wraplet/storage";

export type ExhibitionOptions = {
  refreshPreviewOnInit?: boolean;
  updaterSelector?: string;
};

export type ExhibitionMapOptions = {
  defaultMonacoOptions?: editor.IStandaloneEditorConstructionOptions | null;
  initEditors?: boolean;
};

const ExhibitionMap = {
  editors: {
    selector: "[data-js-exhibition-editor]" as string | undefined,
    multiple: true,
    required: false,
    Class: MonacoEditor as Constructable<Editor>,
    args: [] as [] | [MonacoEditorOptions],
  },
  preview: {
    selector: "iframe[data-js-exhibition-preview]",
    multiple: false,
    required: true,
    Class: ExhibitionPreview,
  },
  //updater: {
  //  selector: "[data-js-exhibition-update]",
  //  multiple: false,
  //  required: true,
  //  Class: ExhibitionPreview,
  //},
} satisfies WrapletChildrenMap;

export class Exhibition extends AbstractWraplet<
  typeof ExhibitionMap,
  HTMLElement
> {
  private options: Storage<Required<ExhibitionOptions>>;
  constructor(
    core: Core<typeof ExhibitionMap, HTMLElement>,
    options: ExhibitionOptions = {},
  ) {
    super(core);
    const defaultOptions: Required<ExhibitionOptions> = {
      refreshPreviewOnInit: true,
      updaterSelector: "[data-js-exhibition-updater]",
    };
    this.options = new ElementStorage<Required<ExhibitionOptions>>(
      this.node,
      exhibitionDefaultAttribute,
      { ...defaultOptions, ...options },
      {
        refreshPreviewOnInit: (data: unknown) => typeof data === "boolean",
        updaterSelector: (data: unknown) => typeof data === "string",
      },
    );

    const updaterElements = this.node.querySelectorAll(
      this.options.get("updaterSelector"),
    );

    if (this.options.get("refreshPreviewOnInit")) {
      this.updatePreview();
    }

    for (const element of updaterElements) {
      this.core.addEventListener(element, "click", () => {
        this.updatePreview();
      });
    }
  }

  public addEditor(editor: Editor): void {
    this.children.editors.add(editor);
  }

  public getPreview(): ExhibitionPreview {
    return this.children.preview;
  }

  public async updatePreview(): Promise<void> {
    for (const editor of this.children.editors) {
      const value = await editor.getValue();
      this.children.preview.append(value);
    }

    this.children.preview.flush();
  }

  public static createMultiple(
    node: ParentNode,
    attribute: string = exhibitionDefaultAttribute,
    options: ExhibitionOptions = {},
    mapOptions: ExhibitionMapOptions = {},
    map: typeof ExhibitionMap = ExhibitionMap,
  ): Exhibition[] {
    return this.createWraplets(node, this.getMap(mapOptions, map), attribute, [
      options,
    ]);
  }

  public static create(
    element: HTMLElement,
    options: ExhibitionOptions = {},
    mapOptions: ExhibitionMapOptions = {},
    map: typeof ExhibitionMap = ExhibitionMap,
  ): Exhibition {
    const core = new DefaultCore(element, this.getMap(mapOptions, map));
    return new Exhibition(core, options);
  }

  public static getMap(
    options: ExhibitionMapOptions = {},
    map: typeof ExhibitionMap = ExhibitionMap,
  ): typeof ExhibitionMap {
    const defaultOptions: Required<ExhibitionMapOptions> = {
      defaultMonacoOptions: null,
      initEditors: true,
    };
    const allOptions: Required<ExhibitionMapOptions> = {
      ...defaultOptions,
      ...options,
    };

    const editorOptions: MonacoEditorOptions = {};
    if (allOptions.defaultMonacoOptions) {
      editorOptions["monacoOptions"] = allOptions.defaultMonacoOptions;
    }
    if (!allOptions.initEditors) {
      map["editors"]["selector"] = undefined;
    }
    map["editors"]["args"] = [editorOptions];

    return map;
  }
}
