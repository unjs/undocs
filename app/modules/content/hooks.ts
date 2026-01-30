import type { MarkdownRoot, MinimarkNode, MinimarkElement } from "@nuxt/content";
import type { Nuxt } from "nuxt/schema";
import { CommonIcons } from "./icons";
import type { DocsConfig } from "../../../schema/config";
import { pathToFileURL } from "node:url";
import { writeFile } from "node:fs/promises";

interface ParsedContentFile extends Record<string, unknown> {
  path?: string;
  navigation?: {
    icon?: string;
  };
  meta?: {
    icon?: string;
  };
  body?: {
    icon?: string;
  };
}

export async function setupContentHooks(nuxt: Nuxt, docsConfig: DocsConfig) {
  let automdTransform: (content: string, path: string) => string | Promise<string> | undefined;
  if (docsConfig.automd) {
    const automd = await import("automd");
    const config = await automd.loadConfig(docsConfig.dir, docsConfig.automd);
    automdTransform = async (content: string, path: string) => {
      const res = await automd.transform(content, config, pathToFileURL(path).href);
      if (!res.hasIssues) {
        if (res.hasChanged) {
          console.info(
            `[undocs] [automd] Updated \`${path}\` with automd transform, saving changes...`,
          );
          await writeFile(path, res.contents, "utf-8");
        }
        return res.contents;
      }
      console.warn(
        `[undocs] [automd] Issues for updating \`${path}\`:`,
        res.updates
          .flatMap((u) => u.result.issues)
          .map((i) => `\n  - ${i}`)
          .join("\n"),
      );
      return content;
    };
  }

  nuxt.hooks.hook("content:file:beforeParse", async ({ file }) => {
    if (typeof file.body !== "string") {
      return; // can be json meta
    }
    if (file.body.includes("<!-- automd:")) {
      // Transform
      if (automdTransform) {
        file.body = await automdTransform(file.body, file.path);
      }
      // Add meta (for rendering contribution hint)
      if (file.body.startsWith("---")) {
        file.body = file.body.replace("---", "---\nautomd: true\n");
      } else {
        file.body = `---\nautomd: true\n---\n${file.body}`;
      }
    }
  });

  nuxt.hooks.hook("content:file:afterParse", ({ content }) => {
    // Infer icon for top level navigation
    inferIcons(content);

    // Filter out non-markdown files
    if (content.extension !== "md") {
      return;
    }

    const body = content.body as MarkdownRoot;
    removeFirstH1AndBlockquote(body, content);
    body.value = mergeCodeGroups(body.value);
    for (const node of body.value) {
      if (typeof node === "string") {
        continue;
      }
      transformStepsList(node); // should be before alerts
      transformGithubAlert(node);
      transformMermaid(node);
      // transformJSDocs(idx, file.body?.children)
    }
  });
}

// --- transform github alerts ---

// Handle GitHub flavoured markdown blockquotes
// https://github.com/orgs/community/discussions/16925
function transformGithubAlert(node: MinimarkNode) {
  if (
    node[0] === "blockquote" &&
    Array.isArray(node[2]) &&
    node[2][0] === "p" &&
    Array.isArray(node[2][2]) &&
    node[2][2][0] === "span" &&
    typeof node[2][2][2] === "string" &&
    ["!NOTE", "!TIP", "!IMPORTANT", "!WARNING", "!CAUTION"].includes(node[2][2][2])
  ) {
    // @ts-expect-error read-only
    node[0] = node[2][2][2].slice(1).toLowerCase();
    // @ts-expect-error read-only
    node[2] = ["p", {}, ...node[2].slice(3)] as MinimarkElement;
  }
}

// --- transform mermaid code tags ---

// https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams
function transformMermaid(node: MinimarkNode) {
  // @ts-expect-error
  if (node[0] === "pre" && node[1]?.language === "mermaid") {
    // @ts-expect-error
    node[0] = "mermaid";
    // @ts-expect-error
    node[1] = { code: node[1].code || "" };
    // Remove all children (splice instead of node[2] = [] which would create an invalid empty array child)
    node.splice(2);
  }
}

// --- transform steps list ---

function transformStepsList(node: MinimarkNode) {
  // CONVERT OL->LI to Steps
  if (
    Array.isArray(node) &&
    node[0] === "ol" &&
    node.length > 3 &&
    Array.isArray(node[2]) &&
    node[2][0] === "li"
  ) {
    const stepsChildren = node.slice(2).map((li: MinimarkNode) => {
      return ["h4", {}, ...li.slice(2)] as MinimarkElement;
    });
    node.splice(0, Infinity, "steps", { level: "4" }, ...stepsChildren);
  }
}

// --- transform first h1 and blockquote ---

