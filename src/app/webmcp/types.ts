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
  /**
   * JSON Schema describing what the tool ANSWERS with — MCP's `Tool.outputSchema`.
   *
   * NOT a WebMCP member: the spec's descriptor dictionary declares no such key
   * and WebIDL discards what it does not declare, so a native `registerTool`
   * drops it silently. It is carried anyway because it costs nothing where it is
   * dropped and is read by the two clients that can act on it — an agent reading
   * `./polyfill.ts`'s registry, and a bridge mapping our tools onto MCP ones.
   * See `./tools/schemas.ts`.
   */
  outputSchema?: Record<string, unknown>;
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
  /**
   * The tool's output schema, always an OBJECT — never stringified the way
   * `inputSchema` is above. That stringification is a compatibility wart owed to
   * consumers that already `JSON.parse` the field; nothing has ever read this
   * one, so it takes the shape MCP gives `Tool.outputSchema`. Present only on a
   * tool the polyfill registered — a native `getTools()` cannot return it.
   */
  outputSchema?: Record<string, unknown>;
  window: Window;
  origin: string;
  annotations?: ToolAnnotations;
}

export interface ModelContext extends EventTarget {
  registerTool(tool: ModelContextTool, options?: RegisterToolOptions): Promise<void>;
  getTools(options?: { fromOrigins?: string[] }): Promise<RegisteredTool[]>;
  ontoolchange: ((this: ModelContext, event: Event) => unknown) | null;
  /**
   * Run a tool and resolve its result as a JSON STRING — the spec serializes
   * `execute`'s value before resolving, and so does `./polyfill.ts`.
   *
   * The spec passes `inputArguments` as JSON text and takes only a
   * `RegisteredTool`; the polyfill also accepts an argument object and a bare
   * tool name, because every reference-polyfill consumer calls it that way.
   * Optional because a browser predating the method may not have it.
   */
  executeTool?(
    tool: { name?: string } | string,
    args?: unknown,
    options?: { signal?: AbortSignal },
  ): Promise<string>;
}

declare global {
  interface Document {
    /** Present only in a secure context, on a browser implementing WebMCP. */
    readonly modelContext?: ModelContext;
  }
}
