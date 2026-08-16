/**
 * A `document.modelContext` for browsers that do not implement WebMCP yet.
 *
 * DERIVED FROM Google's reference polyfill (Apache-2.0, Copyright 2026 Google
 * LLC): https://github.com/GoogleChromeLabs/webmcp-tools/blob/main/demos/shared/webmcp-polyfill.js
 * — rewritten in TypeScript against our `types.ts`, keeping the two things its
 * consumers actually bind to: the `window.__webmcp_registered_tools` registry
 * and the `getTools()` / `executeTool()` pair (`executeTool` began as the
 * reference polyfill's own addition, before the spec grew the method).
 *
 * Dropped, and why:
 * - **Declarative `form[toolname]` tools.** undocs registers every tool
 *   imperatively from `./tools/`; the app renders no `toolname` form, so the
 *   form-filling/submit-interception half of the reference polyfill would be
 *   dead weight in the main bundle.
 * - **The `:tool-form-active` / `:tool-submit-active` pseudo-class shim.** Only
 *   meaningful with declarative tools, and it re-`fetch`es every external
 *   stylesheet to rewrite selectors — a second download of `main.css` on a page
 *   load, for CSS we do not ship.
 * - **Cross-frame discovery and the `postMessage` bridge.** The reference
 *   polyfill answers `WEBMCP_GET_TOOLS_REQUEST` from ANY origin and will run a
 *   tool for it, which on a docs site embedded in someone else's page hands
 *   that page our `navigate` tool. The spec gates cross-origin exposure behind
 *   `registerTool`'s `exposedTo` (same-origin by default), so staying
 *   same-window is the faithful default, not a limitation. `getTools`'
 *   `fromOrigins` is accepted and ignored for the same reason: every tool here
 *   is this window's own, and the reference filter passes those unconditionally.
 *
 * Registered tools carry a STRINGIFIED `inputSchema`, matching the reference
 * polyfill — its consumers `JSON.parse(tool.inputSchema)` (see the page-agent
 * demo). The spec moved that field to a schema object in 2026-08-14, so a
 * reader of `getTools()` has to accept both anyway (`types.ts`); a polyfill's
 * job is to look like the polyfill everyone wrote against.
 *
 * CLIENT-ONLY, and installed by an explicit call — the module has no top-level
 * side effect, so nothing here can run during SSR.
 */
import type {
  ModelContext,
  ModelContextTool,
  RegisteredTool,
  RegisterToolOptions,
} from "./types.ts";

/** A `getTools()` entry, plus the handle `executeTool` runs it through. */
export interface PolyfilledTool extends RegisteredTool {
  /** The registrant's `execute`. Named as the reference polyfill names it. */
  _execute: ModelContextTool["execute"];
}

declare global {
  interface Window {
    /**
     * The reference polyfill's registry, and the reason we reuse the exact
     * name: an agent that reads it directly (rather than calling `getTools()`)
     * finds our tools where it expects them.
     */
    __webmcp_registered_tools?: Map<string, PolyfilledTool>;
  }
}

/** Spec: 1–128 chars of ASCII alphanumerics plus `_`, `-`, `.`. */
const TOOL_NAME_RE = /^[A-Za-z0-9_.-]{1,128}$/;

function registry(): Map<string, PolyfilledTool> {
  return (window.__webmcp_registered_tools ??= new Map());
}

/**
 * Coerce a caller's arguments into the `object input` `execute` is declared to
 * take — the spec parses `inputArguments` as JSON and fails anything that is
 * not an object; we substitute `{}` instead (see `executeTool`).
 */
function toInputObject(args: unknown): Record<string, unknown> {
  let input = args;
  if (typeof input === "string") {
    try {
      input = JSON.parse(input);
    } catch {
      // Not JSON — there are no arguments to hand over.
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

  /**
   * Pull the tools in, once. Registration itself never calls this — only a
   * LOOKUP does, which is what keeps the tools chunk off the critical path of a
   * visitor no agent ever talks to. A failed import is remembered as failed: the
   * chunk is not coming back this page load, and retrying per call would just
   * re-log on every lookup.
   */
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

    // An already-aborted signal registers nothing, matching `AbortSignal`
    // semantics everywhere else on the platform.
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

    // The spec's only teardown path (see `./index.ts`), so it is also what makes
    // a dev HMR re-setup legal here.
    signal?.addEventListener("abort", () => {
      if (registry().delete(name)) this.dispatchEvent(new Event("toolchange"));
    });

    this.dispatchEvent(new Event("toolchange"));
  }

  async getTools(_options?: { fromOrigins?: string[] }): Promise<PolyfilledTool[]> {
    await this.#ensureTools();
    return [...registry().values()];
  }

  /**
   * Run a tool, and resolve its result AS A JSON STRING.
   *
   * The string is the whole point: the spec's signature is
   * `Promise<DOMString> executeTool(RegisteredTool, DOMString inputArguments)`,
   * and its imperative execute steps serialize `execute`'s fulfillment value to
   * JSON before resolving. A native `modelContext` therefore hands the agent
   * text, and a client that renders what it got — `${result}`, an
   * `innerText =`, an append into a chat transcript — renders that text. The
   * reference polyfill predates the method being specced and resolves the raw
   * value, so those same clients print `[object Object]` for every tool here.
   * Matching the spec is the only way to be indistinguishable from native,
   * which is what a polyfill is for; a consumer that wants the object parses
   * one, exactly as it must against Chrome.
   *
   * Input is the mirror image and stays LENIENT where the spec is not: it takes
   * the JSON string the spec passes, an argument object (what every reference
   * consumer passes), or nothing. Anything that does not land on an object
   * becomes `{}` rather than a rejection — a no-arg tool invoked with `""` is
   * common in the wild, and for a tool that does need arguments its own
   * "`query` is required" beats a `DataError` the agent cannot act on.
   *
   * The tool itself is addressed by `name` alone, whether it arrives as the
   * descriptor `getTools()` handed out or as a bare string.
   */
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
    // `?? "null"` covers a tool resolving something JSON drops entirely
    // (`undefined`, a function): the spec's serialization step would throw,
    // but an agent is better served by a value it can parse.
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

  /**
   * Subscribing to `toolchange` counts as looking for tools. An agent that
   * listens first and then reads `window.__webmcp_registered_tools` directly
   * never calls `getTools()`, and would otherwise find the registry empty
   * forever — the one blind spot loading the tools lazily creates.
   *
   * The listener goes on FIRST: `#load()` runs synchronously up to its first
   * await, and `registerTool` dispatches without awaiting anything, so
   * triggering the load first would fire the opening `toolchange` into a
   * listener that is not attached yet.
   */
  override addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ): void {
    super.addEventListener(type, callback, options);
    if (type === "toolchange") void this.#ensureTools();
  }
}

/**
 * Install `document.modelContext` unless the browser already has one, deferring
 * `load()` — which registers the docs tools — until an agent first looks.
 *
 * Returns the context in play (native or ours), or `undefined` off-browser.
 */
export function installWebMCPPolyfill(load: () => Promise<unknown>): ModelContext | undefined {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  if (document.modelContext) return document.modelContext; // native, or already installed

  const modelContext = new PolyfillModelContext(load);
  // `configurable` so a real implementation (or a re-install) can replace it —
  // the reference polyfill defines it the same way.
  Object.defineProperty(document, "modelContext", {
    value: modelContext,
    writable: false,
    configurable: true,
  });
  return modelContext;
}
