import { AbstractWraplet, Core } from "wraplet";
import { PreviewValue, IsSingleTag } from "./types/PreviewValue";
import { isSingleTagValue } from "./TypeMap";

export class ExhibitionPreview extends AbstractWraplet<{}, HTMLIFrameElement> {
  constructor(core: Core<{}, HTMLIFrameElement>) {
    super(core);
  }

  private items: PreviewValue[] = [];

  public flush(): void {
    this.node.onload = () => {
      this.appendItemsToDocument(this.items);
      this.items = [];

      // Make sure it won't run again.
      this.node.onload = null;
      this.updateHeight();
    };
    const document = this.getIFrameDocument();
    document.location.reload();
  }

  public updateHeight(): void {
    const iframeWindow = this.getWindow();
    const iframeDocument = this.getIFrameDocument();
    const el = iframeDocument.querySelector("html");
    if (!el) {
      return;
    }

    const styles = iframeWindow.getComputedStyle(el);
    const margin =
      parseFloat(styles["marginTop"]) + parseFloat(styles["marginBottom"]);

    const height = Math.ceil(el.offsetHeight + margin);

    this.node.height = height + "px";
  }

  public append(value: PreviewValue): void {
    this.items.push(value);
  }

  private appendHTML(item: Exclude<PreviewValue, IsSingleTag>): void {
    const document = this.getIFrameDocument();
    const node = document.createElement("div");
    node.innerHTML = item.content;
    this.getIFrameDocument()[item.location].appendChild(node);
  }

  private appendTag(item: Extract<PreviewValue, IsSingleTag>): void {
    const document = this.getIFrameDocument();
    const node = document.createElement(item.tag);
    if (item.attributes) {
      for (const [key, value] of Object.entries(item.attributes)) {
        node.setAttribute(key, value);
      }
    }
    node.textContent = item.content;
    document[item.location].appendChild(node);
  }

  private appendItemsToDocument(items: PreviewValue[]): void {
    items.sort((a, b) => a.priority - b.priority);
    for (const item of items) {
      this.appendItemToDocument(item);
    }
  }

  private appendItemToDocument(item: PreviewValue): void {
    if (isSingleTagValue(item)) {
      this.appendTag(item);
    } else {
      this.appendHTML(item);
    }
  }

  private getIFrameDocument(): Document {
    const iframeDocument = this.node.contentDocument;
    if (!iframeDocument) {
      throw new Error("IFrame document is not available.");
    }

    return iframeDocument;
  }

  private getWindow(): Window {
    const window = this.node.contentWindow;
    if (!window) {
      throw new Error("Window is not available.");
    }
    return window;
  }
}
