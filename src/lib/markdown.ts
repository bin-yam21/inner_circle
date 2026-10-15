import { marked } from "marked";
import DOMPurify from "dompurify";

marked.setOptions({ gfm: true, breaks: false });

/** Render trusted-but-sanitized Markdown (content files may include inline HTML and SVG diagrams). */
export function renderMarkdown(md: string): string {
  const html = marked.parse(md, { async: false }) as string;
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true, svg: true }, ADD_ATTR: ["target", "rel"] });
}
