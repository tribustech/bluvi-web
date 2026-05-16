import { Fragment } from "react";
import type { RichTextNode } from "@/types";

function renderNode(node: RichTextNode, index: number): React.ReactNode {
  if (node.text) {
    return <Fragment key={index}>{node.text}</Fragment>;
  }

  const children = node.children?.map((child, childIndex) => renderNode(child, childIndex));

  switch (node.type) {
    case "heading":
      if (node.level === 1) return <h1 key={index}>{children}</h1>;
      if (node.level === 2) return <h2 key={index}>{children}</h2>;
      return <h3 key={index}>{children}</h3>;
    case "paragraph":
      return <p key={index}>{children}</p>;
    case "list":
      return <ul key={index}>{children}</ul>;
    case "list-item":
      return <li key={index}>{children}</li>;
    case "link":
      return (
        <a key={index} href={node.url} target="_blank" rel="noreferrer">
          {children}
        </a>
      );
    default:
      return <Fragment key={index}>{children}</Fragment>;
  }
}

export function renderRichText(content?: string | RichTextNode[] | null) {
  if (!content) return null;
  if (typeof content === "string") {
    return <p>{content}</p>;
  }
  return content.map((node, index) => renderNode(node, index));
}
