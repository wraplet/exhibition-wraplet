import { ValueTypes } from "../TypeMap";

export type PreviewBaseValue = {
  type: ValueTypes;
  content: string;
  location: "head" | "body";
  priority: number;
};

export type IsSingleTag = { attributes: Record<string, string>; tag: string };

export type PreviewHTMLValue = PreviewBaseValue & {
  type: "html";
};
export type PreviewJSValue = PreviewBaseValue & {
  type: "js";
} & IsSingleTag;
export type PreviewCSSValue = PreviewBaseValue & {
  type: "css";
} & IsSingleTag;

export type PreviewValue = PreviewCSSValue | PreviewJSValue | PreviewHTMLValue;
