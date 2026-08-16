/**
 * Minimal typings for the WebMCP `document.modelContext` API
 * (https://webmachinelearning.github.io/webmcp/). No TS lib ships these yet and
 * the spec is still moving, so we model only the slice we use and keep the
 * global augmentation OPTIONAL — every call site feature-detects first.
 */

export interface ToolAnnotations {
  /** The tool only reads; it does not mutate page state. */
  readOnlyHint?: boolean;
  /**
   * The result may embed content the page's author does not fully control — the
   * client is expected to fence it off as data and usually wraps it in a
   * warning to the agent.
   *
   * DELIBERATELY UNSET by every docs tool: a site's pages, its nav and its
   * config are all one repo, so the docs ARE the page author's own content and
   * flagging them would spend the warning on everything the agent ever reads
   * here. Setting it on one tool is a claim that THAT tool reaches something the
   * rest do not — content proxied from a third party, or user input the site
   * echoes back. `webmcp.test.ts` pins the current answer (nothing sets it) so
   * re-adding it stays a decision rather than drift.
   */
  untrustedContentHint?: boolean;
}

export interface ModelContextTool {
  /** Unique per document. 1–128 chars of `[A-Za-z0-9_.-]`. */
  name: string;
  /** Human-readable label for agent/browser UI. */
  title?: string;
  /** Natural language: what the tool does and when to use it. */
  description: string;
  /** JSON Schema describing `execute`'s single argument object. */
  inputSchema?: Record<string, unknown>;
  /** Spec signature is `Promise<any> (object input)` — any structured value. */
  execute: (input: any) => unknown | Promise<unknown>;
  annotations?: ToolAnnotations;
}

export interface RegisterToolOptions {
  /** Unregisters the tool when aborted — our only teardown path. */
  signal?: AbortSignal;
  /** Origins in the document tree this tool is exposed to. */
  exposedTo?: string[];
}

export interface RegisteredTool {
  name: string;
  title?: string;
  description: string;
  /**
   * The tool's JSON Schema — as an OBJECT or as a serialized string.
   *
   * The spec carried a stringified schema here until 2026-08-14, when the field
   * became the schema object itself. Browsers shipping the origin trial still
   * hand back the string, so a reader of `getTools()` has to accept both until
   * those builds age out.
   */
  inputSchema?: Record<string, unknown> | string;
  window: Window;
  origin: string;
  annotations?: ToolAnnotations;
}

export interface ModelContext extends EventTarget {
  registerTool(tool: ModelContextTool, options?: RegisterToolOptions): Promise<void>;
  getTools(options?: { fromOrigins?: string[] }): Promise<RegisteredTool[]>;
  ontoolchange: ((this: ModelContext, event: Event) => unknown) | null;
}

declare global {
  interface Document {
    /** Present only in a secure context, on a browser implementing WebMCP. */
    readonly modelContext?: ModelContext;
  }
}
