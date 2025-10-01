import { PreviewValue } from "./PreviewValue";
import { Wraplet } from "wraplet";

export interface Editor extends Wraplet<HTMLElement> {
  getValue(): Promise<PreviewValue>;
}
