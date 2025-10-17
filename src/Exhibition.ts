import {
  AbstractWraplet,
  Constructable,
  Core,
  DefaultCore,
  WrapletChildrenMap,
} from "wraplet";
import { ExhibitionPreview } from "./ExhibitionPreview";
import { MonacoEditor, MonacoEditorOptions } from "./MonacoEditor";
import { exhibitionDefaultAttribute } from "./selectors";
import { DocumentAltererWraplet } from "./types/DocumentAltererWraplet";
import { ElementStorage, Storage } from "wraplet/storage";
import { DocumentAlterer } from "./types/DocumentAlterer";

export type ExhibitionOptions = {
  refreshPreviewOnInit?: boolean;
  updaterSelector?: string;
};

export type ExhibitionMapOptions = {
  Class: Constructable<DocumentAltererWraplet>;
  initEditors?: boolean;
};

const ExhibitionMap = {
  editors: {
    selector: "[data-js-exhibition-editor]" as string | undefined,
    multiple: true,
    required: false,
    Class: MonacoEditor as Constructable<DocumentAltererWraplet>,
    args: [] as unknown[],
  },
  preview: {
    selector: "iframe[data-js-exhibition-preview]",
    multiple: false,
    required: true,
    Class: ExhibitionPreview,
  },
} satisfies WrapletChildrenMap;

export class Exhibition extends AbstractWraplet<
  HTMLElement,
  typeof ExhibitionMap
> {
  private options: Storage<Required<ExhibitionOptions>>;
  constructor(
    core: Core<HTMLElement, typeof ExhibitionMap>,
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
    for (const editor of this.children.editors) {
      this.children.preview.addDocumentAlterer(
        editor.getDocumentAlterer(),
        editor.getPriority(),
      );
    }

    const updaterElements = this.node.querySelectorAll(
      this.options.get("updaterSelector"),
    );

    for (const element of updaterElements) {
      this.core.addEventListener(element, "click", () => {
        this.updatePreview();
      });
    }

    if (this.options.get("refreshPreviewOnInit")) {
      this.updatePreview();
    }
  }

  public addEditor(editor: DocumentAltererWraplet): void {
    this.children.editors.add(editor);
    this.addPreviewAlterer(editor.getDocumentAlterer(), editor.getPriority());
  }

  public addPreviewAlterer(
    alterer: DocumentAlterer,
    priority: number = 0,
  ): void {
    this.children.preview.addDocumentAlterer(alterer, priority);
  }

  public getPreview(): ExhibitionPreview {
    return this.children.preview;
  }

  public async updatePreview(): Promise<void> {
    await this.children.preview.update();
  }

  public static createMultiple(
    node: ParentNode,
    attribute: string = exhibitionDefaultAttribute,
    map: typeof ExhibitionMap,
    options: ExhibitionOptions = {},
  ): Exhibition[] {
    return this.createWraplets(node, map, attribute, [options]);
  }

  public static create(
    element: HTMLElement,
    map: typeof ExhibitionMap,
    options: ExhibitionOptions = {},
  ): Exhibition {
    const core = new DefaultCore(element, map);
    return new Exhibition(core, options);
  }

  public static getMapWithMonacoEditor(
    editorOptions: MonacoEditorOptions,
    options: Omit<ExhibitionMapOptions, "Class"> = {},
  ): typeof ExhibitionMap {
    const opts: ExhibitionMapOptions = {
      ...options,
      Class: MonacoEditor,
    };
    const map = this.getMap(opts);

    map["editors"]["args"] = [editorOptions];

    return map;
  }

  public static getMap(options: ExhibitionMapOptions): typeof ExhibitionMap {
    const map: typeof ExhibitionMap = ExhibitionMap;
    const allOptions: Required<ExhibitionMapOptions> = {
      ...{
        initEditors: true,
      },
      ...options,
    };

    map["editors"]["Class"] = allOptions.Class;

    if (!allOptions.initEditors) {
      map["editors"]["selector"] = undefined;
    }

    return map;
  }
}
