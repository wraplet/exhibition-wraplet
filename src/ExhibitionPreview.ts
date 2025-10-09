import { AbstractWraplet, Core } from "wraplet";
import { DocumentAlterer } from "./types/DocumentAlterer";

type AltererData = {
  callback: DocumentAlterer;
  priority: number;
};

export class ExhibitionPreview extends AbstractWraplet<{}, HTMLIFrameElement> {
  constructor(core: Core<{}, HTMLIFrameElement>) {
    super(core);
  }

  private alterers: AltererData[] = [];
  private currentBlobUrl: string | null = null;

  public addDocumentAlterer(
    alterer: DocumentAlterer,
    priority: number = 0,
  ): void {
    this.alterers.push({
      callback: alterer,
      priority: priority,
    });
  }

  public async update(): Promise<void> {
    const doc = document.implementation.createHTMLDocument();
    this.alterers.sort((a, b) => a.priority - b.priority);
    for (const alterer of this.alterers) {
      await alterer.callback(doc);
    }

    // Revoke previous blob URL
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
    }

    const htmlContent = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    this.currentBlobUrl = URL.createObjectURL(blob);
    this.node.src = this.currentBlobUrl;

    this.node.onload = () => {
      this.updateHeight();
      this.node.onload = null;
    };
  }

  public updateHeight(): void {
    const iframeWindow = this.getIFrameWindow();
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

  private getIFrameDocument(): Document {
    const iframeDocument = this.node.contentDocument;
    if (!iframeDocument) {
      throw new Error("IFrame document is not available.");
    }

    return iframeDocument;
  }

  private getIFrameWindow(): Window {
    const window = this.node.contentWindow;
    if (!window) {
      throw new Error("IFrame window is not available.");
    }
    return window;
  }
}
