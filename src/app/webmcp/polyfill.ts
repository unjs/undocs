/**
 * Derived from Google's reference WebMCP polyfill (Apache-2.0, Copyright 2026
 * Google LLC):
 * https://github.com/GoogleChromeLabs/webmcp-tools/blob/main/demos/shared/webmcp-polyfill.js
 * Retains its exact `window.__webmcp_registered_tools` registry plus `getTools()`
 * and `executeTool()` compatibility surfaces. Registered `inputSchema` remains
 * stringified for reference-polyfill consumers; `types.ts` accepts that and the
 * newer spec object. Installation is explicit and client-only.
 *
 * Dropped, and why:
 * - declarative `form[toolname]` tools: undocs registers imperatively, so form
 *   filling and submit interception would be unused main-bundle weight.
 * - `:tool-form-active`/`:tool-submit-active` shims: they serve only declarative
 *   tools and refetch every external stylesheet to rewrite selectors.
 * - cross-frame discovery and the `postMessage` bridge: the reference accepts
 *   any origin, exposing tools such as `navigate` to an embedding page. Same-
 *   window discovery preserves the spec's same-origin default; `fromOrigins` is
 *   accepted but ignored because all tools belong to this window.
 */
import type {
  ModelContext,
  ModelContextTool,
  RegisteredTool,
  RegisterToolOptions,
} from "./types.ts";

export interface PolyfilledTool extends RegisteredTool {
  /** Reference polyfill's execution-handle name. */
  _execute: ModelContextTool["execute"];
}

declare global {
  interface Window {
    __webmcp_registered_tools?: Map<string, PolyfilledTool>;
  }
}

/* WebMCP tool-name grammar. */
const TOOL_NAME_RE = /^[A-Za-z0-9_.-]{1,128}$/;

function registry(): Map<string, PolyfilledTool> {
  return (window.__webmcp_registered_tools ??= new Map());
}

/* Accept reference clients' objects and spec clients' JSON strings. */
function toInputObject(args: unknown): Record<string, unknown> {
  let input = args;
  if (typeof input === "string") {
    try {
      input = JSON.parse(input);
    } catch {
      return {};
    }
  }
  return input && typeof input === "object" ? (input as Record<string, unknown>) : {};
}

class PolyfillModelContext extends EventTarget implements ModelContext {
  #ontoolchange: ((this: ModelContext, event: Event) => unknown) | null = null;
  readonly #load: () => Promise<unknown>;
  #loading: Promise<unknown> | undefined;

  constructor(load: () => Promise<unknown>) {
    super();
    this.#load = load;
  }

  /* Load tools on first lookup, memoizing failure to avoid repeated imports and
   * warnings for visitors whose agent probes again. */
  #ensureTools(): Promise<unknown> {
    return (this.#loading ??= this.#load().catch((error: unknown) => {
      console.warn("[undocs] WebMCP: could not load the docs tools", error);
    }));
  }

  async registerTool(tool: ModelContextTool, options: RegisterToolOptions = {}): Promise<void> {
    if (!tool || typeof tool !== "object") {
      throw new TypeError("Invalid tool object");
    }
    const { name, description } = tool;
    if (typeof name !== "string" || !TOOL_NAME_RE.test(name)) {
      throw new DOMException(`Invalid tool name: ${String(name)}`, "InvalidStateError");
    }
    if (typeof description !== "string" || description.length === 0) {
      throw new DOMException(`Invalid description for tool "${name}"`, "InvalidStateError");
    }
    if (typeof tool.execute !== "function") {
      throw new TypeError(`Tool "${name}" has no \`execute\``);
    }

    const tools = registry();
    if (tools.has(name)) {
      throw new DOMException(`Tool "${name}" is already registered`, "InvalidStateError");
    }

    // An already-aborted signal must not register a tool.
    const { signal } = options;
    if (signal?.aborted) {
      throw signal.reason ?? new DOMException("Aborted", "AbortError");
    }

    tools.set(name, {
      name,
      title: tool.title,
      description,
      inputSchema: tool.inputSchema ? JSON.stringify(tool.inputSchema) : undefined,
      window,
      origin: window.origin,
      annotations: tool.annotations,
      _execute: tool.execute,
    });

    // Abort is the spec teardown and makes HMR re-registration safe.
    signal?.addEventListener("abort", () => {
      if (registry().delete(name)) this.dispatchEvent(new Event("toolchange"));
    });

    this.dispatchEvent(new Event("toolchange"));
  }

  async getTools(_options?: { fromOrigins?: string[] }): Promise<PolyfilledTool[]> {
    await this.#ensureTools();
    return [...registry().values()];
  }

  /* Match native `executeTool` by JSON-serializing results; returning raw objects
   * would render as `[object Object]` in text clients. Accept spec JSON strings,
   * reference-client objects, or missing input, coercing non-objects to `{}`.
   * Tools may be addressed by descriptor or bare name. */
  async executeTool(
    tool: { name?: string } | string,
    args?: unknown,
    _options?: { signal?: AbortSignal },
  ): Promise<string> {
    await this.#ensureTools();
    const name = typeof tool === "string" ? tool : tool?.name;
    const registered = name ? registry().get(name) : undefined;
    if (!registered) {
      throw new Error(`Tool ${String(name)} not found`);
    }
    const result = await registered._execute(toInputObject(args));
    // Keep JSON parseable when a tool returns a non-serializable top-level value.
    return JSON.stringify(result ?? null) ?? "null";
  }

  get ontoolchange(): ((this: ModelContext, event: Event) => unknown) | null {
    return this.#ontoolchange;
  }

  set ontoolchange(handler: ((this: ModelContext, event: Event) => unknown) | null) {
    if (this.#ontoolchange) this.removeEventListener("toolchange", this.#ontoolchange as any);
    this.#ontoolchange = handler;
    if (handler) this.addEventListener("toolchange", handler as any);
  }

  /* A `toolchange` subscription is a lookup because agents may next read the
   * registry directly. Attach the listener before loading: registration can
   * dispatch synchronously before its first await. */
  override addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ): void {
    super.addEventListener(type, callback, options);
    if (type === "toolchange") void this.#ensureTools();
  }
}

export function installWebMCPPolyfill(load: () => Promise<unknown>): ModelContext | undefined {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  if (document.modelContext) return document.modelContext;

  const modelContext = new PolyfillModelContext(load);
  Object.defineProperty(document, "modelContext", {
    value: modelContext,
    writable: false,
    configurable: true,
  });
  return modelContext;
}
