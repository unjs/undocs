/**
 * Minimal typings for the WebMCP `document.modelContext` API
 * (https://webmachinelearning.github.io/webmcp/). No TS lib ships these yet and
 * the spec is still moving, so we model only the slice we use and keep the
 * global augmentation OPTIONAL — every call site feature-detects first.
 */

export interface ToolAnnotations {
  /** The tool only reads; it does not mutate page state. */
  readOnlyHint?: boolean;
  /** The result may embed content the page's author does not fully control. */
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
  /** Serialized (stringified) JSON Schema, per spec. */
  inputSchema?: string;
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
