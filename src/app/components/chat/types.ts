/**
 * The shapes undocs uses from `agentak`, declared here rather than imported.
 *
 * The library is loaded from a CDN at runtime (see `agentak.ts`), so there is no
 * package to take types from: undocs does not depend on agentak, and a docs
 * project does not install it either. These are the members this widget passes
 * or holds, and nothing more — they are structural, so a wider library API stays
 * compatible with them.
 */

/** One control undocs adds to the chat's own title bar — see `close-action.ts`. */
export interface ChatAction {
  /** Distinguishes one action from the next. Not shown. */
  id: string;
  /** The name the button answers to, and its tooltip. */
  label: string;
  onClick: () => void;
  /** The name of an icon the library ships. */
  icon?: string;
}

/** The session the chat runs on. Made and ended by whoever made it. */
export interface ChatSession {
  dispose?: () => void;
}

/** What `mountChat` hands back: a redraw and a teardown, neither of them the session's. */
export interface ChatMount {
  update: (props: MountChatOptions) => void;
  unmount: () => void;
}

export interface MountChatOptions {
  session: ChatSession;
  actions?: ChatAction[];
  prompts?: string[];
  /** Declare the library's `--*` tokens on the page. Default: yes. */
  tokens?: boolean;
}

/** `agentak` — the surface, with no agent runtime behind it. */
export interface AgentakModule {
  mountChat: (target: Element | string, props: MountChatOptions) => ChatMount;
}

/** `agentak/pi` — the built-in loop, and the store it keeps a reader's choices in. */
export interface AgentakPiModule {
  createPiSession: (options: {
    generateTitle?: boolean;
    history?: boolean;
    page?: boolean;
    storage?: unknown;
    systemPrompt?: string;
  }) => ChatSession;
  browserStorage: () => unknown;
}