function removeFirstH1AndBlockquote(body: MarkdownRoot, content: ParsedContentFile) {
  // Remove first h1 from markdown files as it is added to front-matter as title
  if (body.value?.[0]?.[0] === "h1" && content.title === _getTextContent(body.value[0])) {
    body.value.shift();
  }

  // Remove default inferred value for description
  content.description = "";
  if (content.seo) {
    (content.seo as any).description = "";
  }

  // Use the first blockquote as the description
  const firstEl = body.value[0];
  if (firstEl) {
    const bloquoteText = _getTextContent(firstEl);
    if (
      firstEl[0] === "blockquote" &&
      content.description === "" &&
      !bloquoteText.startsWith("!")
    ) {
      content.description = bloquoteText;
      if (content.seo) {
        (content.seo as any).description = bloquoteText;
      }
      body.value.shift();
    }
  }
}

// --- resolve icon ---

function inferIcons(content: ParsedContentFile) {
  const icon =
    content.meta?.icon ||
    content.navigation?.icon ||
    content.body?.icon ||
    _resolveIcon(content.path);

  content.body ??= {};
  content.body.icon ??= icon;

  content.meta ??= {};
  content.meta.icon ??= icon;

  content.navigation ??= {};
  content.navigation.icon ??= icon;
}

function _resolveIcon(path: string = "") {
  // Split the path into parts and reverse it
  const paths = path
    .slice(1)
    .split("/")
    .reverse()
    .filter((p) => p && !p.startsWith("."));

  // Skip 2+ levels of directories
  if (paths.length > 2) {
    return;
  }

  // Search for icons in reverse order
  for (const p of paths) {
    for (const icon of CommonIcons) {
      if (p.includes(icon.pattern)) {
        return icon.icon;
      }
    }
  }
}

// --- Merge code groups ---

function mergeCodeGroups(children: MinimarkNode[] = []): MinimarkNode[] {
  const newChildren: MinimarkNode[] = [];

  let codeBlocks: MinimarkNode[] = [];

  for (let i = 0; i < children.length; i++) {
    if (_isNamedCodeBlock(children[i])) {
      codeBlocks.push(children[i]);
      continue;
    }
    if (codeBlocks.length > 0) {
      newChildren.push(codeBlocks.length > 1 ? ["CodeGroup", {}, ...codeBlocks] : codeBlocks[0]);
      codeBlocks = [];
    }
    newChildren.push(children[i]);
  }

  return newChildren;
}

function _isNamedCodeBlock(node: MinimarkNode): boolean {
  return node[0] === "pre" && (node[1] as any)?.filename && node[2]?.[0] === "code";
}

// --- transform automd jsdocs ---

export function transformJSDocs(currChildIdx: number, children: MinimarkNode[] = []) {
  if (!children?.length || !_isJSDocBlock(children[currChildIdx])) {
    return;
  }

  const fields: MinimarkNode[] = [];

  const generateFields = (i: number): MinimarkNode => {
    const name = _parseJSDocName(children[i]);
    const type = _parseJSDocType(children[i + 1]);

    const props: {
      name: string;
      type: string | false;
    } = {
      name,
      type,
    };

    const content: MinimarkNode[] = [];

    i++;

    if (type !== "") {
      children[i] = _emptyASTNode();
      i++;
    }

    while (i < children.length && children[i].tag !== "h3" && children[i].tag === "p") {
      content.push(children[i]);
      children[i] = _emptyASTNode();
      i++;
    }

    return {
      type: "element",
      tag: "field",
      props,
      children: content,
    };
  };

  // Go through we find the correct match for all h3
  for (let i = currChildIdx; i < children.length; i++) {
    // Make sure it's a JSDoc block before generating fields
    if (_isJSDocBlock(children[i])) {
      const field = generateFields(i);
      // Double check if has description or a type to avoid empty fields
      if ((field?.children || [])?.length > 0 || field?.props?.type !== "") {
        fields.push(field);
      } else {
        // set blank text node to avoid empty text nodes in the markdown AST
        children[i] = _emptyASTNode();
      }
    }
  }

  // If no fields were generated, return early
  if (fields.length <= 0) {
    return;
  }

  // Replace current children with the new field group
  children[currChildIdx] = {
    type: "element",
    tag: "field-group",
    children: [...fields],
  };
}

function _isJSDocBlock(children: MinimarkNode): boolean {
  return (
    children?.tag === "h3" &&
    children?.children?.[0]?.tag === "code" &&
    children?.children?.[0]?.type === "element"
  );
}

function _parseJSDocName(node: MinimarkNode): string {
  // Code block || id prop || empty string
  return node.children?.[0]?.children?.[0]?.value || node?.props?.id || "";
}
function _parseJSDocType(node: MinimarkNode): string {
  const hasType = !!node?.children?.[0]?.children?.[0]?.children?.[0]?.value;
  if (!hasType) {
    return "";
  }

  return node?.children?.[0]?.children?.[2]?.children?.[0]?.value || "";
}

// --- internal utils ---

function _getTextContent(node: MinimarkNode): string {
  if (!node) {
    return "";
  }
  if (typeof node === "string") {
    return node;
  }
  return node.slice(2).map(_getTextContent).join("");
}

function _emptyASTNode() {
  return { type: "text", value: "" };
}
