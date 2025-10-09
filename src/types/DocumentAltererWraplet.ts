import { Wraplet } from "wraplet";
import { DocumentAlterer } from "./DocumentAlterer";

export interface DocumentAltererWraplet extends Wraplet<HTMLElement> {
  getDocumentAlterer(): DocumentAlterer;
  getPriority(): number;
}
